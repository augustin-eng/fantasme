/* ================================================================
   fantas.me — serveur minimal (aucune dépendance)
   - Sert index.html
   - /api/chat : proxy streaming vers xAI (Grok)
   - /api/tts  : proxy vers OpenAI text-to-speech
   Les clés API vivent dans les variables d'environnement :
     XAI_API_KEY     (obligatoire — écriture des récits)
     OPENAI_API_KEY  (optionnel — lecture audio premium)
================================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

const PORT = process.env.PORT || 3000;
const XAI_KEY = process.env.XAI_API_KEY || '';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

const INDEX = fs.readFileSync(path.join(__dirname, 'index.html'));

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > 2_000_000) { reject(new Error('payload trop grand')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  try {
    /* ---------- écriture du récit (streaming SSE) ---------- */
    if (req.method === 'POST' && req.url === '/api/chat') {
      if (!XAI_KEY) return json(res, 503, { error: { message: 'XAI_API_KEY manquante côté serveur' } });
      const body = await readBody(req);
      const upstream = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + XAI_KEY },
        body
      });
      res.writeHead(upstream.status, {
        'Content-Type': upstream.headers.get('content-type') || 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      if (upstream.body) {
        const stream = Readable.fromWeb(upstream.body);
        stream.pipe(res);
        req.on('close', () => stream.destroy());
      } else res.end();
      return;
    }

    /* ---------- lecture audio (OpenAI TTS) ---------- */
    if (req.method === 'POST' && req.url === '/api/tts') {
      if (!OPENAI_KEY) return json(res, 503, { error: { message: 'OPENAI_API_KEY manquante côté serveur' } });
      const body = JSON.parse(await readBody(req) || '{}');
      const voice = String(body.voice || 'nova').slice(0, 20);
      const input = String(body.input || '').slice(0, 2000);
      if (!input) return json(res, 400, { error: { message: 'texte manquant' } });
      const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENAI_KEY },
        body: JSON.stringify({
          model: 'gpt-4o-mini-tts',
          voice, input,
          response_format: 'mp3',
          instructions: "Lis ce texte en français d'une voix intime, chaude et sensuelle. Rythme lent, souffle posé, articulation douce, comme une lecture murmurée pour une seule personne, tard le soir."
        })
      });
      if (!upstream.ok) {
        const t = await upstream.text();
        return json(res, upstream.status, { error: { message: t.slice(0, 300) } });
      }
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' });
      Readable.fromWeb(upstream.body).pipe(res);
      return;
    }

    /* ---------- app (single page) ---------- */
    if (req.method === 'GET' || req.method === 'HEAD') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : INDEX);
      return;
    }

    json(res, 404, { error: { message: 'introuvable' } });
  } catch (err) {
    json(res, 500, { error: { message: err.message || 'erreur serveur' } });
  }
});

server.listen(PORT, () => console.log('fantas.me en écoute sur le port ' + PORT));
