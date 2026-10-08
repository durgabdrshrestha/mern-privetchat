# Privet Connect

A full-stack real-time messaging platform built with React, Express, MongoDB, and Socket.IO.

## Requirements

- Node.js 18+
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

## Default ports

- Frontend: http://localhost:5173
- Backend: http://localhost:5015

## Environment

The backend uses a `.env` file in the `server` folder and the frontend uses a `.env` file in the `client` folder. Copy `server/.env.example` to `server/.env` and set your MongoDB URI, JWT secret, and Cloudinary credentials. Cloudinary values are available from your Cloudinary dashboard; keep the API secret private and never commit it.

Message attachments and voice notes upload directly to Cloudinary (25 MB maximum per file). Audio/video calls use STUN by default; configure `TURN_URLS` and `TURN_SHARED_SECRET` with a TURN provider for reliable calls across restrictive networks.

## Project structure

- `client/` — React frontend
- `server/` — Express API and Socket.IO server

## Notes

The project is configured for local development with a MongoDB connection string in the server environment file.
