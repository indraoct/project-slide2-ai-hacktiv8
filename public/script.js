const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const fileInput = document.getElementById('file-input');
const attachBtn = document.getElementById('attach-btn');
const filePreview = document.getElementById('file-preview');
const fileName = document.getElementById('file-name');
const removeFileBtn = document.getElementById('remove-file');
const sendBtn = document.getElementById('send-btn');
const styleSelect = document.getElementById('style-select');
const resetBtn = document.getElementById('reset-btn');

let attachedFile = null;

// sessionId disimpan di localStorage agar memory percakapan (SQLite di
// backend) tetap nyambung meskipun halaman di-refresh.
let sessionId = localStorage.getItem('nusatrip-session');
if (!sessionId) {
  sessionId = crypto.randomUUID();
  localStorage.setItem('nusatrip-session', sessionId);
}

// Muat riwayat percakapan dari backend saat halaman dibuka.
async function loadHistory() {
  try {
    const res = await fetch(`/chat/${sessionId}/history`);
    const data = await res.json();
    (data.messages || []).forEach((m) => {
      appendMessage(m.role === 'user' ? 'user' : 'bot', m.text);
    });
  } catch {
    // Abaikan — server mungkin belum punya riwayat.
  }
  if (!chatBox.children.length) {
    appendMessage(
      'bot',
      'Halo! Aku NusaTrip 🌴 Mau liburan ke Jogja, Bali, atau Bandung? ' +
        'Tanya apa aja — itinerary, kuliner, bujet, sampai cuaca terkini.'
    );
  }
}
loadHistory();

// Pilih endpoint backend berdasarkan tipe file yang dilampirkan.
function getEndpointForFile(file) {
  if (file.type.startsWith('image/')) {
    return { url: '/generate-from-image', field: 'image' };
  }
  if (file.type.startsWith('audio/')) {
    return { url: '/generate-from-audio', field: 'audio' };
  }
  return { url: '/generate-from-document', field: 'document' };
}

attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  attachedFile = fileInput.files[0] || null;
  if (attachedFile) {
    fileName.textContent = attachedFile.name;
    filePreview.classList.remove('hidden');
  }
});

removeFileBtn.addEventListener('click', () => {
  attachedFile = null;
  fileInput.value = '';
  filePreview.classList.add('hidden');
});

// Suggestion chips: klik untuk langsung mengirim pertanyaan.
document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    input.value = chip.textContent;
    form.requestSubmit();
  });
});

// Reset: hapus riwayat di backend, buat sessionId baru, bersihkan UI.
resetBtn.addEventListener('click', async () => {
  try {
    await fetch(`/chat/${sessionId}`, { method: 'DELETE' });
  } catch {
    // Abaikan error — tetap reset sisi client.
  }
  sessionId = crypto.randomUUID();
  localStorage.setItem('nusatrip-session', sessionId);
  chatBox.innerHTML = '';
  loadHistory();
});

form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const userMessage = input.value.trim();
  if (!userMessage && !attachedFile) return;

  // Tampilkan pesan user (beserta nama file jika ada lampiran).
  const label = attachedFile ? `${userMessage ? userMessage + '\n' : ''}📎 ${attachedFile.name}` : userMessage;
  appendMessage('user', label);

  // Tampilkan preview gambar jika yang diupload adalah gambar.
  if (attachedFile && attachedFile.type.startsWith('image/')) {
    appendImage('user', attachedFile);
  }

  input.value = '';
  setLoading(true);
  const loadingMsg = appendMessage('bot', 'NusaTrip sedang berpikir...', 'loading');

  try {
    let response;

    if (attachedFile) {
      // Kirim file via multipart/form-data ke endpoint yang sesuai.
      const { url, field } = getEndpointForFile(attachedFile);
      const formData = new FormData();
      formData.append(field, attachedFile);
      if (userMessage) formData.append('prompt', userMessage);

      response = await fetch(url, { method: 'POST', body: formData });
    } else {
      // Kirim pesan ke /chat — dengan sessionId (memory) dan gaya bahasa.
      response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          sessionId,
          style: styleSelect.value,
        }),
      });
    }

    const data = await response.json();
    loadingMsg.remove();

    if (!response.ok) {
      appendMessage('bot', `Error: ${data.error || 'Terjadi kesalahan pada server.'}`, 'error');
    } else {
      appendMessage('bot', data.result || '(Tidak ada respons)');
    }
  } catch (error) {
    loadingMsg.remove();
    appendMessage('bot', `Error: ${error.message}`, 'error');
  } finally {
    setLoading(false);
    attachedFile = null;
    fileInput.value = '';
    filePreview.classList.add('hidden');
  }
});

function appendMessage(sender, text, extraClass) {
  const msg = document.createElement('div');
  msg.classList.add('message', sender);
  if (extraClass) msg.classList.add(extraClass);
  msg.textContent = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
  return msg;
}

function appendImage(sender, file) {
  const msg = document.createElement('div');
  msg.classList.add('message', sender);
  const img = document.createElement('img');
  img.classList.add('attachment');
  img.src = URL.createObjectURL(file);
  msg.appendChild(img);
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function setLoading(isLoading) {
  sendBtn.disabled = isLoading;
  attachBtn.disabled = isLoading;
  input.disabled = isLoading;
}
