# ---------- build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite inlines these at build time. BASE_PATH controls the sub-path.
ARG BASE_PATH=/analytics
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

# ---------- serve stage ----------
FROM nginx:1.27-alpine

# Same sub-path at runtime (nginx renders the template with envsubst).
ENV BASE_PATH=/analytics

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80
# nginx image's entrypoint runs envsubst on templates, then starts nginx.
