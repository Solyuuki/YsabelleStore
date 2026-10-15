# Sprint 13 Railway API with Python forecasting.
# Build context must remain the monorepo root.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY . .
RUN npm ci --ignore-scripts
RUN npm run prisma:generate
RUN npm run build --workspace=@ysabellestore/backend

FROM node:22-bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv libgomp1 \
    && rm -rf /var/lib/apt/lists/*
COPY forecasting-service/requirements.txt /tmp/forecast-requirements.txt
COPY catalog-image-engine/requirements.txt /tmp/catalog-image-requirements.txt
RUN python3 -m venv /opt/ysabelle-python \
    && /opt/ysabelle-python/bin/python -m pip install --no-cache-dir -r /tmp/forecast-requirements.txt -r /tmp/catalog-image-requirements.txt

WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production
ENV PYTHON_EXECUTABLE=/opt/ysabelle-python/bin/python
ENV CATALOG_IMAGE_STORAGE_ROOT=/data/catalog-images
ENV PORT=3001
EXPOSE 3001
CMD ["node", "backend/dist/src/server.js"]
