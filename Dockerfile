# DevUnity CodeArena — full judge image (Python / C++ / Java / Node sandboxes)
# Use this on Render ("Docker" runtime) when you want all four languages on one instance.
FROM node:20-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 g++ default-jdk-headless util-linux ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm --prefix server install --omit=dev && npm --prefix web install

COPY server server
COPY web web
RUN npm --prefix web run build

ENV NODE_ENV=production PORT=8080 AUTOSEED=1 DATA_DIR=/var/lib/codearena
VOLUME ["/var/lib/codearena"]
EXPOSE 8080
CMD ["node", "server/src/index.js"]
