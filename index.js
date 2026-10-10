import "dotenv/config";
import express from "express";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";

const app = express();

// File diproses langsung dari memory buffer (tidak disimpan ke disk),
// lalu dikonversi ke Base64 untuk dikirim sebagai inlineData ke Gemini.
const upload = multer({ storage: multer.memoryStorage() });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const PORT = process.env.PORT || 3000;

app.use(express.json());

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
    });

    res.json({ result: response.text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server Gemini AI API berjalan di http://localhost:${PORT}`);
});
