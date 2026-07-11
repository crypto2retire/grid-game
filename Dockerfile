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
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client before TypeScript so new models are available in clean Docker builds
RUN cd apps/api && npx prisma generate

# Build backend TypeScript
RUN cd apps/api && npx tsc

# Harden compiled static serving so stale asset URLs never receive index.html
RUN node apps/api/scripts/patch-static-serving.mjs

# Build frontend with Vite
RUN cd apps/web && npm run build

# Production stage - only runtime files
FROM node:20-alpine
WORKDIR /app

# Install production dependencies
COPY package*.json ./
COPY turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm install --omit=dev

# Copy backend runtime files
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

# Copy Prisma generated client (critical!)
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Copy frontend build to be served by the API
COPY --from=build /app/apps/web/dist ./apps/api/public

WORKDIR /app/apps/api

EXPOSE 3000

# Run migrations and an idempotent additive-column repair before starting server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/scripts/ensureProductionSchema.js && node dist/server.js"]