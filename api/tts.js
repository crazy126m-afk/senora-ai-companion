const https = require('https');

function cleanText(text) {
  return text
    .replace(/\[ACTION:[^\]]+\]/g, '')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
    .replace(/[*_#`~[\]]/g, '')
    .trim();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawText = req.query.text || 'Namaste!';
  const lang = req.query.lang || 'hi';
  const clean = cleanText(rawText);

  const encoded = encodeURIComponent(clean.substring(0, 200));
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${encodeURIComponent(lang)}&client=tw-ob`;

  https.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://translate.google.com/'
    }
  }, (proxyRes) => {
    res.setHeader('Content-Type', 'audio/mpeg');
    proxyRes.pipe(res);
  }).on('error', (err) => {
    console.error('TTS Proxy Error:', err);
    res.status(500).json({ error: err.message });
  });
};
