FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends perl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./server.js
COPY moss ./moss

ENV NODE_ENV=production
ENV PORT=8788

EXPOSE 8788

CMD ["node", "server.js"]
