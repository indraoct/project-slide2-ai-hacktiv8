# Node.js 24 LTS — node:sqlite (memory chatbot) sudah stabil di versi ini.
FROM node:24-slim

WORKDIR /app

# Install dependencies dulu agar layer cache efektif.
# Pakai `npm install` (bukan `npm ci`) karena package-lock.json
# tidak di-commit ke repo.
COPY package.json ./
RUN npm install --omit=dev

# Salin source code (file rahasia seperti .env dikecualikan .dockerignore;
# env di-inject via env_file di docker-compose).
COPY index.js ./
COPY public ./public

# Folder data untuk SQLite (di-mount sebagai named volume di compose).
RUN mkdir -p /app/data
ENV DB_PATH=/app/data/chat.db

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "index.js"]
