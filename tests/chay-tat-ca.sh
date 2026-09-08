#!/bin/bash
# Chạy toàn bộ bộ kiểm thử, in số đạt/hỏng của từng file rồi thoát khác 0 nếu có lỗi.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
bash "$HERE/make-fbtest.sh" >/dev/null
bash "$HERE/serve.sh" >/dev/null
loi=0
for f in "$HERE"/verify-*.mjs; do
  printf '%-28s ' "$(basename "$f")"
  ket_qua=$(node "$f" 2>&1 | grep -E 'đạt' | tail -1)
  echo "${ket_qua:-KHÔNG CHẠY ĐƯỢC}"
  echo "$ket_qua" | grep -qE '(^| )0 hỏng' || loi=1
done
exit $loi
