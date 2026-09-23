#!/usr/bin/env node
/**
 * Đối chiếu hash SHA-256 trong CSP (index.html) với nội dung thật của
 * <script type="importmap">. Sửa importmap mà quên tính lại hash là cách
 * nhanh nhất khiến trang trắng tinh (CSP chặn luôn script đó) — script này
 * chặn đẩy lên trước khi kịp xảy ra chuyện đó, chạy trong `npm run check`.
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const indexPath = fileURLToPath(new URL('../index.html', import.meta.url));
const html = readFileSync(indexPath, 'utf8');

// Bỏ qua nội dung trong <!-- comment --> trước khi tìm importmap — chú thích
// nhắc tới chuỗi `<script type="importmap">` (để giải thích cho người đọc)
// từng bị regex bên dưới nhầm là chính khối importmap thật, tính hash sai.
const htmlWithoutComments = html.replace(/<!--[\s\S]*?-->/g, '');

const importmapMatch = htmlWithoutComments.match(/<script type="importmap">([\s\S]*?)<\/script>/);
if (!importmapMatch) {
  console.error('Không tìm thấy <script type="importmap"> trong index.html.');
  process.exit(1);
}

const actualHash = createHash('sha256').update(importmapMatch[1], 'utf8').digest('base64');

const cspMatch = html.match(/Content-Security-Policy[^>]*?sha256-([A-Za-z0-9+/=]+)/);
if (!cspMatch) {
  console.error(
    'Không tìm thấy hash sha256- nào trong thẻ CSP (meta http-equiv="Content-Security-Policy") của index.html.',
  );
  process.exit(1);
}

const declaredHash = cspMatch[1];

if (actualHash !== declaredHash) {
  console.error(
    'Hash CSP của importmap KHÔNG khớp với nội dung thật — sửa importmap thì phải sửa cả hash này.',
  );
  console.error(`  Hash đang ghi trong CSP: sha256-${declaredHash}`);
  console.error(`  Hash đúng của importmap: sha256-${actualHash}`);
  console.error('Dán đúng hash thứ hai vào thẻ CSP trong index.html rồi chạy lại.');
  process.exit(1);
}

console.log('Hash CSP của importmap khớp đúng nội dung.');
