# Build stage - builds both frontend and backend
FROM node:20-alpine AS build
WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY turbo.json ./

# Copy workspace package files for dependency resolution
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

# Install production dependencies
COPY package*.json ./
COPY apps/api/package.json ./apps/api/
RUN npm ci --omit=dev

# Copy backend runtime files
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

# Copy frontend build to be served by the API
COPY --from=build /app/apps/web/dist ./apps/api/public

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["node", "dist/server.js"]
