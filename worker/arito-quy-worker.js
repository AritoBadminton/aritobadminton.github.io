/**
 * Cầu nối giữa trang Quỹ CLB Cầu Lông Arito và GitHub.
 *
 * Trang chạy trên GitHub Pages nên không tự ghi được vào repo. Worker này giữ
 * token GitHub ở phía máy chủ: trang chỉ gửi lên thay đổi kèm phiên đăng nhập,
 * Worker kiểm tra rồi mới commit vào data.json. Nhờ vậy token không bao giờ
 * xuất hiện trong trình duyệt của bất kỳ ai.
 *
 * Biến bí mật cần đặt trong Cloudflare (xem docs/TRIEN-KHAI-WORKER.md):
 *   GITHUB_TOKEN    token fine-grained, chỉ quyền Contents: Read and write
 *   GITHUB_REPO     ví dụ "AritoBadminton/aritobadminton.github.io"
 *   ADMIN_USERS     JSON {"tendangnhap": "matkhau", ...}
 *   SESSION_SECRET  chuỗi ngẫu nhiên dài, dùng để ký phiên đăng nhập
 *   ALLOWED_ORIGIN  ví dụ "https://aritobadminton.github.io"
 *
 * Biến tuỳ chọn: GITHUB_BRANCH (mặc định "main"), DATA_PATH (mặc định "data.json").
 */

/* ---------- Hằng số ---------- */

/** Phiên đăng nhập sống bao lâu, tính bằng giây. */
const SESSION_TTL_SECONDS = 8 * 60 * 60;

/** Chờ thêm khi sai mật khẩu, làm chậm việc dò mật khẩu. */
const WRONG_PASSWORD_DELAY_MS = 700;

/** Kích thước tối đa của một lần gửi lên, chặn payload rác. */
const MAX_BODY_BYTES = 512 * 1024;

/** Số lần thử lại khi có người khác vừa commit chen vào giữa. */
const CONFLICT_RETRIES = 2;

/** Các phần dữ liệu mà trang được phép ghi. */
const SECTIONS = ['rules', 'roster', 'month', 'ledger'];

/* ---------- Hàm bổ trợ chung ---------- */

/** Ngủ một khoảng, dùng để làm chậm phản hồi khi sai mật khẩu. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** So sánh hai chuỗi trong thời gian không đổi, tránh lộ thông tin qua thời gian phản hồi. */
function isEqualConstantTime(a, b) {
  const left = new TextEncoder().encode(String(a));
  const right = new TextEncoder().encode(String(b));
  let diff = left.length ^ right.length;
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

/** Mã hoá chuỗi UTF-8 thành base64 (btoa không xử lý được tiếng Việt). */
function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

/** Giải base64 về chuỗi UTF-8. */
function decodeBase64(base64) {
  const binary = atob(base64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Chuyển base64 sang dạng an toàn cho URL, bỏ dấu "=". */
function toBase64Url(base64) {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Ký một chuỗi bằng HMAC-SHA256, trả về base64url. */
async function signText(text, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  let binary = '';
  new Uint8Array(signature).forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return toBase64Url(btoa(binary));
}

/* ---------- Phiên đăng nhập ---------- */

/**
 * Tạo vé đăng nhập dạng "user.hanSuDung.chuKy".
 * Không dùng được nếu sửa bất kỳ ký tự nào vì chữ ký sẽ sai.
 */
async function createSessionToken(user, secret) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${toBase64Url(encodeBase64(user))}.${expiresAt}`;
  return { token: `${payload}.${await signText(payload, secret)}`, expiresAt };
}

/**
 * Kiểm tra vé đăng nhập, trả về tên người dùng hoặc null.
 */
async function readSessionToken(token, secret) {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3) return null;

  const [encodedUser, expiresAt, signature] = parts;
  const expected = await signText(`${encodedUser}.${expiresAt}`, secret);
  if (!isEqualConstantTime(signature, expected)) return null;
  if (Number(expiresAt) * 1000 < Date.now()) return null;

  try {
    return decodeBase64(encodedUser.replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    return null;
  }
}

/* ---------- Gọi GitHub ---------- */

/** Tiêu đề dùng chung cho mọi lời gọi GitHub. */
function buildGithubHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'arito-quy-clb-worker',
  };
}

/** Đọc data.json hiện tại trên GitHub, trả về nội dung đã parse và mã sha. */
async function readDataFile(env) {
  const branch = env.GITHUB_BRANCH || 'main';
  const path = env.DATA_PATH || 'data.json';
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}?ref=${branch}`;

  const response = await fetch(url, { headers: buildGithubHeaders(env) });
  if (!response.ok) {
    throw new Error(`Không đọc được data.json từ GitHub (mã ${response.status}).`);
  }
  const body = await response.json();
  return { data: JSON.parse(decodeBase64(body.content)), sha: body.sha };
}

/** Ghi data.json mới lên GitHub. Trả về false nếu có người vừa commit chen vào. */
async function writeDataFile(env, data, sha, message) {
  const branch = env.GITHUB_BRANCH || 'main';
  const path = env.DATA_PATH || 'data.json';
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: { ...buildGithubHeaders(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: encodeBase64(`${JSON.stringify(data, null, 1)}\n`),
      sha,
      branch,
    }),
  });

  if (response.status === 409 || response.status === 422) return false;
  if (!response.ok) {
    throw new Error(`GitHub từ chối ghi (mã ${response.status}).`);
  }
  return true;
}

/* ---------- Kiểm tra dữ liệu gửi lên ---------- */

/** Một chuỗi hợp lệ và không quá dài. */
function isCleanText(value, maxLength = 200) {
  return typeof value === 'string' && value.length <= maxLength;
}

/** Một số tiền hợp lệ: nguyên, không âm, không phi lý. */
function isCleanAmount(value) {
  return Number.isInteger(value) && value >= 0 && value <= 1_000_000_000;
}

/**
 * Soát nội dung gửi lên theo từng phần. Trả về chuỗi lỗi, hoặc null nếu hợp lệ.
 * Worker không tin trang web: dữ liệu sai hình dạng bị chặn trước khi tới GitHub.
 */
function findPayloadError(section, payload) {
  if (!payload || typeof payload !== 'object') return 'Thiếu nội dung gửi lên.';

  if (section === 'rules') {
    if (!Array.isArray(payload.items) || payload.items.length > 20) return 'Danh sách quy định không hợp lệ.';
    const bad = payload.items.some(
      (item) =>
        !isCleanText(item?.amount, 40) || !isCleanText(item?.who, 120) || !isCleanText(item?.unit, 80),
    );
    return bad ? 'Có mức đóng sai định dạng.' : null;
  }

  if (section === 'roster') {
    if (!Array.isArray(payload.roster) || payload.roster.length > 500) {
      return 'Danh sách thành viên không hợp lệ.';
    }
    const bad = payload.roster.some(
      (item) => !isCleanText(item?.name, 120) || typeof item?.active !== 'boolean',
    );
    return bad ? 'Có thành viên sai định dạng.' : null;
  }

  if (section === 'month') {
    const month = payload.month;
    if (!month || !/^\d{4}-\d{2}$/.test(month.month ?? '')) return 'Mã tháng không hợp lệ.';
    if (!Array.isArray(month.members) || month.members.length > 500) {
      return 'Danh sách đóng quỹ không hợp lệ.';
    }
    const bad = month.members.some(
      (item) =>
        !isCleanText(item?.name, 120) ||
        !isCleanAmount(item?.paid) ||
        !isCleanText(item?.note ?? '', 300) ||
        (item?.skip !== undefined && typeof item.skip !== 'boolean'),
    );
    return bad ? 'Có dòng đóng quỹ sai định dạng.' : null;
  }

  if (section === 'ledger') {
    const lists = [payload.incomes, payload.expenses];
    if (lists.some((list) => !Array.isArray(list) || list.length > 5000)) {
      return 'Danh sách thu chi không hợp lệ.';
    }
    const bad = lists.some((list) =>
      list.some(
        (item) =>
          !/^\d{4}-\d{2}-\d{2}$/.test(item?.date ?? '') ||
          !isCleanAmount(item?.amount) ||
          !isCleanText(item?.desc, 300) ||
          !isCleanText(item?.cat, 120),
      ),
    );
    if (bad) return 'Có dòng thu chi sai định dạng.';
    return /^\d{4}-\d{2}-\d{2}$/.test(payload.updated ?? '') ? null : 'Ngày cập nhật không hợp lệ.';
  }

  return 'Phần dữ liệu không được hỗ trợ.';
}

/* ---------- Ghép thay đổi vào data.json ---------- */

/**
 * Đưa thay đổi vào bản dữ liệu vừa đọc từ GitHub.
 * Chỉ chạm đúng phần được gửi lên, mọi phần khác giữ nguyên.
 */
function applyChange(data, section, payload) {
  if (section === 'rules') {
    data.rules = { ...(data.rules ?? {}), items: payload.items };
    return `Cap nhat quy dinh dong quy (${payload.items.length} muc)`;
  }

  if (section === 'roster') {
    data.roster = payload.roster;
    const activeCount = payload.roster.filter((item) => item.active).length;
    return `Cap nhat thanh vien (${activeCount}/${payload.roster.length} dang hoat dong)`;
  }

  if (section === 'month') {
    const months = Array.isArray(data.months) ? data.months : [];
    const index = months.findIndex((item) => item.month === payload.month.month);
    if (index >= 0) months[index] = payload.month;
    else months.push(payload.month);
    months.sort((a, b) => String(a.month).localeCompare(String(b.month)));
    data.months = months;
    return `Cap nhat dong quy thang ${payload.month.month}`;
  }

  data.incomes = payload.incomes;
  data.expenses = payload.expenses;
  data.updated = payload.updated;
  return `Cap nhat so thu chi (${payload.incomes.length} thu, ${payload.expenses.length} chi)`;
}

/* ---------- Phản hồi HTTP ---------- */

/** Tiêu đề CORS, chỉ mở cho đúng tên miền của trang. */
function buildCorsHeaders(env, request) {
  const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((item) => item.trim());
  const origin = request.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** Trả JSON kèm CORS. */
function sendJson(env, request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...buildCorsHeaders(env, request) },
  });
}

/* ---------- Các đầu việc ---------- */

/** Đăng nhập: đúng tài khoản thì cấp vé có hạn. */
async function handleLogin(request, env) {
  const body = await request.json();
  let users;
  try {
    users = JSON.parse(env.ADMIN_USERS);
  } catch {
    return sendJson(env, request, { error: 'Worker chưa cấu hình đúng ADMIN_USERS.' }, 500);
  }

  const user = String(body.user ?? '')
    .trim()
    .toLowerCase();
  const expected = users[user];

  if (!expected || !isEqualConstantTime(body.password ?? '', expected)) {
    await sleep(WRONG_PASSWORD_DELAY_MS);
    return sendJson(env, request, { error: 'Sai tài khoản hoặc mật khẩu.' }, 401);
  }

  const session = await createSessionToken(user, env.SESSION_SECRET);
  return sendJson(env, request, { user, ...session });
}

/** Lưu một phần dữ liệu lên GitHub. */
async function handleSave(request, env) {
  const authHeader = request.headers.get('Authorization') ?? '';
  const user = await readSessionToken(authHeader.replace(/^Bearer\s+/i, ''), env.SESSION_SECRET);
  if (!user) {
    return sendJson(env, request, { error: 'Phiên đăng nhập đã hết hạn, mời đăng nhập lại.' }, 401);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return sendJson(env, request, { error: 'Nội dung gửi lên quá lớn.' }, 413);
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return sendJson(env, request, { error: 'Nội dung gửi lên không phải JSON hợp lệ.' }, 400);
  }

  const { section, payload } = body;
  if (!SECTIONS.includes(section)) {
    return sendJson(env, request, { error: 'Phần dữ liệu không được hỗ trợ.' }, 400);
  }
  const payloadError = findPayloadError(section, payload);
  if (payloadError) {
    return sendJson(env, request, { error: payloadError }, 400);
  }

  // Đọc — ghép — ghi. Nếu có người vừa commit chen vào thì đọc lại rồi thử lại.
  for (let attempt = 0; attempt <= CONFLICT_RETRIES; attempt += 1) {
    const { data, sha } = await readDataFile(env);
    const summary = applyChange(data, section, payload);
    const committed = await writeDataFile(env, data, sha, `${summary} (${user})`);
    if (committed) {
      return sendJson(env, request, { ok: true, message: summary, data });
    }
  }

  return sendJson(env, request, { error: 'Có người khác vừa lưu cùng lúc, thử lại giúp tôi.' }, 409);
}

/* ---------- Điểm vào ---------- */

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: buildCorsHeaders(env, request) });
    }
    if (pathname === '/health') {
      return sendJson(env, request, { ok: true });
    }
    if (request.method !== 'POST') {
      return sendJson(env, request, { error: 'Chỉ nhận POST.' }, 405);
    }

    try {
      if (pathname === '/login') return await handleLogin(request, env);
      if (pathname === '/save') return await handleSave(request, env);
      return sendJson(env, request, { error: 'Không có đường dẫn này.' }, 404);
    } catch (error) {
      return sendJson(env, request, { error: error.message ?? 'Lỗi không xác định.' }, 500);
    }
  },
};
