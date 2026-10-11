const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const fileInput = document.getElementById('file-input');
const attachBtn = document.getElementById('attach-btn');
const filePreview = document.getElementById('file-preview');
const fileName = document.getElementById('file-name');
const removeFileBtn = document.getElementById('remove-file');
const sendBtn = document.getElementById('send-btn');

let attachedFile = null;

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
  const loadingMsg = appendMessage('bot', 'Gemini is thinking...', 'loading');

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
      // Kirim teks via JSON ke endpoint /generate-text.
      response = await fetch('/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMessage }),
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
