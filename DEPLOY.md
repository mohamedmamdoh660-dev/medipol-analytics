# Deploying Medipol Analytics under `/analytics`

The app is a static Vite SPA that talks to Supabase + Ollama directly from the
browser. It is served under a sub-path (default **`/analytics`**) so it can live at
`https://automation.medipol.edu.tr/analytics` behind a Cloudflare Tunnel.

Everything (assets, fonts, video, favicon) is base-path aware via a single
`BASE_PATH` env var — nothing hard-codes `/analytics`.

---

## 1. Configure

```bash
cp .env.example .env
# edit .env → set VITE_SUPABASE_ANON_KEY and VITE_OLLAMA_URL
# BASE_PATH=/analytics and PORT=8098 are the defaults
```

## 2. Run with Docker (recommended — one command)

```bash
docker compose up -d --build
```

Then **test locally BEFORE Cloudflare**:

- Open **http://localhost:8098/analytics** → the full app loads; confirm in the
  browser Network tab that CSS/JS/images/video all load from `/analytics/assets/…`
  and `/analytics/…` (no 404s at the root).
- Health check: `curl http://localhost:8098/analytics/health` → `ok`

Change the port or sub-path by editing `.env` (`PORT`, `BASE_PATH`) and re-running
`docker compose up -d --build`.

## 3. Run without Docker (quick check)

```bash
BASE_PATH=/analytics npm run build
npm run preview      # → http://localhost:4173/analytics
```

## 4. Local development (root path, no sub-path)

```bash
npm install
npm run dev          # → http://localhost:5173/analytics  (set BASE_PATH=/ for root)
```

---

## 5. Behind Cloudflare Tunnel

- Point the tunnel/public hostname `automation.medipol.edu.tr` path
  **`/analytics*`** → `http://localhost:8098` (the container port).
- Cloudflare must **pass the `/analytics` prefix through** (do NOT strip it) — the
  app and nginx both expect the full path.
- Use `/analytics/health` as the tunnel health check.
- If you ever move the app to a different path, change `BASE_PATH` in `.env`,
  rebuild, and update the Cloudflare route to match.

> Note: no backend / no direct PostgreSQL — data comes from Supabase (`VITE_SUPABASE_URL`)
> and the AI features from Ollama (`VITE_OLLAMA_URL`). Make sure both are reachable
> from users' browsers and that Ollama allows CORS.
