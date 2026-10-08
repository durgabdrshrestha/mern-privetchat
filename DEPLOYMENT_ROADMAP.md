# Privet Connect Deployment Roadmap

## Current state

- React/Vite client and Express/Socket.IO API are scaffolded.
- MongoDB/Mongoose auth, profile, conversations, groups, messages, and signaling routes are implemented.
- Local development and the client production build work.
- Environment templates are provided in `server/.env.example`; real credentials must stay in deployment-provider secrets.
- The API validates required production settings before startup, waits for MongoDB, and refuses to silently change ports in production.
- Helmet security headers, auth endpoint rate limits, and database-aware health checks are enabled.
- Local disk upload fallback is development-only; production uploads require Cloudinary.

## Deployment sequence

1. **Prepare production services**
   - Create a production MongoDB Atlas database and restrict network access to the backend provider.
   - Create Cloudinary credentials for profile photos and message attachments.
   - Choose a TURN provider and obtain its URLs and credentials; STUN alone is not reliable across restrictive networks.
   - Use the included `render.yaml` Blueprint for both the Node API and static client; its rewrite rule supports direct navigation and refresh on client routes.

2. **Deploy the API first**
   - Set `PORT` using the provider's assigned port.
   - Set `MONGODB_URI`, a newly generated strong `JWT_SECRET`, `CLIENT_URL`, and `SERVER_URL` as provider secrets/configuration.
   - Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
   - Set `TURN_URLS` and `TURN_SHARED_SECRET` from the selected TURN provider.
   - Confirm `/api/health` returns `status: ok` over HTTPS.

3. **Deploy the web client**
   - Set `VITE_API_URL` to the deployed API's HTTPS `/api` base URL before building.
   - Build with `npm run build` in `client/`; publish `client/dist`.
   - Configure SPA history fallback so paths such as `/chats/:conversationId` serve `index.html`.
   - Add the final web origin to the server's CORS allow-list and Socket.IO origin configuration.

4. **Production verification**
   - Register and log in from the deployed HTTPS site.
   - Test direct/group messaging, read receipts, profile upload, attachment upload, and reconnect behavior.
   - Test audio/video calls between separate networks and devices with microphone/camera permissions granted.
   - Confirm secrets are not present in Git, frontend bundles, or public logs.
   - Run `npm run lint`, `npm test`, `npm run build`, and `npm audit --omit=dev` before release.

## Production configuration gate

Production startup requires a provider-assigned `PORT`, a MongoDB URI, a unique `JWT_SECRET` with at least 32 characters, exact HTTPS origins in `CLIENT_URL` and `SERVER_URL` or `BACKEND_URL`, and all three Cloudinary credentials. Configure these directly in provider secret settings; never copy production values into `.env.example` or Git. Configure TURN for reliable calls; without it, some networks cannot establish media connections.

## Deployment is currently blocked on

- Public web and API hostnames/provider accounts have not been configured in this workspace.
- Production MongoDB, Cloudinary, and TURN credentials must be created and added directly to the hosting provider; do not put them in Git or chat.
- Current local settings are development settings and do not satisfy the HTTPS origin/JWT strength production gate.
- Rotate the Cloudinary API secret before public deployment because it was exposed in previous troubleshooting output.
- Calls need a configured TURN service and real cross-network testing before claiming production reliability.

## Immediate next step

Choose the web host, API host, domain, and TURN provider. Then add their public origins and secrets to the provider dashboards, deploy the API, set the client's `VITE_API_URL`, and publish the client build.
