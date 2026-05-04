# ─────────────────────────────────────────────
# Stage 1: Build
# ─────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: Production image
# ─────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy only production deps
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output
COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/main"]
