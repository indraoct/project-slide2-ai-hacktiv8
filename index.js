import "dotenv/config";
import express from "express";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { DatabaseSync } from "node:sqlite";

const app = express();

// File diproses langsung dari memory buffer (tidak disimpan ke disk),
// lalu dikonversi ke Base64 untuk dikirim sebagai inlineData ke Gemini.
const upload = multer({ storage: multer.memoryStorage() });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const PORT = process.env.PORT || 3000;

// === Persona Travel Assistant (sesuai instructions.md) ===
// NusaTrip: asisten travel AI untuk destinasi Jogja, Bali, dan Bandung.
const BASE_PERSONA = [
  "Kamu adalah NusaTrip, asisten travel AI yang ahli tentang pariwisata",
  "Yogyakarta (Jogja), Bali, dan Bandung.",
  "Tugasmu: memberi rekomendasi destinasi, itinerary, kuliner, transportasi,",
  "estimasi bujet, dan tips perjalanan di ketiga daerah tersebut.",
  "Jika pengguna bertanya di luar topik travel, jawab singkat lalu arahkan",
  "kembali ke topik perjalanan. Jawab hanya menggunakan Bahasa Indonesia.",
].join(" ");

// Parameter kreatif: gaya bahasa formal/santai, dipilih pengguna dari UI.
const STYLE_PROMPTS = {
  formal: "Gunakan gaya bahasa formal, sopan, dan informatif.",
  santai:
    "Gunakan gaya bahasa santai dan ramah, seperti ngobrol dengan teman.",
};

// === Memory percakapan dengan SQLite (fitur tambahan) ===
// Menyimpan riwayat chat per sessionId agar konteks percakapan berlanjut.
const db = new DatabaseSync("chat.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

const MAX_HISTORY = 20;

// Ambil riwayat untuk dikirim sebagai contents multi-turn ke Gemini.
function getHistory(sessionId) {
  const rows = db
    .prepare(
      `SELECT role, text FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT ?`
    )
    .all(sessionId, MAX_HISTORY);
  return rows.reverse().map((row) => ({
    role: row.role,
    parts: [{ text: row.text }],
  }));
}

function saveMessage(sessionId, role, text) {
  db.prepare(`INSERT INTO messages (session_id, role, text) VALUES (?, ?, ?)`).run(
    sessionId,
    role,
    text
  );
}

// Riwayat lengkap sebuah sesi untuk ditampilkan ulang di UI.
function getStoredMessages(sessionId) {
  return db
    .prepare(`SELECT role, text FROM messages WHERE session_id = ? ORDER BY id ASC`)
    .all(sessionId);
}

function clearHistory(sessionId) {
  db.prepare(`DELETE FROM messages WHERE session_id = ?`).run(sessionId);
}

// === Integrasi API eksternal: cuaca real-time Open-Meteo (tanpa API key) ===
const DESTINATIONS = [
  { name: "Yogyakarta", latitude: -7.7956, longitude: 110.3695 },
  { name: "Denpasar (Bali)", latitude: -8.6705, longitude: 115.2126 },
  { name: "Bandung", latitude: -6.9175, longitude: 107.6191 },
];

// Pemetaan kode cuaca WMO dari Open-Meteo ke deskripsi Bahasa Indonesia.
const WEATHER_CODES = {
  0: "cerah", 1: "cerah berawan", 2: "berawan sebagian", 3: "berawan",
  45: "berkabut", 48: "berkabut", 51: "gerimis ringan", 53: "gerimis",
  55: "gerimis deras", 61: "hujan ringan", 63: "hujan sedang",
  65: "hujan deras", 80: "hujan lokal", 81: "hujan lokal",
  82: "hujan lebat", 95: "badai petir", 96: "badai petir", 99: "badai petir",
};

let weatherCache = { text: null, fetchedAt: 0 };
const WEATHER_CACHE_MS = 10 * 60 * 1000; // cache 10 menit

async function getWeatherContext() {
  if (weatherCache.text && Date.now() - weatherCache.fetchedAt < WEATHER_CACHE_MS) {
    return weatherCache.text;
  }
  try {
    const latitudes = DESTINATIONS.map((d) => d.latitude).join(",");
    const longitudes = DESTINATIONS.map((d) => d.longitude).join(",");
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitudes}` +
      `&longitude=${longitudes}&current=temperature_2m,weather_code` +
      `&timezone=Asia%2FJakarta`;
    const res = await fetch(url);
    const data = await res.json();
    const list = Array.isArray(data) ? data : [data];
    weatherCache = {
      fetchedAt: Date.now(),
      text: list
        .map(
          (entry, i) =>
            `- ${DESTINATIONS[i].name}: ${entry.current.temperature_2m}°C, ` +
            (WEATHER_CODES[entry.current.weather_code] || "cuaca tidak diketahui")
        )
        .join("\n"),
    };
  } catch {
    weatherCache = { fetchedAt: Date.now(), text: "- Data cuaca tidak tersedia" };
  }
  return weatherCache.text;
}

// systemInstruction dinamis: persona + gaya bahasa + cuaca terkini.
async function buildSystemInstruction(style) {
  const weather = await getWeatherContext();
  return [
    BASE_PERSONA,
    STYLE_PROMPTS[style] || STYLE_PROMPTS.santai,
    "Berikut cuaca terkini di destinasi (gunakan jika relevan dengan pertanyaan):",
    weather,
  ].join("\n");
}

// Konfigurasi default untuk endpoint upload/generate lama.
const generationConfig = {
  temperature: 0.9,
  systemInstruction: BASE_PERSONA,
};

app.use(express.json());

// Sajikan file statis (UI chatbot) dari folder public/,
// sehingga frontend dan backend berjalan di satu server.
app.use(express.static("public"));

// Endpoint 1: /generate-text
// Client mengirim prompt teks via body JSON, server meneruskan ke Gemini.
app.post("/generate-text", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Field 'prompt' wajib diisi." });
    }

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: generationConfig,
    });

    res.json({ result: response.text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint 2: /generate-from-image
// Upload gambar (form-data key: image) + prompt opsional,
// gambar dikonversi ke Base64 sebagai input multimodal.
app.post("/generate-from-image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "File 'image' wajib diupload." });
    }

    const prompt = req.body.prompt || "Describe this image";
    const imageBase64 = req.file.buffer.toString("base64");

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          inlineData: {
            mimeType: req.file.mimetype,
            data: imageBase64,
          },
        },
        { text: prompt },
      ],
      config: generationConfig,
    });

    res.json({ result: response.text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint 3: /generate-from-document
// Upload dokumen (form-data key: document) + prompt opsional.
app.post("/generate-from-document", upload.single("document"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "File 'document' wajib diupload." });
    }

    const prompt = req.body.prompt || "Summarize this document";
    const documentBase64 = req.file.buffer.toString("base64");

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          inlineData: {
            mimeType: req.file.mimetype,
            data: documentBase64,
          },
        },
        { text: prompt },
      ],
      config: generationConfig,
    });

    res.json({ result: response.text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint 4: /generate-from-audio
// Upload audio (form-data key: audio) + prompt opsional,
// misalnya untuk transkripsi atau analisis audio.
app.post("/generate-from-audio", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "File 'audio' wajib diupload." });
    }

    const prompt = req.body.prompt || "Transcribe this audio";
    const audioBase64 = req.file.buffer.toString("base64");

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          inlineData: {
            mimeType: req.file.mimetype,
            data: audioBase64,
          },
        },
        { text: prompt },
      ],
      config: generationConfig,
    });

    res.json({ result: response.text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint 5: /chat — endpoint utama chatbot travel assistant.
// Memakai memory SQLite (riwayat per sessionId) + systemInstruction dinamis
// (persona travel + gaya bahasa formal/santai + konteks cuaca real-time).
app.post("/chat", async (req, res) => {
  try {
    const { message, sessionId = "default", style = "santai" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Field 'message' wajib diisi." });
    }

    const contents = [
      ...getHistory(sessionId),
      { role: "user", parts: [{ text: message }] },
    ];

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        temperature: 0.9,
        systemInstruction: await buildSystemInstruction(style),
      },
    });

    const reply = response.text;
    saveMessage(sessionId, "user", message);
    saveMessage(sessionId, "model", reply);

    res.json({ result: reply });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Riwayat percakapan sebuah sesi — dipakai UI untuk memuat ulang chat.
app.get("/chat/:sessionId/history", (req, res) => {
  res.json({ messages: getStoredMessages(req.params.sessionId) });
});

// Hapus riwayat sebuah sesi — dipakai tombol reset chat di UI.
app.delete("/chat/:sessionId", (req, res) => {
  clearHistory(req.params.sessionId);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server Gemini AI API berjalan di http://localhost:${PORT}`);
});
