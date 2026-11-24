FROM node:22.14.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json tailwind.config.ts postcss.config.cjs ./
COPY src ./src
COPY public ./public
ARG VITE_APP_MODE=live
ARG VITE_API_BASE_URL=/v1
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
RUN test -n "$VITE_SUPABASE_URL" && test -n "$VITE_SUPABASE_PUBLISHABLE_KEY" && npm run build

FROM nginx:1.28.0-alpine AS runtime
ARG RELEASE_GIT_SHA=unknown
LABEL org.opencontainers.image.revision=$RELEASE_GIT_SHA
LABEL org.opencontainers.image.source="https://github.com/Samyak191/kaamdhaam"
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
