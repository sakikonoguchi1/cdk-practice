FROM nginx:alpine

# HTMLファイルをnginxのドキュメントルートにコピー
COPY index.html /usr/share/nginx/html/

# nginx設定ファイルをコピー
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
