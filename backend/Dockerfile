FROM node:22.14.0-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN DATABASE_URL=postgresql://placeholder@127.0.0.1:5432/placeholder npm run db:generate && npm run build

FROM build AS migrate
CMD ["npm", "run", "db:deploy"]

FROM node:22.14.0-bookworm-slim AS runtime
ARG RELEASE_GIT_SHA=unknown
LABEL org.opencontainers.image.revision=$RELEASE_GIT_SHA
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4000
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=20s --timeout=4s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:4000/v1/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
