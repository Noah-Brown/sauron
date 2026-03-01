FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY config.ts ./
COPY src/ ./src/
COPY public/ ./public/

RUN mkdir -p data

EXPOSE 3333

CMD ["npx", "tsx", "src/index.ts"]
