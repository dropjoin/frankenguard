# Deploying FrankenGuard

One container, one process, one SQLite file. The server serves the
API and the built React client from the same origin, so there is no
separate frontend deployment to keep in sync.

## Render (the public demo)

`render.yaml` at the repo root is a Render Blueprint for a free web
service: `npm ci && npm run build`, then `node
dist/server/api/main.js`, health check on `/healthz`. Create it from
the Render dashboard with New > Blueprint pointed at this repo. The
blueprint sets `NODE_ENV=production` (Secure cookie flag) and
`TRUST_PROXY=1` (Render terminates TLS and forwards plain HTTP, so
rate limits need the real client IP). No secrets are required: the
live agent stays off and `TAMPER_DEMO` is never set on the public
deployment. The free plan has no persistent disk, so the SQLite
file lives on the ephemeral filesystem and sandboxes disappear on
redeploy or restart; that matches the demo's short-lived sandboxes.

## Docker

```sh
docker build -t frankenguard .
docker run -d --name frankenguard \
  -p 3000:3000 \
  -v frankenguard-data:/app/data \
  frankenguard
```

The image is two stages: a `node:20` builder runs `npm ci` and
`npm run build`; the `node:20-slim` runtime stage keeps only the
production dependencies and `dist/`, runs as the `node` user, and
exposes port 3000 with a `/healthz` healthcheck.

The database lives at `/app/data/frankenguard.db` inside the
container. Mount a volume there, or every sandbox and its audit
chain disappears with the container. Backing up the deployment is
copying that one file (plus its `-wal`/`-shm` sidecars while the
server is stopped).

## Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `3000` | Validated 1-65535 at startup. |
| `HOST` | `0.0.0.0` | Bind address. |
| `DB_PATH` | `./data/frankenguard.db` | Parent directory is created on startup. In the image this is `/app/data/frankenguard.db`. |
| `NODE_ENV` | — | `production` sets the `Secure` flag on the sandbox cookie and makes a missing web root a startup failure instead of a warning. |
| `WEB_ROOT` | `dist/web` | Where the built client is served from. Override only if you build into a different directory. |
| `TRUST_PROXY` | — | Set to `1` behind a reverse proxy so rate limits see the real client IP. |
| `TAMPER_DEMO` | — | Set to `1` to enable `POST /api/_demo/tamper`, which corrupts one audit entry so the broken-chain state can be shown. Never enable on a public deployment: it exists for local demos and screenshots. |
| `AGENT_PROVIDER` | `scripted` | `live` enables the LLM agent. Requires `AGENT_API_KEY`. |
| `AGENT_API_KEY` | — | API key for the OpenAI-compatible endpoint. Never commit it; pass it as a secret. |
| `AGENT_MODEL` | `gpt-4o-mini` | Model name sent to the endpoint. |
| `AGENT_BASE_URL` | `https://api.openai.com/v1` | Override for a compatible endpoint. |

The live agent is disabled by default. With `AGENT_PROVIDER=live`
and a key, prompt runs call the model once per request; any
failure falls back to the scripted happy path and the UI says so.
The model is never told the caps, the spend, or the verdicts.

## Without Docker

```sh
npm ci
npm run build
NODE_ENV=production node dist/server/api/main.js
```

Node 20 or newer. `better-sqlite3` ships prebuilt native bindings
for the usual platforms; on an exotic architecture the install
falls back to compiling, which needs Python, make, and a C++
compiler.

## Behind a proxy

Terminate TLS at the proxy and forward plain HTTP to the container
with `TRUST_PROXY=1`. The sandbox cookie is `HttpOnly` and
`SameSite=Lax`; it gets the `Secure` flag when `NODE_ENV` is
`production`, so the public site must be HTTPS or browsers will
refuse to store it.

## Verification status

The Dockerfile itself has not been run end to end: the machine
this was built on has no Docker daemon. What was verified instead:
the runtime stage's exact dependency set (`npm ci --omit=dev`
installs only fastify, `@fastify/cookie`, `@fastify/static`,
better-sqlite3, and zod), and the built server booting from that
dependency set alone, serving the UI, and creating a sandbox.
Run `npm run smoke` after any deployment to confirm the same
shape live: it boots the built server and checks the page, the
401-before-cookie, and sandbox creation.
