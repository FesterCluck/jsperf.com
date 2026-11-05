FROM node:22-alpine AS base
WORKDIR /usr/src
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .

FROM node:22-alpine
WORKDIR /usr/src
ENV NODE_ENV="production"
COPY --from=base --chown=node:node /usr/src .
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:${PORT:-3000}/health" || exit 1
CMD ["node", "server.js"]
