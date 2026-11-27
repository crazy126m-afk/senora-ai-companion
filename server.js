const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

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

// Fetch audio chunk from Google Neural TTS
function fetchGoogleTtsChunk(text, lang) {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(text);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${encodeURIComponent(lang)}&client=tw-ob`;

    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/'
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`TTS Service returned status ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });

    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('TTS request timed out'));
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let reqPath = parsedUrl.pathname;

  // NEURAL TTS API ENDPOINT
  if (reqPath === '/api/tts') {
    const text = parsedUrl.searchParams.get('text') || 'Hello';
    const lang = parsedUrl.searchParams.get('lang') || 'hi';

    try {
      // Split into sentences if text is long (> 150 chars)
      const clean = text.replace(/[*_#`~[\]]/g, '').trim();
      const chunks = clean.match(/[^.!?।\n]+[.!?।\n]*/g) || [clean];

      const audioBuffers = [];
      for (const sentence of chunks) {
        const trimmed = sentence.trim();
        if (trimmed.length > 0) {
          // Truncate individual query to 180 chars max for safety
          const sub = trimmed.substring(0, 180);
          const buf = await fetchGoogleTtsChunk(sub, lang);
          audioBuffers.push(buf);
        }
      }

      const combinedAudio = Buffer.concat(audioBuffers);
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': combinedAudio.length,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400'
      });
      res.end(combinedAudio);
      return;
    } catch (err) {
      console.error('TTS Proxy Error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }

  // STATIC FILE SERVING
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
        res.end('500 Server Error: ' + err.code);
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
  console.log('   🌸 SENORA - AI Companion & Phone Controller   ');
  console.log('   🎙️ Neural Human Female Voice: ACTIVE         ');
  console.log('==================================================');
  console.log(`> Local PC URL:     http://localhost:${PORT}`);
  if (ips.length > 0) {
    console.log(`> Phone Access URL:  http://${ips[0]}:${PORT}`);
    console.log('  (Open this in your phone browser on same Wi-Fi)');
  }
  console.log('==================================================\n');
});
