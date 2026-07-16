# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Production stage ───────────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Copy built artifacts from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

# MCP uses stdio — no ports to expose
# Mount ~/.replyflow for config persistence

CMD ["node", "dist/index.js"]
