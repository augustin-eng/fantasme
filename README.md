# fantas.me

Récits sur mesure — prototype (studio The K Ventura).

## Déploiement (Railway)

1. Connecter ce repo GitHub au service Railway.
2. Dans Railway → onglet **Variables**, ajouter :
   - `XAI_API_KEY` — clé xAI (console.x.ai), obligatoire pour l'écriture des récits
   - `OPENAI_API_KEY` — clé OpenAI (platform.openai.com), pour la lecture audio premium
3. Railway détecte Node et lance `npm start` automatiquement.

Aucune dépendance à installer : le serveur (`server.js`) est du Node pur (>=18).

## Architecture

- `index.html` — l'app complète (une seule page)
- `server.js` — sert l'app et fait proxy vers xAI (`/api/chat`, streaming) et OpenAI TTS (`/api/tts`) ; les clés restent côté serveur.
