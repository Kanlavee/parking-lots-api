# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY package*.json ./
RUN npm ci --only=production=false

# Copy source and compile TypeScript
COPY . .
RUN npm run build

# ─── Stage 2: Runner ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Install only production dependencies in the final image
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy compiled output from builder stage
COPY --from=builder /app/dist ./dist

# Non-root user for security
RUN addgroup --system app && adduser --system --ingroup app app
USER app

EXPOSE 3000

CMD ["node", "dist/main"]
