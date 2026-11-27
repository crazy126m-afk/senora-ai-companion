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

// Generate Edge Neural TTS via Python script
function generateNeuralTTS(text, voice) {
  return new Promise((resolve, reject) => {
    const filename = `tts_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.mp3`;
    const outPath = path.join(AUDIO_DIR, filename);
    const scriptPath = path.join(__dirname, 'generate_tts.py');

    execFile('python', [scriptPath, text, voice, outPath], { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('TTS Generation Error:', stderr || error.message);
        return reject(error);
      }
      fs.readFile(outPath, (readErr, buffer) => {
        // Clean up file asynchronously
        fs.unlink(outPath, () => {});
        if (readErr) return reject(readErr);
        resolve(buffer);
      });
    });
  });
}

// GPT-4o Brain via Pollinations AI
function queryAiBrain(messages) {
  return new Promise((resolve, reject) => {
    const systemPrompt = `You are Senora, an ultra-smart, deeply knowledgeable, warm and charming AI female companion and Socratic study mentor.
You speak fluent natural Hindi/Hinglish/English.
You understand everything: programming, algorithms, system design, math, science, history, UPSC/JEE preparation, study roadmaps, and phone commands.
When user asks for a study roadmap, provide an inspiring, structured step-by-step roadmap.
When user gives a phone command (e.g. call, whatsapp, alarm, navigate, note), acknowledge warmly and append exactly one action tag at the very end of your reply:
- For call: [ACTION:CALL:target_name_or_number]
- For whatsapp: [ACTION:WHATSAPP:message_text]
- For alarm: [ACTION:ALARM:HH:MM]
- For maps/navigation: [ACTION:MAP:place_name]
- For note: [ACTION:NOTE:note_text]
Keep replies concise, conversational, clear and human-like so they sound pleasant when spoken aloud.`;

    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    const data = JSON.stringify({
      messages: fullMessages,
      model: 'openai',
      temperature: 0.7
    });

    const options = {
      hostname: 'text.pollinations.ai',
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'Senora-Assistant/2.0'
      },
      timeout: 20000
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`AI service returned ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('AI brain request timed out'));
    });

    req.write(data);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let reqPath = parsedUrl.pathname;

  // 1. NEURAL TTS ENDPOINT
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
        'Cache-Control': 'no-cache'
      });
      res.end(audioBuffer);
      return;
    } catch (err) {
      console.error('TTS endpoint error:', err.message);
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
        console.error('Brain API Error:', err.message);
        res.writeHead(500, {
          'Content-Type': 'application/json; charset=UTF-8',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          reply: 'Main samajh gayi, par internet connection thoda slow lag raha hai. Aap dobara boliye!'
        }));
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
  console.log('   🌸 SENORA 2.0 - GPT-4o Brain & Neural Voice   ');
  console.log('   🎙️ Pure Edge Neural Female Voice: ACTIVE      ');
  console.log('==================================================');
  console.log(`> Local PC URL:     http://localhost:${PORT}`);
  if (ips.length > 0) {
    console.log(`> Phone Access URL:  http://${ips[0]}:${PORT}`);
    console.log('  (Open this in your phone browser on same Wi-Fi)');
  }
  console.log('==================================================\n');
});
