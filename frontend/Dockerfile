# Dev image for the Next.js frontend workspace.
# Build context must be the monorepo root (see docker-compose.yml).
FROM node:22-alpine

WORKDIR /app

# Workspace manifests only — keeps dependency layers cacheable
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY studio/package.json ./studio/
COPY packages/mast-blocks/package.json ./packages/mast-blocks/
COPY astro-app/package.json ./astro-app/

RUN npm ci

# Sources needed when running the image without a bind mount.
# In compose, the repo is mounted over /app for live reload.
COPY packages/mast-blocks ./packages/mast-blocks
COPY frontend ./frontend

EXPOSE 3001

CMD ["npm", "run", "dev:docker", "--workspace=frontend"]
