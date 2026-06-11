#!/usr/bin/env bash
set -euo pipefail

cd /data/home/huangyimin/image_text_model_eval

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

HOST="${WEB_HOST:-0.0.0.0}"
PORT="${WEB_PORT:-8765}"

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $2}')"
LAN_IP="${LAN_IP:-$(hostname -I 2>/dev/null | awk '{print $1}')}"

if ss -tlnp 2>/dev/null | grep -q ":${PORT} "; then
  echo "警告: 端口 ${PORT} 已被占用。旧进程可能只监听了 127.0.0.1，VPN 无法访问。"
  echo "可先执行: kill \$(ss -tlnp | grep ':${PORT} ' | sed -n 's/.*pid=\\([0-9]*\\).*/\\1/p')"
  exit 1
fi

OFFICE_IP="${OFFICE_PUBLIC_IP:-112.27.96.227}"

echo "===== 模型效果评测 Web 服务 ====="
echo "本机访问:     http://127.0.0.1:${PORT}"
echo "办公/VPN访问: http://${OFFICE_IP}:${PORT}   ← 办公电脑用这个，不要用 10.x"
if [[ -n "$LAN_IP" ]]; then
  echo "服务器内网:   http://${LAN_IP}:${PORT}   (仅服务器本机/同网段)"
fi
echo "监听地址:     ${HOST}:${PORT}  (必须是 0.0.0.0，不能是 127.0.0.1)"
echo

python -m uvicorn web.app:app --host "$HOST" --port "$PORT"
