# Static landing page: build with Node, serve dist/ with nginx.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Standalone deploy serves the site from the domain root.
ARG VITE_SITE_URL=https://ott24x7.com/ai
ARG VITE_BASE=/
ENV VITE_SITE_URL=${VITE_SITE_URL} VITE_BASE=${VITE_BASE}
RUN npm run build

FROM nginx:1.27-alpine
# Railway sets $PORT; the nginx image fills it into the template at start-up.
ENV PORT=8080
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
