#!/bin/bash
# Dựng bản kiểm thử: chép mã nguồn ra thư mục tạm, bật chế độ Firebase và trỏ
# import map sang module giả lập trong fbstub/ để chạy được mà không cần mạng.
#
#   bash tests/make-fbtest.sh            # nguồn = thư mục gốc repo, đích = /tmp/fbtest
#   bash tests/make-fbtest.sh <nguồn> <đích>
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${1:-$(dirname "$HERE")}
DEST=${2:-/tmp/fbtest}

rm -rf "$DEST"; mkdir -p "$DEST"
(cd "$SRC" && tar --exclude=node_modules --exclude=.git --exclude=tests -cf - .) | (cd "$DEST" && tar xf -)
cp -r "$HERE/fbstub" "$DEST/fbstub"

python3 - "$DEST" <<'PY'
import sys, re, pathlib
d = pathlib.Path(sys.argv[1])
stub = {
  "firebase/app": "/fbstub/app.js",
  "firebase/auth": "/fbstub/auth.js",
  "firebase/firestore": "/fbstub/firestore.js",
}
for p in d.glob("*.html"):
    s = p.read_text(encoding="utf-8")
    for k, v in stub.items():
        s = re.sub(r'"%s": "[^"]+"' % re.escape(k), '"%s": "%s"' % (k, v), s)
    p.write_text(s, encoding="utf-8")

# Bật chế độ Firebase bằng cấu hình giả; không có khoá thật nào nằm trong test.
cfg = d / "src/config/firebase-config.js"
s = cfg.read_text(encoding="utf-8")
s = s.replace("apiKey: ''", "apiKey: 'fake-key'").replace("projectId: ''", "projectId: 'demo-arito'")
cfg.write_text(s, encoding="utf-8")
print("bản kiểm thử sẵn sàng:", d)
PY
