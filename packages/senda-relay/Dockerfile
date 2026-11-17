# Relé SENDA autoalojable (soberanía: lo opera el organismo público en su propia infraestructura).
# Construir desde la raíz del repositorio:  docker build -f packages/senda-relay/Dockerfile -t senda-relay .
FROM node:22-alpine
WORKDIR /app
COPY packages/senda/src ./packages/senda/src
COPY packages/senda/package.json ./packages/senda/package.json
COPY packages/senda-relay ./packages/senda-relay
ENV PORT=8787 DATA_DIR=/data NODE_ENV=production
# El proceso corre sin privilegios: el directorio de datos debe ser suyo antes de declarar el volumen.
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
EXPOSE 8787
USER node
HEALTHCHECK CMD wget -qO- http://127.0.0.1:8787/health || exit 1
CMD ["node", "packages/senda-relay/server.mjs"]
