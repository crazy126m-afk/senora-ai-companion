const https = require('https');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }
  body = body || {};

  const userPrompt = body.prompt || 'Namaste';
  const history = body.history || [];

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

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userPrompt }
  ];

  const payload = JSON.stringify({
    messages,
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
      'Content-Length': Buffer.byteLength(payload),
      'User-Agent': 'Senora-Vercel/1.0'
    },
    timeout: 10000
  };

  const pReq = https.request(options, (pRes) => {
    let data = '';
    pRes.on('data', chunk => data += chunk);
    pRes.on('end', () => {
      res.status(200).json({ reply: data || 'Main sun rahi hoon, boliye!' });
    });
  });

  pReq.on('error', (err) => {
    console.error('API Error:', err);
    res.status(200).json({ reply: 'Suno na, internet thoda slow ho gaya. Ek baar dobara bolo na!' });
  });

  pReq.write(payload);
  pReq.end();
};
