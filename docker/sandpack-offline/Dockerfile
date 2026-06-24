FROM nginx:1.25.3-alpine

WORKDIR /usr/share/nginx/html

COPY www ./
COPY offline-packages ./__sandpack_packages__
COPY docker/sandpack-offline/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/sandpack-offline/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
