FROM node:22-bookworm-slim
WORKDIR /worker
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --chmod=644 bootstrap.sql worker.mjs ./
USER node
CMD ["node", "worker.mjs"]
