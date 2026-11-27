/**
 * SENORA - Autonomous Voice AI Companion & Phone Controller
 * True Neural Human Female Voice + Hands-Free Zero-Tap Continuous Engine
 */

const SenoraState = {
  isListening: false,
  isSpeaking: false,
  continuousLoopActive: true,
  wakeLock: null,
  currentAudioPlayer: null,
  voiceLang: 'hi', // 'hi' for Hindi / Hinglish, 'en-IN' for Indian English
  selectedView: 'view-voice',
  alarms: [
    { id: '1', time: '07:00', label: 'Morning Wakeup', enabled: true, challenge: true },
    { id: '2', time: '18:00', label: 'Study & DSA Session', enabled: true, challenge: false }
  ],
  challengeExpectedAnswer: null
};

// ==========================================
// 1. SOUND FX (Web Audio API)
// ==========================================
class SoundFX {
  constructor() { this.ctx = null; }
  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  playChime() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }
  playSuccess() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(659.25, this.ctx.currentTime); // E5
    osc.frequency.exponentialRampToValueAtTime(1046.50, this.ctx.currentTime + 0.18); // C6
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }
  startAlarmBuzzer() {
    this.init();
    if (!this.ctx) return null;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(850, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 5;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 300;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    lfo.start();
    return { osc, lfo, gain };
  }
}

const sfx = new SoundFX();
let alarmSoundInstance = null;

// ==========================================
// 2. SCREEN WAKE-LOCK (Keeps phone alive)
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
        btn.style.background = 'var(--accent-neon)';
      }
    } catch (err) {
      console.log('WakeLock error:', err);
    }
  } else {
    alert('Screen WakeLock is automatically managed by your browser.');
  }
}

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
// 3. ZERO-TAP VOICE & TRUE NEURAL TTS ENGINE
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
        handleUserInput(transcript.trim());
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

  // Pure Neural Female Voice Player
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

    const clean = text.replace(/[*_#`~[\]]/g, '').trim();
    const ttsUrl = `/api/tts?text=${encodeURIComponent(clean)}&lang=${encodeURIComponent(SenoraState.voiceLang)}`;

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
      console.warn('Neural TTS stream error, falling back to browser synthesis', e);
      this.fallbackBrowserSpeech(clean, onComplete);
    };

    audio.play().catch(err => {
      console.warn('Audio play prevented (requires first touch/click):', err);
      this.fallbackBrowserSpeech(clean, onComplete);
    });
  },

  fallbackBrowserSpeech(cleanText, onComplete) {
    if (!window.speechSynthesis) {
      if (onComplete) onComplete();
      return;
    }
    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.pitch = 1.15;
    utter.rate = 0.98;
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
  const lbl = document.getElementById('orbStateLabel');
  const pill = document.getElementById('listeningStateLabel');
  const micBtn = document.getElementById('micBtn');

  if (lbl) lbl.textContent = label;
  if (pill) pill.textContent = listening ? 'Listening' : 'Speaking';
  if (micBtn) {
    if (listening) micBtn.classList.add('listening');
    else micBtn.classList.remove('listening');
  }
}

// ==========================================
// 4. ANIMATED HOLOGRAPHIC VOICE ORB (CANVAS)
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

    // Glowing Radial Halo
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

    // Multi-Frequency Sine Wave Rings
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

    // Core Orb
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
// 5. INTENT PROCESSING & HUMAN CONVERSATION
// ==========================================
function handleUserInput(input) {
  if (!input || !input.trim()) return;
  const userText = input.trim();

  const userBubble = document.getElementById('userBubble');
  const userSpeechText = document.getElementById('userSpeechText');
  userBubble.style.display = 'flex';
  userSpeechText.textContent = userText;

  const response = processIntent(userText);
  respondSenora(response.reply, response.action);
}

function respondSenora(replyText, actionCallback) {
  const senoraSpeechText = document.getElementById('senoraSpeechText');
  senoraSpeechText.textContent = replyText;

  SpeechEngine.speak(replyText, () => {
    if (actionCallback) actionCallback();
  });
}

function processIntent(text) {
  const t = text.toLowerCase();

  // 1. CALL INTENT
  if (t.includes('call') || t.includes('phone lagao') || t.includes('call karo')) {
    let target = t.replace(/(call|phone lagao|call karo|ko)/gi, '').trim();
    if (!target) target = 'contact';
    triggerHapticFeedback();
    return {
      reply: `Ji, main ${target} ko call connect kar rahi hoon.`,
      action: () => { window.location.href = `tel:${encodeURIComponent(target)}`; }
    };
  }

  // 2. WHATSAPP INTENT
  if (t.includes('whatsapp') || t.includes('message bhejo') || t.includes('msg bhejo')) {
    let msg = t.replace(/(whatsapp karo|whatsapp|message bhejo|msg bhejo|ko)/gi, '').trim();
    if (!msg) msg = 'Hello, main Senora AI se message bhej raha hoon!';
    triggerHapticFeedback();
    return {
      reply: `WhatsApp open kar rahi hoon aapka message send karne ke liye.`,
      action: () => { window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank'); }
    };
  }

  // 3. ALARM & TIMER INTENT
  if (t.includes('alarm') || t.includes('timer') || t.includes('jagana')) {
    let timeMatch = t.match(/(\d{1,2})(:|\s)?(\d{2})?\s*(am|pm|baje)?/i);
    let timeStr = '07:00';
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      let mins = timeMatch[3] ? timeMatch[3] : '00';
      if (t.includes('pm') && hours < 12) hours += 12;
      timeStr = `${hours.toString().padStart(2, '0')}:${mins}`;
    }

    SenoraState.alarms.push({
      id: Date.now().toString(),
      time: timeStr,
      label: 'Voice Set Alarm',
      enabled: true,
      challenge: true
    });
    renderAlarms();
    sfx.playSuccess();
    triggerHapticFeedback();

    return {
      reply: `Maine ${timeStr} ka challenge alarm set kar diya hai. Subah sawal solve kiye bina snooze nahi hoga!`,
      action: () => switchView('view-alarms', document.querySelectorAll('.dock-btn')[3])
    };
  }

  // 4. STUDY & ROADMAP INTENT
  if (t.includes('padhao') || t.includes('explain') || t.includes('roadmap') || t.includes('study')) {
    let topic = t.replace(/(padhao|mujhe|explain|karo|banao|roadmap|study)/gi, '').trim();
    if (!topic) topic = 'Computer Science & Logic';

    return {
      reply: `Bilkul! Chalye ${topic} shuru karte hain. Main aapke liye interactive roadmap aur quiz ready kar rahi hoon.`,
      action: () => {
        document.getElementById('roadmapTopicInput').value = topic;
        generateRoadmap();
        switchView('view-study', document.querySelectorAll('.dock-btn')[2]);
      }
    };
  }

  // 5. VOICE NOTE INTENT
  if (t.includes('note likho') || t.includes('save note') || t.includes('likho')) {
    let note = t.replace(/(note likho|save note|likho)/gi, '').trim();
    if (!note) note = 'Important thought recorded with Senora.';
    const notesArea = document.getElementById('voiceNotesArea');
    notesArea.value = (notesArea.value ? notesArea.value + '\n• ' : '• ') + note;
    sfx.playSuccess();
    return {
      reply: `Maine aapka note likh liya hai: "${note}"`,
      action: () => switchView('view-phone', document.querySelectorAll('.dock-btn')[1])
    };
  }

  // 6. NAVIGATION
  if (t.includes('navigate') || t.includes('rasta') || t.includes('map') || t.includes('direction')) {
    let dest = t.replace(/(navigate to|navigate|rasta dikhao|rasta|map|direction)/gi, '').trim();
    if (!dest) dest = 'nearby places';
    return {
      reply: `${dest} ka rasta Google Maps par open kar rahi hoon.`,
      action: () => { window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest)}`, '_blank'); }
    };
  }

  // 7. CONVERSATIONAL & HUMAN CHAT
  if (t.includes('kaisi ho') || t.includes('how are you')) {
    return {
      reply: `Main bilkul theek aur energetic hoon! Aap batayein, aaj ka din kaisa chal raha hai? Kuch naya seekhein ya koi task karein?`,
      action: null
    };
  }

  if (t.includes('motivate') || t.includes('himmat') || t.includes('sad')) {
    return {
      reply: `Aap bilkul chinta mat kijiye! Har badi kamyabi chote chote kadmon se aati hai. Main poori tarah aapke sath hoon!`,
      action: null
    };
  }

  // DEFAULT NATURAL COMPANION RESPONSE
  return {
    reply: `Maine suna: "${text}". Main isme aapki poori madad karungi. Bas bolte rahiye, main sun rahi hoon!`,
    action: null
  };
}

// ==========================================
// 6. PHONE CONTROLLERS
// ==========================================
function promptDirectCall() {
  const number = prompt('Enter Phone Number or Contact Name:');
  if (number) {
    triggerHapticFeedback();
    window.location.href = `tel:${encodeURIComponent(number)}`;
  }
}

function promptDirectWhatsApp() {
  const msg = prompt('Enter WhatsApp Message to send:');
  if (msg) {
    triggerHapticFeedback();
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  }
}

function promptNavigation() {
  const place = prompt('Enter Destination or Place:');
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
    sfx.playSuccess();
    alert('Notes copied to clipboard!');
  });
}

function clearNotes() {
  document.getElementById('voiceNotesArea').value = '';
}

// ==========================================
// 7. STUDY LAB & ROADMAP GENERATOR
// ==========================================
const StudyRoadmaps = {
  python: [
    { day: 'Day 1-3', title: 'Python Syntax & Variables', desc: 'Data types, strings, input/output' },
    { day: 'Day 4-7', title: 'Conditionals & Loops', desc: 'if-else, while, for loops, break/continue' },
    { day: 'Day 8-12', title: 'Functions & Data Structures', desc: 'Lists, Tuples, Dictionaries, Sets' },
    { day: 'Day 13-18', title: 'OOP Concepts', desc: 'Classes, Objects, Inheritance, Encapsulation' },
    { day: 'Day 19-30', title: 'Mini Projects & APIs', desc: 'Requests, File Handling, CLI tools' }
  ],
  dsa: [
    { day: 'Phase 1', title: 'Arrays & Two Pointers', desc: 'Prefix sums, sliding window, binary search' },
    { day: 'Phase 2', title: 'Strings & Hashmaps', desc: 'Frequency counter, anagrams, substring problems' },
    { day: 'Phase 3', title: 'Recursion & Backtracking', desc: 'Subsets, permutations, base conditions' },
    { day: 'Phase 4', title: 'Trees & Graphs', desc: 'BFS, DFS, Dijkstra, Tree traversals' },
    { day: 'Phase 5', title: 'Dynamic Programming', desc: '0/1 Knapsack, Memoization vs Tabulation' }
  ],
  default: [
    { day: 'Stage 1', title: 'Fundamental Concepts', desc: 'Core definition, history, and basic terminology' },
    { day: 'Stage 2', title: 'Practical Hands-on Application', desc: 'Step-by-step implementation & examples' },
    { day: 'Stage 3', title: 'Advanced Problem Solving', desc: 'Edge cases, optimizations, real-world projects' },
    { day: 'Stage 4', title: 'Mastery & Self-Assessment', desc: 'Quizzes, interview questions, summary cheatsheet' }
  ]
};

function generateRoadmap() {
  const input = document.getElementById('roadmapTopicInput').value.trim();
  const topic = input ? input.toLowerCase() : 'python';

  let roadmap = StudyRoadmaps.default;
  if (topic.includes('python')) roadmap = StudyRoadmaps.python;
  else if (topic.includes('dsa') || topic.includes('data structure')) roadmap = StudyRoadmaps.dsa;

  const container = document.getElementById('roadmapResults');
  container.innerHTML = '';

  roadmap.forEach(item => {
    const card = document.createElement('div');
    card.style.background = 'rgba(255, 255, 255, 0.04)';
    card.style.border = '1px solid rgba(255, 255, 255, 0.08)';
    card.style.borderRadius = '12px';
    card.style.padding = '10px 14px';
    card.style.display = 'flex';
    card.style.justifyContent = 'space-between';
    card.style.alignItems = 'center';

    card.innerHTML = `
      <div>
        <div style="font-size: 11px; color: var(--accent-neon); font-weight: 700;">${item.day}</div>
        <div style="font-size: 13.5px; font-weight: 600; color: #fff;">${item.title}</div>
        <div style="font-size: 11.5px; color: var(--text-secondary);">${item.desc}</div>
      </div>
      <button class="neo-btn" style="padding: 4px 10px; font-size: 11px;" onclick="teachConcept('${item.title}')">
        Explain
      </button>
    `;
    container.appendChild(card);
  });

  sfx.playSuccess();
}

function teachConcept(title) {
  switchView('view-voice', document.querySelectorAll('.dock-btn')[0]);
  const explanation = `Chaliye ${title} ko simple shabdon me samajhte hain. Yeh concept aapki foundation mazboot karega.`;
  respondSenora(explanation);
}

// Quiz Simulator
const QuizBank = [
  { q: 'Which data structure follows the LIFO (Last In First Out) principle?', options: ['Queue', 'Stack', 'Array', 'Linked List'], correct: 1 },
  { q: 'What is the time complexity of searching in a balanced Binary Search Tree?', options: ['O(n)', 'O(1)', 'O(log n)', 'O(n^2)'], correct: 2 },
  { q: 'In Python, which keyword is used to define an immutable function/lambda?', options: ['def', 'immutable', 'lambda', 'func'], correct: 2 }
];

let currentQuizIndex = 0;

function startQuizSession() {
  currentQuizIndex = Math.floor(Math.random() * QuizBank.length);
  const quiz = QuizBank[currentQuizIndex];
  document.getElementById('quizQuestion').textContent = quiz.q;

  const optContainer = document.getElementById('quizOptions');
  optContainer.innerHTML = '';

  quiz.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'neo-input';
    btn.style.textAlign = 'left';
    btn.style.cursor = 'pointer';
    btn.textContent = `${String.fromCharCode(65 + idx)}. ${opt}`;
    btn.onclick = () => answerQuiz(idx);
    optContainer.appendChild(btn);
  });

  SpeechEngine.speak(`Sawal hai: ${quiz.q}`);
}

function answerQuiz(selected) {
  const quiz = QuizBank[currentQuizIndex];
  if (selected === quiz.correct) {
    sfx.playSuccess();
    triggerHapticFeedback();
    SpeechEngine.speak('Shabaash! Ekdum sahi jawab! Concept clear hai.');
    alert('🎉 Correct Answer! Great job!');
  } else {
    SpeechEngine.speak(`Thoda miss ho gaya. Sahi jawab hai: ${quiz.options[quiz.correct]}.`);
    alert(`Incorrect. The correct answer was: ${quiz.options[quiz.correct]}`);
  }
}

// ==========================================
// 8. ALARMS & ROUTINES
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
    item.style.border = '1px solid var(--border-subtle)';

    item.innerHTML = `
      <div>
        <div style="font-family: 'Outfit'; font-size: 20px; font-weight: 700; color: #fff;">${alarm.time}</div>
        <div style="font-size: 12px; color: var(--text-secondary);">${alarm.label} ${alarm.challenge ? '• (Challenge Mode)' : ''}</div>
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
  const challenge = document.getElementById('challengeModeCheckbox').checked;

  if (!time) return;
  SenoraState.alarms.push({ id: Date.now().toString(), time, label, enabled: true, challenge });
  renderAlarms();
  sfx.playSuccess();
  triggerHapticFeedback();
}

function deleteAlarm(id) {
  SenoraState.alarms = SenoraState.alarms.filter(a => a.id !== id);
  renderAlarms();
}

// Alarm Checker Loop
setInterval(() => {
  const now = new Date();
  const currentHours = now.getHours().toString().padStart(2, '0');
  const currentMins = now.getMinutes().toString().padStart(2, '0');
  const currentTime = `${currentHours}:${currentMins}`;

  if (now.getSeconds() === 0) {
    SenoraState.alarms.forEach(alarm => {
      if (alarm.enabled && alarm.time === currentTime) {
        triggerAlarmAlert(alarm);
      }
    });
  }
}, 1000);

function triggerAlarmAlert(alarm) {
  alarmSoundInstance = sfx.startAlarmBuzzer();
  triggerHapticFeedback();

  const modal = document.getElementById('alarmModal');
  modal.style.display = 'flex';

  const num1 = Math.floor(Math.random() * 12) + 5;
  const num2 = Math.floor(Math.random() * 9) + 4;
  SenoraState.challengeExpectedAnswer = num1 * num2;

  document.getElementById('challengeQuestion').textContent = `${num1} × ${num2} = ?`;
  document.getElementById('challengeAnswerInput').value = '';

  SpeechEngine.speak('Uth jao! Alarm baj raha hai! Alarm band karne ke liye sawal ka sahi answer calculate karo!');
}

function verifyChallengeAnswer() {
  const answer = parseInt(document.getElementById('challengeAnswerInput').value);
  if (answer === SenoraState.challengeExpectedAnswer) {
    if (alarmSoundInstance) {
      alarmSoundInstance.osc.stop();
      alarmSoundInstance.lfo.stop();
      alarmSoundInstance = null;
    }
    document.getElementById('alarmModal').style.display = 'none';
    sfx.playSuccess();
    SpeechEngine.speak('Shandar! Good morning!');
  } else {
    SpeechEngine.speak('Galat jawab! Dimaag lagao aur sahi calculate karo!');
    triggerHapticFeedback();
  }
}

function playMorningBriefing() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('hi-IN', { weekday: 'long', month: 'long', day: 'numeric' });
  const message = `Suprabhat! Aaj ${dateStr} hai. Aaj ka din shandaar hone wala hai! Aapka daily study goal 1 hour focus reading ka hai. Himmat banaye rakhein, Senora aapke sath hai!`;
  respondSenora(message);
}

// ==========================================
// 9. NAVIGATION & INITIALIZATION
// ==========================================
function switchView(viewId, btnElement) {
  SenoraState.selectedView = viewId;
  document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.dock-btn').forEach(b => b.classList.remove('active'));

  const target = document.getElementById(viewId);
  if (target) target.classList.add('active');
  if (btnElement) btnElement.classList.add('active');

  sfx.init();
}

function testVoiceSample() {
  SpeechEngine.speak('Namaste! Main Senora hoon. Meri aawaz ab bilkul natural aur human hai. Main aapse hamesha aise hi baat karungi.');
}

document.addEventListener('DOMContentLoaded', () => {
  SpeechEngine.initSTT();
  Orb.init();
  renderAlarms();

  const micBtn = document.getElementById('micBtn');
  micBtn.addEventListener('click', () => {
    sfx.init();
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
      handleUserInput(val);
      textInput.value = '';
    }
  };

  sendBtn.addEventListener('click', submitText);
  textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitText();
  });

  // Voice Language Switcher
  const voiceSelect = document.getElementById('voiceSelect');
  if (voiceSelect) {
    voiceSelect.innerHTML = `
      <option value="hi" selected>Pure Natural Hindi Female (Google Neural)</option>
      <option value="en-IN">Pure Natural Indian English Female (Google Neural)</option>
      <option value="en-US">Pure Natural Global English Female (Google Neural)</option>
    `;
    voiceSelect.addEventListener('change', (e) => {
      SenoraState.voiceLang = e.target.value;
      const badge = document.getElementById('selectedVoiceBadge');
      if (badge) badge.textContent = e.target.value.toUpperCase();
      testVoiceSample();
    });
  }
});
