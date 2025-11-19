FROM nginx:alpine

# supervisordをインストール（nginxとバックエンドAPIを同時に起動するため）
RUN apk add --no-cache supervisor curl

# nginxの設定ファイルをコピー
COPY nginx.conf /etc/nginx/conf.d/default.conf

# supervisordの設定ファイルを作成
RUN mkdir -p /var/log/supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# バックエンドAPIイメージからバイナリを取得
# （nmatsui/hello-world-apiはNode.jsアプリなので、その実行環境も必要）
# 代わりにNode.jsをインストールしてシンプルなAPIサーバーを作成
RUN apk add --no-cache nodejs npm

# シンプルなAPIサーバーを作成
RUN mkdir -p /app
WORKDIR /app
COPY package.json server.js ./
RUN npm install

EXPOSE 3000

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
