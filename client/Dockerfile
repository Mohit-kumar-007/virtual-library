# Builds the React app and serves it with Nginx, proxying /api and /socket.io to the API container.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci -w client --include-workspace-root
COPY client client
RUN npm run build -w client

FROM nginx:1.27-alpine
COPY deploy/nginx.docker.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 80
