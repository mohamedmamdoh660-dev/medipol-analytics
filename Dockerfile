# ---------- build stage ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite inlines these at build time. BASE_PATH="/" = served at the domain root.
ARG BASE_PATH=/
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_OLLAMA_URL
ARG VITE_OLLAMA_MODEL
ENV BASE_PATH=$BASE_PATH \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_OLLAMA_URL=$VITE_OLLAMA_URL \
    VITE_OLLAMA_MODEL=$VITE_OLLAMA_MODEL

RUN npm run build

# ---------- runtime stage (Node serves the SPA + secure admin API) ----------
FROM node:22-alpine AS runtime
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY server ./server

# Runtime secrets (server-side ONLY — never exposed to the browser):
#   SUPABASE_SERVICE_ROLE  → set in Coolify / .env
#   SUPABASE_URL           → defaults to VITE_SUPABASE_URL if unset
ENV PORT=80
EXPOSE 80

CMD ["node", "server/index.js"]
