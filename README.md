# 🛒 Lazada Checker — Backend (Deploy GRATIS ke Render.com)

Backend ini menjalankan Playwright + Chromium untuk cek akun Lazada.
Di-host GRATIS di Render.com (tidur saat idle = tanpa biaya, tanpa PC nyala).

## 📦 Isi folder
- server.js      → backend (route: POST /api/lazada/check)
- Dockerfile     → image Playwright + Chromium
- package.json   → dependency
- .gitignore / .dockerignore

---

## 🚀 LANGKAH DEPLOY (sekali setup, ~10 menit)

### 1) Upload ke GitHub
a. Buka https://github.com/new → buat repo baru (mis. `laz-checker-backend`), set **Private**, klik Create.
b. Upload semua file di folder ini ke repo:
   - Cara mudah: di halaman repo klik **"uploading an existing file"** → drag semua file (server.js, Dockerfile, package.json, .gitignore, .dockerignore) → Commit.

### 2) Buat Web Service di Render
a. Buka https://render.com → Sign up / login (bisa pakai akun GitHub).
b. Klik **New +** → **Web Service**.
c. Connect repo GitHub `laz-checker-backend` (izinkan akses jika diminta).
d. Isi pengaturan:
   - **Name**: laz-checker-backend (bebas)
   - **Region**: Singapore (terdekat)
   - **Runtime / Language**: pilih **Docker** (Render otomatis baca Dockerfile)
   - **Instance Type**: **Free**
e. Klik **Create Web Service**. Tunggu build selesai (~5-8 menit pertama kali).
f. Setelah "Live", salin URL-nya, mis: `https://laz-checker-backend.onrender.com`

### 3) Hubungkan ke situs (Cloudflare)
a. Buka https://dash.cloudflare.com → **Workers & Pages** → project **gamail-tools**.
b. Masuk **Settings** → **Environment variables** (Variables).
c. Tambah variable:
   - **Name**: `LAZ_API_URL`
   - **Value**: URL Render kamu (mis. `https://laz-checker-backend.onrender.com`)  ← TANPA garis miring di akhir
d. **Save** → lalu **Retry deployment / Redeploy** (atau tunggu deploy berikutnya).

### 4) Selesai! Tes
Buka https://gamail.my.id/laz-checker
- Isi akun + proxy DataImpulse (residensial Indonesia) → centang Pakai Proxy
- Klik **Mulai Cek**
- ⚠️ Request PERTAMA setelah idle butuh ~30-50 detik (Render cold-start "bangun"). Setelah itu cepat.

---

## 🔑 Catatan penting
- **WAJIB pakai proxy residensial Indonesia** (DataImpulse). Tanpa itu, IP datacenter Render → kena captcha (masuk bucket "Kena Captcha").
- Free tier Render: 750 jam/bulan, tidur setelah ~15 menit idle (otomatis bangun saat ada request).
- Backend ini TIDAK menyajikan halaman — halaman tetap dari Cloudflare. Backend hanya endpoint /api/lazada/check.

## 🧪 Tes manual backend (opsional, via PowerShell)
```
curl -X POST https://NAMAMU.onrender.com/api/lazada/check -H "Content-Type: application/json" -d '{"uid":"628xxx","password":"xxx","useProxy":true,"proxy":"http://user:pass@gw.dataimpulse.com:823"}'
```
