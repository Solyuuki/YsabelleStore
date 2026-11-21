# Render backend for the Deployment branch. Docker build context: repository root.
# Multi-stage image retains the existing Express/Prisma + Python forecasting runtime.
FROM node:22-bookworm-slim AS build
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN npm ci --ignore-scripts
RUN npm run prisma:generate
RUN npm run build --workspace=@ysabellestore/backend

FROM node:22-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv libgomp1 openssl \
  && rm -rf /var/lib/apt/lists/*
COPY forecasting-service/requirements.txt /tmp/forecast-requirements.txt
COPY catalog-image-engine/requirements.txt /tmp/catalog-image-requirements.txt
RUN python3 -m venv /opt/ysabelle-python \
  && /opt/ysabelle-python/bin/python -m pip install --no-cache-dir \
    -r /tmp/forecast-requirements.txt -r /tmp/catalog-image-requirements.txt
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production \
    PYTHON_EXECUTABLE=/opt/ysabelle-python/bin/python \
    CATALOG_IMAGE_STORAGE_ROOT=/tmp/ysabelle-catalog-images \
    PORT=10000
EXPOSE 10000
CMD ["node", "backend/dist/src/server.js"]
