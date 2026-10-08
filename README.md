# Privet Connect

A full-stack real-time messaging platform built with React, Express, MongoDB, and Socket.IO.

## Requirements

- Node.js 20 LTS or newer
- npm
- MongoDB Atlas or a local MongoDB instance

## Install

```bash
npm install
npm run install:all
```

## Run the app

Start both frontend and backend together:

```bash
npm run dev
```

Or run them separately:

```bash
npm run server
npm run client
```

## Development ports

- Frontend: http://localhost:5176 (Vite selects the next free port if occupied)
- Backend: http://localhost:5015

## Environment

The backend uses `server/.env`; the frontend build uses `client/.env`. Copy `server/.env.example` to `server/.env` for local development. Keep real credentials out of Git and never share them in issues or chat.

Message attachments and voice notes upload directly to Cloudinary (25 MB maximum per file). Audio/video calls use STUN by default; configure `TURN_URLS` and `TURN_SHARED_SECRET` with a TURN provider for reliable calls across restrictive networks.

## Project structure

- `client/` — React frontend
- `server/` — Express API and Socket.IO server

## Production deployment

Deploy the API as a Node.js service and the client as a static SPA. This repository includes [`render.yaml`](render.yaml) for both Render services. The web service rewrites client routes to `index.html`, so refreshing `/chats/...` works. Create the Blueprint from the repository, provide the prompted secrets, and set `CLIENT_URL` and `SERVER_URL` to the final HTTPS origins. The production API requires:

- `NODE_ENV=production`
- Provider-assigned numeric `PORT`
- `MONGODB_URI` and a unique `JWT_SECRET` of at least 32 characters
- `CLIENT_URL` as exact HTTPS origin(s), comma separated if required
- `SERVER_URL` or `BACKEND_URL` as the API HTTPS origin
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`
- Set `TURN_URLS` to comma-separated `turn:`/`turns:` endpoints and `TURN_SHARED_SECRET` to the matching shared secret from a TURN provider that supports time-limited HMAC credentials. The API already supplies a public STUN server; a STUN URL is not a TURN relay and should not be placed in `TURN_URLS`.

Set `VITE_API_URL` in the client build environment to `https://<api-host>/api`. Build the client with `npm run build`; publish `client/dist`. Start the API with `npm run start --prefix server`. Production startup validates required settings and refuses to bind an alternate port. `/api/health` reports database readiness.

Before release, run `npm run lint`, `npm test`, and `npm run build`. Verify HTTPS login, messaging, profile/attachment uploads, and audio/video calls from two devices on separate networks. The detailed checklist is in [DEPLOYMENT_ROADMAP.md](DEPLOYMENT_ROADMAP.md).
