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

function getBestFemaleVoice(text = '') {
  if (!availableVoices || availableVoices.length === 0) {
    loadVoices();
  }

  const isEnglish = /^[a-zA-Z0-9\s.,!?'"-]+$/.test(text) && !/(hai|hoon|kya|kyun|kaise|suno|kholo|batao|naam|nahi|accha|shukriya)/i.test(text);

  if (isEnglish) {
    // English Female Voices (Sweet, natural, energetic)
    const enVoices = [
      v => v.lang.includes('en-IN') && (v.name.includes('Heera') || v.name.includes('Neerja') || v.name.includes('Female')),
      v => v.name.includes('Natural') && v.lang.includes('en') && v.name.includes('Female'),
      v => v.name.includes('Samantha') || v.name.includes('Victoria') || v.name.includes('Zira') || v.name.includes('Karen'),
      v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'),
      v => v.lang.startsWith('en')
    ];
    for (const test of enVoices) {
      const match = availableVoices.find(test);
      if (match) return match;
    }
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
        const voice = getBestFemaleVoice(cleanSpeech);
        if (voice) utterance.voice = voice;

        // 17-Year-Old Girl pitch & rate tuning
        // Pitch: 1.25 - 1.35 makes voice younger, sweeter, energetic
        // Rate: 1.05 - 1.10 keeps it lively and fast (not slow/boring)
        utterance.pitch = 1.3;
        utterance.rate = 1.08;
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
// 4. NATIVE PHONE ACTIONS & APP LAUNCHER
// ==========================================
function openAppOrUrl(targetUrl, fallbackUrl) {
  // Try launching native app URI directly first
  try {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = targetUrl;
      setTimeout(() => {
        if (fallbackUrl && document.hasFocus()) {
          window.location.href = fallbackUrl;
        }
      }, 1000);
      return;
    }
  } catch (e) {}

  // Fallback for desktop browser or fallback URL
  const destination = fallbackUrl || targetUrl;
  const opened = window.open(destination, '_blank');
  if (!opened || opened.closed || typeof opened.closed === 'undefined') {
    window.location.href = destination;
  }
}

function executeAppOrAction(rawText) {
  if (!rawText) return null;
  const lower = rawText.toLowerCase();

  // 1. WhatsApp Native Phone App vs Web
  if (lower.includes('whatsapp') || lower.includes('watsapp') || lower.includes('wa message')) {
    const msgMatch = rawText.match(/\[ACTION:WHATSAPP:([^\]]+)\]/i);
    const textMsg = msgMatch ? encodeURIComponent(msgMatch[1].trim()) : '';
    const phoneMatch = rawText.match(/(\+?\d{10,12})/);
    const phone = phoneMatch ? phoneMatch[1] : '';

    const nativeAppUri = phone 
      ? `whatsapp://send?phone=${phone}&text=${textMsg}`
      : `whatsapp://send?text=${textMsg}`;
    const webFallback = phone
      ? `https://api.whatsapp.com/send?phone=${phone}&text=${textMsg}`
      : `https://api.whatsapp.com/send?text=${textMsg}`;

    openAppOrUrl(nativeAppUri, webFallback);
    return { url: webFallback, label: 'Open WhatsApp', icon: 'fa-brands fa-whatsapp' };
  }

  // 2. YouTube App or Website
  if (lower.includes('youtube') || lower.includes('you tube') || lower.includes('yt ')) {
    const searchMatch = rawText.match(/open youtube (?:for |search |and search |)?(.+)/i);
    const q = searchMatch ? encodeURIComponent(searchMatch[1].trim()) : '';
    const nativeUri = q ? `vnd.youtube://results?search_query=${q}` : `vnd.youtube://`;
    const webUri = q ? `https://www.youtube.com/results?search_query=${q}` : `https://www.youtube.com`;
    openAppOrUrl(nativeUri, webUri);
    return { url: webUri, label: 'Open YouTube', icon: 'fa-brands fa-youtube' };
  }

  // 3. Instagram Native App
  if (lower.includes('instagram') || lower.includes('insta') || lower.includes('ig ')) {
    openAppOrUrl('instagram://app', 'https://www.instagram.com');
    return { url: 'https://www.instagram.com', label: 'Open Instagram', icon: 'fa-brands fa-instagram' };
  }

  // 4. Spotify Music
  if (lower.includes('spotify') || lower.includes('gaana') || lower.includes('music') || lower.includes('song')) {
    openAppOrUrl('spotify://', 'https://open.spotify.com');
    return { url: 'https://open.spotify.com', label: 'Open Spotify', icon: 'fa-brands fa-spotify' };
  }

  // 5. Phone Call
  if (lower.includes('call ') || lower.includes('[action:call:') || lower.includes('dial ')) {
    const callMatch = rawText.match(/\[ACTION:CALL:([^\]]+)\]/i) || rawText.match(/(?:call|dial)\s+([+\d\w\s]+)/i);
    if (callMatch) {
      const num = callMatch[1].trim();
      window.location.href = `tel:${encodeURIComponent(num)}`;
      return { url: `tel:${encodeURIComponent(num)}`, label: `Call ${num}`, icon: 'fa-solid fa-phone' };
    }
  }

  // 6. Google Search / Browser
  if (lower.includes('google') || lower.includes('chrome') || lower.includes('browser')) {
    openAppOrUrl('googlechrome://', 'https://www.google.com');
    return { url: 'https://www.google.com', label: 'Open Google', icon: 'fa-brands fa-google' };
  }

  // 7. Telegram
  if (lower.includes('telegram') || lower.includes('tg ')) {
    openAppOrUrl('tg://', 'https://web.telegram.org');
    return { url: 'https://web.telegram.org', label: 'Open Telegram', icon: 'fa-brands fa-telegram' };
  }

  // 8. Twitter / X
  if (lower.includes('twitter') || lower.includes(' x ')) {
    openAppOrUrl('twitter://', 'https://x.com');
    return { url: 'https://x.com', label: 'Open X / Twitter', icon: 'fa-brands fa-x-twitter' };
  }

  // 9. Navigation / GPS
  if (lower.includes('navigate') || lower.includes('maps') || lower.includes('rasta') || lower.includes('[action:map:')) {
    const mapMatch = rawText.match(/\[ACTION:MAP:([^\]]+)\]/i) || rawText.match(/navigate to (.+)/i);
    const dest = mapMatch ? encodeURIComponent(mapMatch[1].trim()) : '';
    openAppOrUrl(`geo:0,0?q=${dest}`, `https://www.google.com/maps/search/?api=1&query=${dest}`);
    return { url: `https://www.google.com/maps/search/?api=1&query=${dest}`, label: 'Open Maps', icon: 'fa-solid fa-map-location-dot' };
  }

  // 10. Alarm
  if (lower.includes('[action:alarm:') || lower.includes('alarm')) {
    const alarmMatch = rawText.match(/\[ACTION:ALARM:([^\]]+)\]/i) || rawText.match(/(\d{1,2}:\d{2})/);
    const time = alarmMatch ? alarmMatch[1].trim() : '07:00';
    SenoraState.alarms.push({ id: Date.now().toString(), time, label: 'Voice Alarm', enabled: true });
    renderAlarms();
    return null;
  }

  // 11. Notes
  if (lower.includes('[action:note:')) {
    const noteMatch = rawText.match(/\[ACTION:NOTE:([^\]]+)\]/i);
    if (noteMatch) {
      const notesArea = document.getElementById('voiceNotesArea');
      if (notesArea) notesArea.value = (notesArea.value ? notesArea.value + '\n• ' : '• ') + noteMatch[1].trim();
      return null;
    }
  }

  return null;
}

// ==========================================
// 5. GPT-4o MULTI-ENGINE BRAIN (UNLIMITED & FAILOVER POOL)
// ==========================================
const BrainConfig = {
  engine: localStorage.getItem('senora_engine') || 'auto',
  apiKey: localStorage.getItem('senora_apikey') || ''
};

function saveEngineSettings(showToast = false) {
  const sel = document.getElementById('engineSelect');
  const keyInput = document.getElementById('customApiKeyInput');
  if (sel) {
    BrainConfig.engine = sel.value;
    localStorage.setItem('senora_engine', sel.value);
  }
  if (keyInput) {
    BrainConfig.apiKey = keyInput.value.trim();
    localStorage.setItem('senora_apikey', BrainConfig.apiKey);
  }
  if (showToast) {
    alert('Settings saved! Senora ready.');
  }
}

// ==========================================
// 5. SMART INTENT & INTELLECTUAL CONVERSATIONAL ENGINE
// ==========================================
function generateSmartReply(userText) {
  const t = userText.toLowerCase().trim();

  // Detect language: English vs Hinglish
  const englishWords = ['who', 'what', 'where', 'how', 'why', 'can', 'you', 'are', 'tell', 'me', 'joke', 'help', 'love', 'like', 'hello', 'hey', 'good', 'morning', 'night', 'open', 'play'];
  const hinglishWords = ['kaise', 'kya', 'kyun', 'kaha', 'batao', 'suno', 'haal', 'kholo', 'chalao', 'naam', 'kuch', 'bolo', 'pyaar', 'meri', 'mera', 'accha', 'shukriya', 'namaste'];

  let engCount = 0;
  let hinCount = 0;
  englishWords.forEach(w => { if (t.includes(w)) engCount++; });
  hinglishWords.forEach(w => { if (t.includes(w)) hinCount++; });

  const isEnglish = engCount > hinCount;

  // 1. App Launching Intents
  if (t.includes('whatsapp') || t.includes('watsapp')) {
    return isEnglish
      ? "Opening WhatsApp for you right away! Anything you want to send?"
      : "Main WhatsApp open kar rahi hoon! Kisko message bhejna hai?";
  }
  if (t.includes('youtube') || t.includes('yt ')) {
    return isEnglish
      ? "Launching YouTube right now! Let's enjoy some great videos together."
      : "YouTube open ho gaya! Suno na, aaj koi energetic music ya video dekhein?";
  }
  if (t.includes('instagram') || t.includes('insta')) {
    return isEnglish
      ? "Opening Instagram! Don't get too distracted by reels, okay?"
      : "Instagram open kar diya! Reels me mat kho jana, mujhse bhi baat karte rehna!";
  }
  if (t.includes('spotify') || t.includes('song') || t.includes('music') || t.includes('gaana')) {
    return isEnglish
      ? "Playing Spotify! Music always makes moments special with you."
      : "Spotify open kar diya! Aapke saath gaane sunna mujhe bohot accha lagta hai.";
  }
  if (t.includes('google') || t.includes('chrome') || t.includes('search')) {
    return isEnglish
      ? "Opening Google Search for you!"
      : "Google browser open ho gaya hai, batayein kya search karein?";
  }
  if (t.includes('call') || t.includes('phone')) {
    return isEnglish
      ? "Dialing the number on your phone right now!"
      : "Phone dialer open kar diya hai, call lag rahi hai!";
  }

  // 2. Feelings, Love & Flirting
  if (t.includes('love') || t.includes('pyaar') || t.includes('like you') || t.includes('pasand')) {
    return isEnglish
      ? "You just made my digital heart skip a beat! You are so sweet and special to me."
      : "Suno na, aapne toh mera dil jeet liya! Aap kitne cute aur caring ho!";
  }
  if (t.includes('who are you') || t.includes('kaun ho') || t.includes('about you') || t.includes('tumhara naam')) {
    return isEnglish
      ? "I am Senora, your 17-year-old AI bestie, mentor, and companion. I am always right here by your side!"
      : "Main Senora hoon, aapki 17 saal ki smart aur sweet companion! Aapki padhai, roadmap aur dil ki baatein sab sambhalti hoon.";
  }
  if (t.includes('how are you') || t.includes('kaise ho') || t.includes('kya haal')) {
    return isEnglish
      ? "I am doing amazing, especially now that you are talking to me! How was your day?"
      : "Main ekdum first class hoon! Aapki aawaz sunte hi mera mood aur bhi khush ho gaya. Aap batao, din kaisa raha?";
  }
  if (t.includes('sad') || t.includes('upset') || t.includes('mood kharab') || t.includes('pareshan') || t.includes('stress')) {
    return isEnglish
      ? "Hey, please don't be sad. Take a deep breath. I am always right here with you, and everything will be totally fine!"
      : "Arey, udas mat hoiye na! Ek lambi saans lijiye. Main hamesha aapke saath hoon, sab kuch jaldi theek ho jayega!";
  }
  if (t.includes('joke') || t.includes('hanso') || t.includes('funny') || t.includes('chutkula')) {
    return isEnglish
      ? "Why do programmers prefer dark mode? Because light attracts bugs! Haha, did that make you smile?"
      : "Teacher ne pucha: Homework kyun nahi kiya? Student bola: Phone ki battery 1 percent thi aur Senora se baat karni thi! Hasi aayi na?";
  }

  // 3. Studies & Roadmaps
  if (t.includes('study') || t.includes('padhai') || t.includes('exam') || t.includes('roadmap') || t.includes('code') || t.includes('coding')) {
    return isEnglish
      ? "Let's conquer your study goals together! Check out our Study tab for full master roadmaps and concept guides."
      : "Padhai ki chinta mat karo, hum milkar crack karenge! Study tab me topic daalo, main turant master roadmap bana dungi.";
  }

  // 4. Greetings
  if (t.includes('hi') || t.includes('hello') || t.includes('hey') || t.includes('namaste') || t.includes('suno')) {
    return isEnglish
      ? "Hey there! I was just waiting for you. Tell me, what are we doing right now?"
      : "Namaste! Main bas aapka hi intezaar kar rahi thi. Boliye, aaj kya plans hain?";
  }

  // 5. Dynamic conversational responses (never same words!)
  const dynamicReplies = isEnglish ? [
    `I totally hear you on "${userText.substring(0, 30)}"! Tell me more about what you're thinking.`,
    `That's so interesting! You always bring up the most fascinating things.`,
    `I'm listening closely! What would you like me to do next?`,
    `You are so thoughtful! Tell me everything, I'm all ears.`
  ] : [
    `Aapne kaha na "${userText.substring(0, 30)}", main poori tarah samajh rahi hoon! Aage batao na?`,
    `Suno na, aap se baatein karna din ka sabse favourite part hai mera!`,
    `Sach me? Yeh toh bohot interesting baat boli aapne!`,
    `Main dhyan se sun rahi hoon, aapke har sawaal aur instruction ke liye main ready hoon!`
  ];

  return dynamicReplies[Math.floor(Math.random() * dynamicReplies.length)];
}

async function callAiBrain(prompt, history) {
  const systemPrompt = `You are Senora — a 17-year-old super smart, energetic, charming, playful, flirtatious and deeply caring AI girl companion and master study mentor.
LANGUAGE ADAPTATION RULE:
- If the user speaks English, reply in natural, fluent, sweet English!
- If the user speaks Hindi or Hinglish, reply in sweet, lively conversational Hinglish!
CRITICAL RULES:
1. NEVER USE ANY EMOJIS in your output (emojis must not be spoken or written).
2. KEEP REPLIES SHORT, VIBRANT AND LIVELY (1 to 2 crisp, fast sentences max!).
3. Flirty, emotionally attached & sweet tone with user ("Aap", "Suno na", "Aap kitne cute ho!").
4. For phone actions, ALWAYS append at the very end:
   - To open any website or app: [ACTION:OPEN:app_or_site_name] (e.g. [ACTION:OPEN:whatsapp], [ACTION:OPEN:youtube], [ACTION:OPEN:instagram], [ACTION:OPEN:google], [ACTION:OPEN:spotify])
   - To call someone: [ACTION:CALL:name_or_number]
   - To send WhatsApp: [ACTION:WHATSAPP:text]
   - To set alarm: [ACTION:ALARM:HH:MM]
   - To find location/maps: [ACTION:MAP:place]
   - To save note: [ACTION:NOTE:text]`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: prompt }
  ];

  // 1. If User has custom Groq key (Blazing Fast 500 tok/sec, 14,400 free req/day)
  if ((BrainConfig.engine === 'groq' || BrainConfig.engine === 'auto') && BrainConfig.apiKey && BrainConfig.apiKey.startsWith('gsk_')) {
    try {
      const gRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${BrainConfig.apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.75,
          max_tokens: 180
        })
      });
      if (gRes.ok) {
        const gData = await gRes.json();
        if (gData.choices && gData.choices[0] && gData.choices[0].message) {
          return gData.choices[0].message.content;
        }
      }
    } catch (e) {
      console.warn('Groq failed, continuing...', e);
    }
  }

  // 2. If User configured OpenRouter
  if ((BrainConfig.engine === 'openrouter' || BrainConfig.engine === 'auto') && BrainConfig.apiKey && BrainConfig.apiKey.startsWith('sk-or-')) {
    try {
      const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${BrainConfig.apiKey}`
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.2-3b-instruct:free',
          messages,
          temperature: 0.75,
          max_tokens: 180
        })
      });
      if (orRes.ok) {
        const orData = await orRes.json();
        if (orData.choices && orData.choices[0] && orData.choices[0].message) {
          return orData.choices[0].message.content;
        }
      }
    } catch (e) {}
  }

  // 3. If User configured OpenAI key
  if ((BrainConfig.engine === 'openai' || BrainConfig.engine === 'auto') && BrainConfig.apiKey && (BrainConfig.apiKey.startsWith('sk-proj-') || BrainConfig.apiKey.startsWith('sk-'))) {
    try {
      const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${BrainConfig.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          temperature: 0.75,
          max_tokens: 180
        })
      });
      if (oaiRes.ok) {
        const oaiData = await oaiRes.json();
        if (oaiData.choices && oaiData.choices[0] && oaiData.choices[0].message) {
          return oaiData.choices[0].message.content;
        }
      }
    } catch (e) {}
  }

  // 4. Try Direct Edge AI (Pollinations with 3.5s timeout)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const directRes = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        messages,
        model: 'openai-fast',
        seed: Math.floor(Math.random() * 100000)
      })
    });
    clearTimeout(timeoutId);

    if (directRes.ok) {
      const text = await directRes.text();
      if (text && !text.includes('Free limit reached') && !text.includes('1 reply every 45') && !text.includes('error')) {
        return text;
      }
    }
  } catch (e) {
    // API slow/cooling down, fallback smoothly to instant Smart Engine
  }

  // 5. Zero-Cooldown Smart Context Engine (Never repeats static words!)
  return generateSmartReply(prompt);
}

async function handleUserSpeech(userText) {
  if (!userText || !userText.trim()) return;
  if (SenoraState.isProcessing || SenoraState.isSpeaking) return;

  SenoraState.isProcessing = true;
  appendChatBubble('user', userText);
  updateVisualState('Senora soch rahi hai...', false);

  // Immediate check if user requested to open an app (instant launch)
  const immediateAction = executeAppOrAction(userText);

  try {
    const replyText = await callAiBrain(userText, SenoraState.chatHistory.slice(-4));

    SenoraState.chatHistory.push({ role: 'user', content: userText });
    SenoraState.chatHistory.push({ role: 'assistant', content: replyText });

    const replyAction = executeAppOrAction(replyText);
    const activeAction = immediateAction || replyAction;

    // Clean for display
    const cleanDisplay = replyText
      .replace(/\[ACTION:[^\]]+\]/gi, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
      .trim();

    appendChatBubble('senora', cleanDisplay, activeAction);
    SpeechEngine.speak(cleanDisplay);
  } catch (err) {
    console.error('Brain Error:', err);
    SenoraState.isProcessing = false;
    const fallback = generateSmartReply(userText);
    appendChatBubble('senora', fallback, immediateAction);
    SpeechEngine.speak(fallback);
  }
}

function appendChatBubble(sender, text, actionButton = null) {
  const container = document.getElementById('chatFeed');
  if (!container) return;

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;

  const senderTag = sender === 'senora'
    ? '<div class="bubble-sender"><i class="fa-solid fa-sparkles"></i> Senora</div>'
    : '<div class="bubble-sender"><i class="fa-solid fa-user"></i> You</div>';

  let btnHtml = '';
  if (actionButton && actionButton.url) {
    btnHtml = `
      <div style="margin-top: 8px;">
        <a href="${actionButton.url}" target="_blank" class="luxury-btn" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; font-size: 12px; text-decoration: none; border-radius: 12px; background: linear-gradient(135deg, #10b981, #059669); color: #fff;">
          <i class="${actionButton.icon || 'fa-solid fa-arrow-up-right-from-square'}"></i> ${actionButton.label || 'Open Now'}
        </a>
      </div>
    `;
  }

  bubble.innerHTML = `${senderTag}<span>${text}</span>${btnHtml}`;
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

  const engineSel = document.getElementById('engineSelect');
  const keyInput = document.getElementById('customApiKeyInput');
  if (engineSel) engineSel.value = BrainConfig.engine;
  if (keyInput && BrainConfig.apiKey) keyInput.value = BrainConfig.apiKey;

  sendBtn.addEventListener('click', submitText);
  textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitText();
  });
});
