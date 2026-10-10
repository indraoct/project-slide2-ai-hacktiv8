# mirror-slide2 — Gemini Flash API

RESTful API dengan ExpressJS yang terintegrasi dengan **Google Gemini 2.5 Flash** untuk menghasilkan respons dari berbagai tipe input: teks, gambar, dokumen, dan audio.

Berdasarkan materi Sesi 2 — Eksplorasi Gemini AI API.

## Setup

```bash
npm install
```

Buat file `.env`:

```env
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-2.5-flash
PORT=3000
```

## Menjalankan

```bash
npm start
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
