FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
RUN corepack enable && pnpm install --filter ./backend... --prod --frozen-lockfile
COPY backend/server.js ./backend/server.js
RUN mkdir -p /app/data/scores && chown -R node:node /app /workspace
USER node
WORKDIR /workspace/backend
EXPOSE 3000
CMD ["node", "server.js"]
