#!/bin/sh

# 環境変数BACKEND_URLが設定されている場合、nginx.confのプレースホルダーを置換
if [ -n "$BACKEND_URL" ]; then
  echo "Setting backend URL to: $BACKEND_URL"
  sed -i "s|BACKEND_ALB_DNS_PLACEHOLDER|$BACKEND_URL|g" /etc/nginx/conf.d/default.conf
else
  echo "Warning: BACKEND_URL not set. Using placeholder."
fi

# nginxを起動
exec nginx -g "daemon off;"
