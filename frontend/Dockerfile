FROM node:24-alpine AS build
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
RUN corepack enable && pnpm install --filter ./frontend... --frozen-lockfile
COPY frontend ./frontend
RUN pnpm --filter ./frontend build

FROM nginx:1.29-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/frontend/dist/strudel-daw/browser /usr/share/nginx/html
EXPOSE 80
