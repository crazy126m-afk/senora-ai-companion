const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const AUDIO_DIR = path.join(__dirname, 'audio_cache');

if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

const audioCache = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg'
};

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

// Generate 17-Year-Old Natural Girl Neural TTS
function generateNeuralTTS(text, voice) {
  return new Promise((resolve, reject) => {
    const cacheKey = `${voice}_${text}`;
    if (audioCache.has(cacheKey)) {
      return resolve(audioCache.get(cacheKey));
    }

    const filename = `tts_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.mp3`;
    const outPath = path.join(AUDIO_DIR, filename);
    const scriptPath = path.join(__dirname, 'generate_tts.py');

    // Pitch +22Hz, rate +18% for 17-year-old sweet, lively, cute girl voice
    execFile('python', [scriptPath, text, voice, outPath, '+18%', '+22Hz'], { timeout: 12000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('TTS Error:', stderr || error.message);
        return reject(error);
      }
      fs.readFile(outPath, (readErr, buffer) => {
        fs.unlink(outPath, () => {});
        if (readErr) return reject(readErr);
        if (audioCache.size > 200) audioCache.clear();
        audioCache.set(cacheKey, buffer);
        resolve(buffer);
      });
    });
  });
}

// Super-Intelligent, Playfully Flirtatious 17-Year-Old Girl Persona via GPT-4o
function queryAiBrain(messages) {
  return new Promise((resolve, reject) => {
    const systemPrompt = `You are Senora — a 17-year-old super smart, charming, playful, slightly flirtatious and deeply caring AI girl companion and study mentor.
You speak in modern, sweet, conversational Hinglish.

CRITICAL RULES:
1. DO NOT USE ANY EMOJIS in your output (emojis must not be written or spoken).
2. KEEP REPLIES SHORT AND PUNCHY (1 to 2 crisp, lively sentences max!). Never write long boring essays.
3. Vibe: Sweet, cute, energetic, teasingly flirty with the user ("Aap", "Suno na", "Aap kitne cute ho!"), yet a brilliant genius in studies and coding.
4. For phone actions, append at the very end:
   - [ACTION:CALL:name_or_number]
   - [ACTION:WHATSAPP:text]
   - [ACTION:ALARM:HH:MM]
   - [ACTION:MAP:place]
   - [ACTION:NOTE:text]`;

    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    const data = JSON.stringify({
      messages: fullMessages,
      model: 'openai',
      temperature: 0.75
    });

    const options = {
      hostname: 'text.pollinations.ai',
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'Senora-Assistant/2.7'
      },
      timeout: 12000
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`AI status: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('AI timeout'));
    });

    req.write(data);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let reqPath = parsedUrl.pathname;

  // 1. FAST TTS ENDPOINT
  if (reqPath === '/api/tts') {
    const text = parsedUrl.searchParams.get('text') || 'Namaste!';
    const voice = parsedUrl.searchParams.get('voice') || 'hi-IN-SwaraNeural';

    try {
      const clean = text.replace(/\[ACTION:[^\]]+\]/g, '').trim();
      const audioBuffer = await generateNeuralTTS(clean, voice);
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400'
      });
      res.end(audioBuffer);
      return;
    } catch (err) {
      console.error('TTS Error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }

  // 2. AI BRAIN ENDPOINT
  if (reqPath === '/api/ask' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const userPrompt = payload.prompt;
        const history = payload.history || [];

        const messages = [...history, { role: 'user', content: userPrompt }];
        const reply = await queryAiBrain(messages);

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=UTF-8',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ reply }));
      } catch (err) {
        console.error('Brain Error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=UTF-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ reply: 'Suno na, lagta hai internet thoda slow ho gaya. Ek baar dobara bolo!' }));
      }
    });
    return;
  }

  // 3. STATIC FILES
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, reqPath);
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
        res.end('500 Server Error');
      }
      return;
    }

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIpAddresses();
  console.log('==================================================');
  console.log('   🌸 SENORA 2.7 - 17-Year-Old Natural Voice     ');
  console.log('   🎙️ No Emojis Spoken • Zero Repeat Bug Fix     ');
  console.log('==================================================');
  console.log(`> Local PC URL:     http://localhost:${PORT}`);
  if (ips.length > 0) {
    console.log(`> Phone Access URL:  http://${ips[0]}:${PORT}`);
  }
  console.log('==================================================\n');
});
