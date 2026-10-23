FROM node:22-bookworm-slim

WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates ffmpeg fonts-dejavu-core fonts-liberation fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*
COPY orioninsist/package.json /app/package.json
RUN npm install --no-audit --no-fund \
    && npx playwright install --with-deps chromium
RUN mkdir -p /app/node_modules/@slidev/cli/node_modules/.vite \
    && chmod -R a+rwX /app/node_modules/@slidev/cli/node_modules/.vite
COPY orioninsist/runner.mjs /app/runner.mjs
ENTRYPOINT ["node", "/app/runner.mjs"]
