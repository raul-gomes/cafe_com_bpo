FROM nginx:alpine

# NGINX_CONF: "nginx.conf" (padrão, prod/SSL) ou "nginx.conf.local" (dev/HTTP)
ARG NGINX_CONF=nginx.conf
COPY ${NGINX_CONF} /etc/nginx/nginx.conf

EXPOSE 80 443

# Healthcheck verifica HTTP (porta 80 responde com redirect ou ACME)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
