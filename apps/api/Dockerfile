# Build stage - builds both frontend and backend
FROM node:20-alpine AS build
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install all dependencies (devDependencies needed for build)
RUN npm ci

# Copy source code
COPY . .

# Build backend TypeScript
RUN cd apps/api && npx tsc

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build frontend with Vite
RUN cd apps/web && npm run build

# Production stage - only runtime files
FROM node:20-alpine
WORKDIR /app

# Copy backend runtime files
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/apps/api/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./package.json
COPY --from=build /app/package.json ./package.json

# Copy frontend build
COPY --from=build /app/apps/web/dist ./public

EXPOSE 3000

CMD ["node", "dist/server.js"]
