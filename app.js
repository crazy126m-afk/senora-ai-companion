/**
 * SENORA 2.0 - Autonomous Voice AI Companion
 * GPT-4o Brain & True Edge Neural Female Voice Engine
 */

const SenoraState = {
  isListening: false,
  isSpeaking: false,
  continuousLoopActive: true,
  wakeLock: null,
  currentAudioPlayer: null,
  activeVoice: 'hi-IN-SwaraNeural',
  chatHistory: [],
  alarms: [
    { id: '1', time: '07:00', label: 'Morning Wakeup', enabled: true }
  ]
};

// ==========================================
// 1. SCREEN WAKE-LOCK (PHONE KEEP-AWAKE)
// ==========================================
async function toggleScreenWakeLock() {
  const btn = document.getElementById('wakeLockBtn');
  if ('wakeLock' in navigator) {
    try {
      if (!SenoraState.wakeLock) {
        SenoraState.wakeLock = await navigator.wakeLock.request('screen');
        btn.textContent = 'Screen Kept Awake ✓';
        btn.style.background = '#10b981';
      } else {
        await SenoraState.wakeLock.release();
        SenoraState.wakeLock = null;
        btn.textContent = 'Keep Screen Awake';
        btn.style.background = 'var(--accent-pink)';
      }
    } catch (err) {
      console.log('WakeLock error:', err);
    }
  }
}

// Auto wake-lock on first user interaction
window.addEventListener('click', () => {
  if (!SenoraState.wakeLock && 'wakeLock' in navigator) {
    navigator.wakeLock.request('screen').then(wl => {
      SenoraState.wakeLock = wl;
      const btn = document.getElementById('wakeLockBtn');
      if (btn) {
        btn.textContent = 'Screen Kept Awake ✓';
        btn.style.background = '#10b981';
      }
    }).catch(() => {});
  }
}, { once: true });

// ==========================================
// 2. ZERO-TAP CONTINUOUS LISTENING ENGINE
// ==========================================
const SpeechEngine = {
  recognition: null,
  sttRestartTimer: null,

  initSTT() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported in this browser.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'hi-IN'; // Recognizes Hindi + English smoothly

    this.recognition.onstart = () => {
      SenoraState.isListening = true;
      updateVisualState('Senora is listening... Bas bolo!', true);
    };

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript && transcript.trim()) {
        handleUserSpeech(transcript.trim());
      }
    };

    this.recognition.onerror = () => {
      this.safeRestartSTT(500);
    };

    this.recognition.onend = () => {
      SenoraState.isListening = false;
      if (SenoraState.continuousLoopActive && !SenoraState.isSpeaking) {
        this.safeRestartSTT(400);
      }
    };

    this.safeRestartSTT(500);
  },

  safeRestartSTT(delay = 400) {
    if (this.sttRestartTimer) clearTimeout(this.sttRestartTimer);
    if (SenoraState.isSpeaking) return;

    this.sttRestartTimer = setTimeout(() => {
      if (this.recognition && !SenoraState.isSpeaking && !SenoraState.isListening) {
        try {
          this.recognition.start();
        } catch (e) {}
      }
    }, delay);
  },

  // Play Pure Edge Neural Female Voice
  speak(text, onComplete) {
    if (!text || !text.trim()) {
      if (onComplete) onComplete();
      return;
    }

    // Pause recognition while speaking so she doesn't hear herself
    if (this.recognition && SenoraState.isListening) {
      try { this.recognition.stop(); } catch (e) {}
    }

    // Stop any existing playing audio
    if (SenoraState.currentAudioPlayer) {
      try {
        SenoraState.currentAudioPlayer.pause();
        SenoraState.currentAudioPlayer = null;
      } catch (e) {}
    }

    // Clean text: strip action tags and markdown symbols
    const cleanSpeech = text.replace(/\[ACTION:[^\]]+\]/g, '').replace(/[*_#`~[\]]/g, '').trim();

    const ttsUrl = `/api/tts?text=${encodeURIComponent(cleanSpeech)}&voice=${encodeURIComponent(SenoraState.activeVoice)}`;
    const audio = new Audio(ttsUrl);
    SenoraState.currentAudioPlayer = audio;

    audio.onplay = () => {
      SenoraState.isSpeaking = true;
      updateVisualState('Senora is speaking...', false);
    };

    audio.onended = () => {
      SenoraState.isSpeaking = false;
      SenoraState.currentAudioPlayer = null;
      updateVisualState('Senora is listening... Bas bolo!', true);
      if (onComplete) onComplete();

      // Zero-Tap: immediately listen again!
      if (SenoraState.continuousLoopActive) {
        this.safeRestartSTT(300);
      }
    };

    audio.onerror = (e) => {
      console.warn('TTS playback error, falling back to local synthesis', e);
      this.fallbackBrowserSpeech(cleanSpeech, onComplete);
    };

    audio.play().catch(err => {
      console.warn('Audio play blocked:', err);
      this.fallbackBrowserSpeech(cleanSpeech, onComplete);
    });
  },

  fallbackBrowserSpeech(cleanText, onComplete) {
    if (!window.speechSynthesis) {
      if (onComplete) onComplete();
      return;
    }
    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.pitch = 1.15;
    utter.rate = 0.96;
    utter.onstart = () => {
      SenoraState.isSpeaking = true;
      updateVisualState('Senora is speaking...', false);
    };
    utter.onend = () => {
      SenoraState.isSpeaking = false;
      updateVisualState('Senora is listening... Bas bolo!', true);
      if (onComplete) onComplete();
      if (SenoraState.continuousLoopActive) {
        this.safeRestartSTT(300);
      }
    };
    window.speechSynthesis.speak(utter);
  }
};

function updateVisualState(label, listening) {
  const lbl = document.getElementById('orbStateText');
  const pill = document.getElementById('listeningPillLabel');
  const micBtn = document.getElementById('micBtn');

  if (lbl) lbl.textContent = label;
  if (pill) pill.textContent = listening ? 'Listening' : 'Speaking';
  if (micBtn) {
    if (listening) micBtn.classList.add('listening');
    else micBtn.classList.remove('listening');
  }
}

// ==========================================
// 3. GPT-4o BRAIN INTELLIGENCE & ACTION PARSING
// ==========================================
async function handleUserSpeech(userText) {
  if (!userText || !userText.trim()) return;

  appendChatBubble('user', userText);
  updateVisualState('Senora is thinking...', false);

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: userText,
        history: SenoraState.chatHistory.slice(-6)
      })
    });

    const data = await res.json();
    const replyText = data.reply || 'Main sun rahi hoon, boliye!';

    // Store in history
    SenoraState.chatHistory.push({ role: 'user', content: userText });
    SenoraState.chatHistory.push({ role: 'assistant', content: replyText });

    // Parse and execute actions
    executeActionIfPresent(replyText);

    // Display and Speak
    const cleanDisplay = replyText.replace(/\[ACTION:[^\]]+\]/g, '').trim();
    appendChatBubble('senora', cleanDisplay);

    SpeechEngine.speak(cleanDisplay);
  } catch (err) {
    console.error('Brain Error:', err);
    const fallback = 'Main samajh gayi, par internet response thoda slow hai. Aap dobara poochhiye!';
    appendChatBubble('senora', fallback);
    SpeechEngine.speak(fallback);
  }
}

function executeActionIfPresent(text) {
  const match = text.match(/\[ACTION:([A-Z]+):([^\]]+)\]/);
  if (!match) return;

  const actionType = match[1];
  const payload = match[2].trim();

  if (actionType === 'CALL') {
    triggerHapticFeedback();
    window.location.href = `tel:${encodeURIComponent(payload)}`;
  } else if (actionType === 'WHATSAPP') {
    triggerHapticFeedback();
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(payload)}`, '_blank');
  } else if (actionType === 'ALARM') {
    triggerHapticFeedback();
    SenoraState.alarms.push({ id: Date.now().toString(), time: payload, label: 'Voice Alarm', enabled: true });
    renderAlarms();
  } else if (actionType === 'MAP') {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(payload)}`, '_blank');
  } else if (actionType === 'NOTE') {
    const notesArea = document.getElementById('voiceNotesArea');
    notesArea.value = (notesArea.value ? notesArea.value + '\n• ' : '• ') + payload;
  }
}

function appendChatBubble(sender, text) {
  const container = document.getElementById('chatFeed');
  if (!container) return;

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;

  const senderTag = sender === 'senora'
    ? '<div class="bubble-sender"><i class="fa-solid fa-sparkles"></i> Senora</div>'
    : '<div class="bubble-sender"><i class="fa-solid fa-user"></i> You</div>';

  bubble.innerHTML = `${senderTag}<span>${text}</span>`;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

// ==========================================
// 4. ANIMATED HOLOGRAPHIC ORB (CANVAS)
// ==========================================
const Orb = {
  canvas: null,
  ctx: null,
  time: 0,

  init() {
    this.canvas = document.getElementById('orbCanvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.render();
  },

  render() {
    requestAnimationFrame(() => this.render());
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    this.time += 0.04;
    const cx = width / 2;
    const cy = height / 2;

    let energy = 1.0;
    if (SenoraState.isListening) energy = 2.2;
    else if (SenoraState.isSpeaking) energy = 2.0;

    const baseRadius = 66 + Math.sin(this.time * 2) * (3.5 * energy);

    const halo = ctx.createRadialGradient(cx, cy, baseRadius * 0.4, cx, cy, baseRadius * 1.8);
    if (SenoraState.isListening) {
      halo.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
      halo.addColorStop(0.6, 'rgba(0, 242, 254, 0.2)');
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else {
      halo.addColorStop(0, 'rgba(255, 45, 117, 0.45)');
      halo.addColorStop(0.6, 'rgba(139, 92, 246, 0.25)');
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    }
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * 1.8, 0, Math.PI * 2);
    ctx.fill();

    for (let r = 0; r < 3; r++) {
      ctx.beginPath();
      const points = 70;
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const wave = Math.sin(angle * (4 + r) + this.time * 3 + r) * (6.5 * energy);
        const radius = baseRadius + wave + r * 10;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = r === 0 ? '#ff2d75' : (r === 1 ? '#00f2fe' : '#8b5cf6');
      ctx.lineWidth = 2.2;
      ctx.shadowBlur = 16;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    const coreGrad = ctx.createRadialGradient(cx - 15, cy - 15, 6, cx, cy, baseRadius);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.25, '#ff758c');
    coreGrad.addColorStop(0.8, '#d91b5c');
    coreGrad.addColorStop(1, '#0f172a');

    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * 0.72, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.shadowBlur = 24;
    ctx.shadowColor = '#ff2d75';
    ctx.fill();
    ctx.shadowBlur = 0;
  }
};

// ==========================================
// 5. PHONE ACTIONS
// ==========================================
function promptDirectCall() {
  const number = prompt('Enter Phone Number or Contact Name:');
  if (number) {
    triggerHapticFeedback();
    window.location.href = `tel:${encodeURIComponent(number)}`;
  }
}

function promptDirectWhatsApp() {
  const msg = prompt('Enter WhatsApp Message:');
  if (msg) {
    triggerHapticFeedback();
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  }
}

function promptNavigation() {
  const place = prompt('Enter Destination:');
  if (place) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`, '_blank');
  }
}

function triggerHapticFeedback() {
  if (navigator.vibrate) navigator.vibrate([70, 40, 70]);
}

function copyNotes() {
  const notes = document.getElementById('voiceNotesArea').value;
  if (!notes) return;
  navigator.clipboard.writeText(notes).then(() => {
    alert('Notes copied to clipboard!');
  });
}

function clearNotes() {
  document.getElementById('voiceNotesArea').value = '';
}

// ==========================================
// 6. STUDY ROADMAP LAB
// ==========================================
async function askAiRoadmap() {
  const input = document.getElementById('roadmapInput').value.trim();
  if (!input) return;

  const output = document.getElementById('roadmapOutput');
  output.textContent = 'Generating comprehensive roadmap with GPT-4o...';

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `Create an in-depth, inspiring, step-by-step practical study roadmap for: "${input}". Break it down into clear stages (Foundation, Core Mastery, Projects, Advanced). Use clean bullet points.`,
        history: []
      })
    });
    const data = await res.json();
    output.textContent = data.reply;
    SpeechEngine.speak(`Maine aapka ${input} ka roadmap generate kar diya hai.`);
  } catch (err) {
    output.textContent = 'Error generating roadmap. Please check internet connection.';
  }
}

// ==========================================
// 7. ALARMS & NAVIGATION
// ==========================================
function renderAlarms() {
  const list = document.getElementById('alarmsList');
  if (!list) return;
  list.innerHTML = '';

  SenoraState.alarms.forEach(alarm => {
    const item = document.createElement('div');
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.justifyContent = 'space-between';
    item.style.padding = '12px 16px';
    item.style.borderRadius = '14px';
    item.style.background = 'rgba(255, 255, 255, 0.04)';
    item.style.border = '1px solid var(--border-glass)';

    item.innerHTML = `
      <div>
        <div style="font-family: 'Outfit'; font-size: 20px; font-weight: 700; color: #fff;">${alarm.time}</div>
        <div style="font-size: 12px; color: var(--text-dim);">${alarm.label}</div>
      </div>
      <button style="background: transparent; border: none; color: #ef4444; cursor: pointer; padding: 4px;" onclick="deleteAlarm('${alarm.id}')">
        <i class="fa-solid fa-trash"></i>
      </button>
    `;
    list.appendChild(item);
  });
}

function addNewAlarm() {
  const time = document.getElementById('alarmTimeInput').value;
  const label = document.getElementById('alarmLabelInput').value.trim() || 'Custom Alarm';
  if (!time) return;
  SenoraState.alarms.push({ id: Date.now().toString(), time, label, enabled: true });
  renderAlarms();
  triggerHapticFeedback();
}

function deleteAlarm(id) {
  SenoraState.alarms = SenoraState.alarms.filter(a => a.id !== id);
  renderAlarms();
}

function switchPane(panelId, btnElement) {
  document.querySelectorAll('.view-panel').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.dock-item').forEach(b => b.classList.remove('active'));

  const target = document.getElementById(panelId);
  if (target) target.classList.add('active');
  if (btnElement) btnElement.classList.add('active');
}

function testNeuralVoice() {
  SpeechEngine.speak('Namaste! Main Senora hoon. Meri aawaz ab pure neural technology se generated hai. Kya aapko meri aawaz natural lag rahi hai?');
}

// ==========================================
// 8. DOM INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  SpeechEngine.initSTT();
  Orb.init();
  renderAlarms();

  const micBtn = document.getElementById('micBtn');
  micBtn.addEventListener('click', () => {
    if (SenoraState.isListening) {
      SpeechEngine.recognition.stop();
    } else {
      SpeechEngine.safeRestartSTT(0);
    }
  });

  const sendBtn = document.getElementById('sendTextBtn');
  const textInput = document.getElementById('textPromptInput');
  const submitText = () => {
    const val = textInput.value;
    if (val.trim()) {
      handleUserSpeech(val);
      textInput.value = '';
    }
  };

  sendBtn.addEventListener('click', submitText);
  textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitText();
  });

  const voiceSelect = document.getElementById('neuralVoiceSelect');
  if (voiceSelect) {
    voiceSelect.addEventListener('change', (e) => {
      SenoraState.activeVoice = e.target.value;
      testNeuralVoice();
    });
  }
});
