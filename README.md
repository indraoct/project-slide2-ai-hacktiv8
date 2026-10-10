# project-slide2-ai-hacktiv8

RESTful API dengan ExpressJS yang terintegrasi dengan **Google Gemini API** (model default: `gemini-3.8-flash`) untuk menghasilkan respons dari berbagai tipe input: teks, gambar, dokumen, dan audio.

Berdasarkan materi Sesi 2 — Eksplorasi Gemini AI API.

## Persiapan Awal (Checklist)

Sebelum menjalankan aplikasi, pastikan sudah tersedia:

- **Node.js v18+** — cek dengan `node --version` ([panduan instalasi](https://nodejs.org/))
- **Akun Google** — untuk mengakses Google AI Studio dan membuat API key
- **Gemini API key** — lihat langkah di bawah
- **VS Code** (atau code editor lain)
- **Postman** (atau `curl`) — untuk menguji API
- **Aset uji coba** (opsional) — file gambar, dokumen, dan audio untuk mengetes endpoint upload

## Cara Membuat Gemini API Key

1. Buka **Google AI Studio**: https://aistudio.google.com/api-keys
2. Login dengan akun Google kamu.
3. Klik tombol **"Create API Key"**.
4. Pilih project Google Cloud yang ada (atau buat baru jika diminta).
5. **Salin API key** yang dihasilkan — simpan baik-baik, key ini rahasia dan tidak boleh di-commit ke repository.
6. Masukkan key tersebut ke file `.env` (lihat bagian Konfigurasi).

> API key gratis tersedia melalui free tier dengan rate limit tertentu. Dokumentasi: https://ai.google.dev/gemini-api/docs

## Instalasi

```bash
git clone https://github.com/indraoct/project-slide2-ai-hacktiv8.git
cd project-slide2-ai-hacktiv8
npm install
```

## Konfigurasi

Buat file `.env` di root project:

```env
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-3.8-flash
PORT=3000
```

> `.env` sudah terdaftar di `.gitignore` — jangan pernah commit file ini karena berisi API key rahasia.

## Menjalankan

```bash
npm start
```

atau mode auto-reload saat development:

```bash
npm run dev
```

Server berjalan di `http://localhost:3000`.

## Endpoints

### POST /generate-text

Body — raw JSON:

```json
{ "prompt": "Explain how AI works in a few words" }
```

### POST /generate-from-image

Body — form-data:

- **image** (File): `.png`, `.jpg`, dll.
- **prompt** (Text, opsional): mis. `Describe this image`

### POST /generate-from-document

Body — form-data:

- **document** (File): `.pdf`, `.txt`, dll.
- **prompt** (Text, opsional): mis. `Summarize this document`

### POST /generate-from-audio

Body — form-data:

- **audio** (File): `.mp3`, `.wav`, dll.
- **prompt** (Text, opsional): mis. `Transcribe this audio`

## Catatan

File yang diupload diproses dari memory buffer (via `multer`), dikonversi ke Base64, dan dikirim ke Gemini sebagai `inlineData` — tanpa penyimpanan ke disk.
