# Browser Storefront + protected Retail web; installers built separately.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY . .
RUN npm ci --ignore-scripts

ARG VITE_API_BASE_URL
RUN test -n "$VITE_API_BASE_URL" || (echo "VITE_API_BASE_URL is required at build time" >&2 && exit 1)
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV FRONTEND_URL=http://localhost:5173
ENV YSABELLE_WEB_DEPLOY=1
RUN npm run build --workspace=@ysabellestore/frontend

FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=build /app/frontend/dist /app/public
COPY deployment/railway/static-server.mjs /app/server.mjs
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "/app/server.mjs"]
