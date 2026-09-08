#!/bin/bash
# Máy chủ tĩnh cho bản kiểm thử; chạy lại được nhiều lần mà không đụng cổng cũ.
PORT=${PORT:-8199}
DIR=${1:-/tmp/fbtest}
pkill -f "http.server $PORT" 2>/dev/null
sleep 0.5
cd "$DIR" && setsid nohup python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 < /dev/null &
sleep 1.5
curl -sf -o /dev/null "http://127.0.0.1:$PORT/index.html" && echo "máy chủ sẵn sàng" || echo "KHÔNG CHẠY ĐƯỢC"
