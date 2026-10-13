FROM node:24-alpine
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
RUN corepack enable && pnpm install --filter ./frontend... --frozen-lockfile
COPY frontend ./frontend
WORKDIR /workspace/frontend
EXPOSE 4203
CMD ["pnpm", "run", "dev:docker"]
