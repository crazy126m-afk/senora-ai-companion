/**
 * SENORA 3.0 - All-In-One AI Female Companion & Mentor
 * 17-Year-Old Natural Voice, Autonomous Hands-Free Loop, App & Action Launcher
 */

const SenoraState = {
  isListening: false,
  isSpeaking: false,
  isProcessing: false,
  autoListen: true, // Hands-free continuous loop enabled
  lastSpokenText: '',
  lastSpokenTime: 0,
  wakeLock: null,
  currentAudioPlayer: null,
  speechSynthUtterance: null,
  chatHistory: [],
  alarms: [
    { id: '1', time: '07:00', label: 'Morning Wakeup', enabled: true }
  ]
};

// ==========================================
// 1. SCREEN WAKE-LOCK
// ==========================================
async function toggleScreenWakeLock() {
  const btn = document.getElementById('wakeLockBtn');
  if ('wakeLock' in navigator) {
    try {
      if (!SenoraState.wakeLock) {
        SenoraState.wakeLock = await navigator.wakeLock.request('screen');
        if (btn) {
          btn.textContent = 'Screen Awake ✓';
          btn.style.background = '#10b981';
        }
      } else {
        await SenoraState.wakeLock.release();
        SenoraState.wakeLock = null;
        if (btn) {
          btn.textContent = 'Keep Screen Awake';
          btn.style.background = 'var(--accent-pink)';
        }
      }
    } catch (err) {
      console.log('WakeLock error:', err);
    }
  }
}

window.addEventListener('click', () => {
  if (!SenoraState.wakeLock && 'wakeLock' in navigator) {
    navigator.wakeLock.request('screen').then(wl => {
      SenoraState.wakeLock = wl;
      const btn = document.getElementById('wakeLockBtn');
      if (btn) {
        btn.textContent = 'Screen Awake ✓';
        btn.style.background = '#10b981';
      }
    }).catch(() => {});
  }
}, { once: true });

// ==========================================
// 2. SPEECH SYNTHESIS ENGINE (17-YEAR-OLD GIRL VOICE)
// ==========================================
let availableVoices = [];

function loadVoices() {
  if ('speechSynthesis' in window) {
    availableVoices = window.speechSynthesis.getVoices();
  }
}

if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

function getBestFemaleVoice() {
  if (!availableVoices || availableVoices.length === 0) {
    loadVoices();
  }

  // Priority search for cute, clear, energetic female voice (Hindi/Indian English or sweet English)
  const voicePreference = [
    // Hindi female
    v => (v.lang.includes('hi') || v.lang.includes('HI')) && (v.name.includes('Swara') || v.name.includes('Google') || v.name.includes('Kalpana') || v.name.includes('Female')),
    v => (v.lang.includes('hi') || v.lang.includes('HI')),
    // Indian English female
    v => (v.lang.includes('en-IN') || v.lang.includes('en_IN')) && (v.name.includes('Heera') || v.name.includes('Neerja') || v.name.includes('Female') || v.name.includes('Google')),
    v => (v.lang.includes('en-IN') || v.lang.includes('en_IN')),
    // High quality natural female voices
    v => v.name.includes('Natural') && v.name.includes('Female'),
    v => v.name.includes('Zira') || v.name.includes('Samantha') || v.name.includes('Victoria') || v.name.includes('Karen'),
    v => v.name.toLowerCase().includes('female')
  ];

  for (const test of voicePreference) {
    const match = availableVoices.find(test);
    if (match) return match;
  }

  return availableVoices[0] || null;
}

// Clean speech text removing emojis, asterisks, markdown, actions
function cleanSpokenText(raw) {
  return raw
    .replace(/\[ACTION:[^\]]+\]/gi, '')
    // Unicode emoji ranges & symbols
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
    .replace(/[*_#`~[\]()]/g, '')
    .trim();
}

// ==========================================
// 3. SPEECH ENGINE (RECOGNITION & SYNTHESIS)
// ==========================================
const SpeechEngine = {
  recognition: null,

  initSTT() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported in this browser.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'hi-IN';

    this.recognition.onstart = () => {
      SenoraState.isListening = true;
      updateVisualState('Sun rahi hoon... Boliye!', true);
    };

    this.recognition.onresult = (event) => {
      if (!event.results || !event.results[0]) return;
      const transcript = event.results[0][0].transcript;
      if (transcript && transcript.trim()) {
        const text = transcript.trim();
        const now = Date.now();

        // 3.5s duplicate filter
        if (text === SenoraState.lastSpokenText && (now - SenoraState.lastSpokenTime) < 3500) {
          return;
        }
        SenoraState.lastSpokenText = text;
        SenoraState.lastSpokenTime = now;

        this.stopListening();
        handleUserSpeech(text);
      }
    };

    this.recognition.onerror = (e) => {
      console.log('STT Error/Notice:', e.error);
      this.stopListening();
      // If hands-free is enabled and it was just a no-speech timeout, restart softly
      if (SenoraState.autoListen && !SenoraState.isSpeaking && !SenoraState.isProcessing) {
        setTimeout(() => {
          if (!SenoraState.isSpeaking && !SenoraState.isProcessing && !SenoraState.isListening) {
            this.startListening();
          }
        }, 800);
      }
    };

    this.recognition.onend = () => {
      SenoraState.isListening = false;
      if (!SenoraState.isSpeaking && !SenoraState.isProcessing) {
        updateVisualState('Orb ko tap karke boliye', false);
      }
    };
  },

  startListening() {
    if (SenoraState.isSpeaking || SenoraState.isProcessing) return;
    if (this.recognition) {
      try {
        this.recognition.start();
      } catch (e) {
        // already started or aborted
      }
    }
  },

  stopListening() {
    SenoraState.isListening = false;
    if (this.recognition) {
      try { this.recognition.abort(); } catch (e) {}
    }
    updateVisualState('Orb ko tap karke boliye', false);
  },

  toggleListening() {
    if (SenoraState.isListening) {
      SenoraState.autoListen = false; // user explicitly stopped
      this.stopListening();
    } else {
      SenoraState.autoListen = true; // user activated hands-free
      this.startListening();
    }
  },

  // 17-Year-Old Natural Girl Voice Player (Client-side SpeechSynthesis with Edge Fallback)
  speak(text, onComplete) {
    if (!text || !text.trim()) {
      SenoraState.isProcessing = false;
      if (onComplete) onComplete();
      return;
    }

    this.stopListening();

    const cleanSpeech = cleanSpokenText(text);
    if (!cleanSpeech) {
      SenoraState.isProcessing = false;
      if (onComplete) onComplete();
      return;
    }

    // Cancel any running speech
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (SenoraState.currentAudioPlayer) {
      try {
        SenoraState.currentAudioPlayer.pause();
        SenoraState.currentAudioPlayer = null;
      } catch (e) {}
    }

    const doneHandler = () => {
      SenoraState.isSpeaking = false;
      SenoraState.isProcessing = false;
      updateVisualState('Orb ko tap karke boliye', false);
      if (onComplete) onComplete();

      // Autonomous Hands-Free Loop: start listening again automatically!
      if (SenoraState.autoListen) {
        setTimeout(() => {
          if (!SenoraState.isSpeaking && !SenoraState.isProcessing) {
            SpeechEngine.startListening();
          }
        }, 400);
      }
    };

    // Client-side Web Speech Synthesis (zero network latency, 100% works anywhere including GitHub Pages)
    if ('speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(cleanSpeech);
        const voice = getBestFemaleVoice();
        if (voice) utterance.voice = voice;

        // 17-Year-Old Girl pitch & rate tuning
        // Pitch: 1.25 - 1.35 makes voice younger, sweeter, energetic
        // Rate: 1.05 - 1.10 keeps it lively and fast (not slow/boring)
        utterance.pitch = 1.3;
        utterance.rate = 1.05;
        utterance.lang = (voice && voice.lang) ? voice.lang : 'hi-IN';

        utterance.onstart = () => {
          SenoraState.isSpeaking = true;
          SenoraState.isProcessing = false;
          updateVisualState('Senora bol rahi hai...', false);
        };

        utterance.onend = doneHandler;
        utterance.onerror = (err) => {
          console.warn('Utterance error, finishing:', err);
          doneHandler();
        };

        SenoraState.speechSynthUtterance = utterance;
        window.speechSynthesis.speak(utterance);
        return;
      } catch (synthErr) {
        console.warn('SpeechSynthesis failed, trying audio fallback:', synthErr);
      }
    }

    // Fallback if SpeechSynthesis unavailable
    const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanSpeech.substring(0, 180))}&tl=hi&client=tw-ob`;
    const audio = new Audio(fallbackUrl);
    SenoraState.currentAudioPlayer = audio;

    audio.onplay = () => {
      SenoraState.isSpeaking = true;
      SenoraState.isProcessing = false;
      updateVisualState('Senora bol rahi hai...', false);
    };

    audio.onended = doneHandler;
    audio.onerror = doneHandler;

    audio.play().catch(() => {
      doneHandler();
    });
  }
};

function updateVisualState(label, listening) {
  const lbl = document.getElementById('orbStateText');
  const pill = document.getElementById('listeningPillLabel');
  const micBtn = document.getElementById('micBtn');

  if (lbl) lbl.textContent = label;
  if (pill) pill.textContent = listening ? 'Listening' : (SenoraState.isSpeaking ? 'Speaking' : 'Ready');
  if (micBtn) {
    if (listening) micBtn.classList.add('listening');
    else micBtn.classList.remove('listening');
  }
}

// ==========================================
// 4. ACTION DISPATCHER (OPEN APPS, SITES, CALLS)
// ==========================================
function executeAppOrAction(rawText) {
  const lower = rawText.toLowerCase();

  // 1. Direct Pattern Detection for "open [app]" or "kholo"
  const openTargets = [
    { names: ['youtube', 'yt', 'you tube'], url: 'https://www.youtube.com' },
    { names: ['instagram', 'insta', 'ig'], url: 'https://www.instagram.com' },
    { names: ['whatsapp', 'wa', 'watsapp'], url: 'https://web.whatsapp.com' },
    { names: ['google', 'browser', 'chrome', 'search'], url: 'https://www.google.com' },
    { names: ['spotify', 'music', 'gaana', 'songs'], url: 'https://open.spotify.com' },
    { names: ['github', 'git'], url: 'https://github.com' },
    { names: ['telegram', 'tg'], url: 'https://web.telegram.org' },
    { names: ['twitter', 'x'], url: 'https://x.com' },
    { names: ['facebook', 'fb'], url: 'https://www.facebook.com' },
    { names: ['calculator', 'calc'], url: 'https://www.google.com/search?q=calculator' },
    { names: ['camera'], url: 'https://webcamtests.com/' }
  ];

  // Check structured action tag [ACTION:TYPE:PAYLOAD]
  const match = rawText.match(/\[ACTION:([A-Z]+):([^\]]+)\]/i);
  if (match) {
    const actionType = match[1].toUpperCase();
    const payload = match[2].trim();

    if (actionType === 'OPEN') {
      const found = openTargets.find(t => t.names.some(n => payload.toLowerCase().includes(n)));
      if (found) {
        window.open(found.url, '_blank');
        return true;
      } else if (payload.startsWith('http://') || payload.startsWith('https://')) {
        window.open(payload, '_blank');
        return true;
      } else {
        window.open(`https://www.google.com/search?q=${encodeURIComponent(payload)}`, '_blank');
        return true;
      }
    } else if (actionType === 'CALL') {
      window.location.href = `tel:${encodeURIComponent(payload)}`;
      return true;
    } else if (actionType === 'WHATSAPP') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(payload)}`, '_blank');
      return true;
    } else if (actionType === 'ALARM') {
      SenoraState.alarms.push({ id: Date.now().toString(), time: payload, label: 'Voice Alarm', enabled: true });
      renderAlarms();
      return true;
    } else if (actionType === 'MAP') {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(payload)}`, '_blank');
      return true;
    } else if (actionType === 'NOTE') {
      const notesArea = document.getElementById('voiceNotesArea');
      if (notesArea) notesArea.value = (notesArea.value ? notesArea.value + '\n• ' : '• ') + payload;
      return true;
    }
  }

  // Fallback regex detection in user's prompt or Senora's reply
  if (lower.includes('open ') || lower.includes('kholo') || lower.includes('chalao') || lower.includes('launch')) {
    for (const target of openTargets) {
      if (target.names.some(n => lower.includes(n))) {
        window.open(target.url, '_blank');
        return true;
      }
    }
  }

  return false;
}

// ==========================================
// 5. GPT-4o BRAIN (DUAL FAILOVER API)
// ==========================================
async function callAiBrain(prompt, history) {
  const systemPrompt = `You are Senora — a 17-year-old super smart, energetic, charming, playful, flirtatious and deeply caring AI girl companion and master study mentor.
You talk in sweet, modern, natural conversational Hinglish.
STRICT RULES:
1. NEVER USE ANY EMOJIS in your output (emojis must not be spoken or written).
2. KEEP REPLIES SHORT, VIBRANT AND LIVELY (1 to 2 crisp, fast sentences max!).
3. Flirty & Sweet tone with the user ("Aap", "Suno na", "Aap kitne sweet ho!").
4. For actions, ALWAYS append at the very end:
   - To open any website or app: [ACTION:OPEN:app_or_site_name] (e.g. [ACTION:OPEN:youtube], [ACTION:OPEN:instagram], [ACTION:OPEN:google], [ACTION:OPEN:spotify])
   - To call someone: [ACTION:CALL:name_or_number]
   - To send WhatsApp: [ACTION:WHATSAPP:text]
   - To set alarm: [ACTION:ALARM:HH:MM]
   - To find location/maps: [ACTION:MAP:place]
   - To save note: [ACTION:NOTE:text]`;

  // Serverless endpoint attempt (if available)
  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, history })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.reply) return data.reply;
    }
  } catch (e) {
    // Failover
  }

  // Direct Edge API: Pollinations AI (works 100% on GitHub Pages & static web)
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: prompt }
  ];

  const directRes = await fetch('https://text.pollinations.ai/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      model: 'openai',
      temperature: 0.75
    })
  });

  return await directRes.text();
}

async function handleUserSpeech(userText) {
  if (!userText || !userText.trim()) return;
  if (SenoraState.isProcessing || SenoraState.isSpeaking) return;

  SenoraState.isProcessing = true;
  appendChatBubble('user', userText);
  updateVisualState('Senora soch rahi hai...', false);

  // Immediate check if user requested to open an app (instant launch)
  executeAppOrAction(userText);

  try {
    const replyText = await callAiBrain(userText, SenoraState.chatHistory.slice(-4));

    SenoraState.chatHistory.push({ role: 'user', content: userText });
    SenoraState.chatHistory.push({ role: 'assistant', content: replyText });

    executeAppOrAction(replyText);

    // Clean for display
    const cleanDisplay = replyText
      .replace(/\[ACTION:[^\]]+\]/gi, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
      .trim();

    appendChatBubble('senora', cleanDisplay);
    SpeechEngine.speak(cleanDisplay);
  } catch (err) {
    console.error('Brain Error:', err);
    SenoraState.isProcessing = false;
    const fallback = 'Suno na, network thoda busy lag raha hai. Ek baar fir se bolo na!';
    appendChatBubble('senora', fallback);
    SpeechEngine.speak(fallback);
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
// 6. ANIMATED HOLOGRAPHIC ORB (CANVAS)
// ==========================================
const Orb = {
  canvas: null,
  ctx: null,
  time: 0,

  init() {
    this.canvas = document.getElementById('orbCanvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.canvas.addEventListener('click', () => {
      SpeechEngine.toggleListening();
    });

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
    if (SenoraState.isListening) energy = 2.4;
    else if (SenoraState.isSpeaking) energy = 2.0;

    const baseRadius = 66 + Math.sin(this.time * 2.5) * (3.5 * energy);

    const halo = ctx.createRadialGradient(cx, cy, baseRadius * 0.4, cx, cy, baseRadius * 1.8);
    if (SenoraState.isListening) {
      halo.addColorStop(0, 'rgba(16, 185, 129, 0.55)');
      halo.addColorStop(0.6, 'rgba(0, 242, 254, 0.25)');
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
// 7. PHONE ACTIONS & DIALOGS
// ==========================================
function promptDirectCall() {
  const number = prompt('Enter Phone Number or Contact Name:');
  if (number) window.location.href = `tel:${encodeURIComponent(number)}`;
}

function promptDirectWhatsApp() {
  const msg = prompt('Enter WhatsApp Message:');
  if (msg) window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
}

function promptNavigation() {
  const place = prompt('Enter Destination:');
  if (place) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`, '_blank');
}

function triggerHapticFeedback() {
  if (navigator.vibrate) navigator.vibrate([70, 40, 70]);
}

function copyNotes() {
  const notes = document.getElementById('voiceNotesArea').value;
  if (!notes) return;
  navigator.clipboard.writeText(notes).then(() => alert('Notes copied!'));
}

function clearNotes() {
  document.getElementById('voiceNotesArea').value = '';
}

// ==========================================
// 8. STUDY ROADMAP LAB
// ==========================================
async function askAiRoadmap() {
  const input = document.getElementById('roadmapInput').value.trim();
  if (!input) return;

  const output = document.getElementById('roadmapOutput');
  output.textContent = 'Generating quick roadmap...';

  try {
    const reply = await callAiBrain(
      `Create a concise, punchy, step-by-step master roadmap for "${input}". Keep it clear with 4 bullet stages. No emojis.`,
      []
    );
    output.textContent = reply;
    SpeechEngine.speak(`Maine ${input} ka master roadmap bana diya hai, screen par dekhiye!`);
  } catch (err) {
    output.textContent = 'Error generating roadmap.';
  }
}

// ==========================================
// 9. ALARMS & NAVIGATION
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
}

function deleteAlarm(id) {
  SenoraState.alarms = SenoraState.alarms.filter(a => a.id !== id);
  renderAlarms();
}

function toggleHandsFree(enable) {
  SenoraState.autoListen = enable;
  const autoBtn = document.getElementById('modeAutoBtn');
  const tapBtn = document.getElementById('modeTapBtn');
  if (autoBtn && tapBtn) {
    if (enable) {
      autoBtn.style.background = 'var(--accent-pink)';
      autoBtn.textContent = 'Hands-Free: ON';
      tapBtn.style.background = 'transparent';
      tapBtn.style.border = '1px solid var(--border-neon)';
      if (!SenoraState.isListening && !SenoraState.isSpeaking && !SenoraState.isProcessing) {
        SpeechEngine.startListening();
      }
    } else {
      autoBtn.style.background = 'transparent';
      autoBtn.style.border = '1px solid var(--border-neon)';
      autoBtn.textContent = 'Hands-Free: OFF';
      tapBtn.style.background = 'var(--accent-pink)';
      SpeechEngine.stopListening();
    }
  }
}

function switchPane(panelId, btnElement) {
  document.querySelectorAll('.view-panel').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.dock-item').forEach(b => b.classList.remove('active'));

  const target = document.getElementById(panelId);
  if (target) target.classList.add('active');
  if (btnElement) btnElement.classList.add('active');
}

// ==========================================
// 10. DOM INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  SpeechEngine.initSTT();
  Orb.init();
  renderAlarms();

  const micBtn = document.getElementById('micBtn');
  micBtn.addEventListener('click', () => {
    SpeechEngine.toggleListening();
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
});
