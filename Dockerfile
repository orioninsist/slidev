FROM node:22-bookworm-slim

WORKDIR /app

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates \
       fonts-dejavu-core \
       fonts-liberation \
       fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

COPY slidev-docker.package.json /app/package.json

RUN npm install --no-audit --no-fund \
    && npx playwright install --with-deps chromium

RUN mkdir -p /app/node_modules/@slidev/cli/node_modules \
    && ln -s /app/node_modules/katex /app/node_modules/@slidev/cli/node_modules/katex

RUN mkdir -p /app/node_modules/@slidev/cli/node_modules/.vite \
    && chmod -R a+rwX /app/node_modules/@slidev/cli/node_modules/.vite

WORKDIR /work

ENTRYPOINT ["node", "/app/node_modules/@slidev/cli/bin/slidev.mjs"]
