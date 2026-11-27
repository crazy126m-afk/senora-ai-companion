# 🌸 SENORA - AI Voice Companion, Study Mentor & Phone Controller

**Senora** is your personalized, voice-controlled, natural female AI companion designed to run seamlessly on your phone and PC.

---

## 🚀 Quick Start

### 1. Run the Local Server
Open your terminal in this folder (`c:\Users\lenovo\OneDrive\Desktop\MY APPS\senora-ai-companion`) and run:
```bash
npm start
```
or
```bash
node server.js
```

### 2. Access on PC
Open your browser and navigate to:
```
http://localhost:3000
```

### 3. Open on your Phone (Same Wi-Fi)
When you start the server, it will display your local network IP:
```
> Phone Access URL: http://192.168.x.x:3000
```
Simply type that URL in Chrome or Safari on your phone!
*(Tip: In Chrome/Safari, tap **"Add to Home Screen"** to install Senora as a full-screen app on your phone!)*

---

## 🎙️ Voice Commands You Can Say to Senora

### 📞 Phone Controls
* **"Call [Number / Name]"** or **"Phone lagao Papa ko"** → Opens phone dialer / initiates direct call.
* **"WhatsApp [Message]"** or **"WhatsApp karo Hello"** → Opens WhatsApp with prefilled message.
* **"Navigate to [Place]"** or **"Rasta dikhao Metro station"** → Opens Google Maps with direct directions.
* **"Note likho [text]"** → Dictates and adds text directly into your notes scratchpad.

### 📚 Study Lab & Socratic Mentor
* **"Padhao mujhe Python"** or **"Explain recursion"** → Senora gives a simple real-world explanation.
* **"DSA Roadmap banao"** → Generates an interactive multi-phase study curriculum.
* **"Quiz lo"** → Starts a voice-interactive quiz with instant score and feedback.

### ⏰ Smart Alarms & Routines
* **"Subah 7 baje ka alarm lagao"** or **"Set alarm for 6:30 AM"** → Sets an alarm with anti-snooze challenge mode.
* **"Alarm dismiss / Solve challenge"** → To stop the alarm buzzer, you must answer a math/study problem!
* **"Morning briefing"** → Senora speaks your daily motivation, date, and study targets.

### 💬 Human Conversation
* **"Kaisi ho?"** / **"How are you?"**
* **"Mujhe motivate karo aaj ke liye"**
* **"Bore lag raha hai, kuch acchi baat batao"**

---

## 🛠️ Architecture & Tech
* **Speech Engine:** Web Speech API (Natural Neural Female Voice + STT with Hindi/English support).
* **Audio FX:** Web Audio API (Synthesized chimes, pings, and alarm buzzers).
* **Canvas Orb:** Real-time animated audio-reactive 3D glow visualizer.
* **Mindmap:** Interactive physics-based knowledge graph.
* **PWA:** Installable standalone web app for Android & iOS.
