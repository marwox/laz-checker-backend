# Image resmi Playwright (Chromium + semua dependency sudah terpasang)
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

# Install dependency dulu (cache layer)
COPY package.json ./
RUN npm install --omit=dev

# Salin kode
COPY server.js ./

# Render menyuntikkan PORT lewat env var
ENV NODE_ENV=production
EXPOSE 8787

CMD ["node", "server.js"]
