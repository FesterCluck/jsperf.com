FROM node:12-alpine
WORKDIR /usr/src
ENV NODE_ENV="production"
COPY package.json package-lock.json ./
RUN npm install --production --ignore-scripts
COPY . .
CMD ["node", "server.js"]
