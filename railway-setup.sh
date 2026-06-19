#!/bin/bash
# Railway setup script - run this locally to configure the project

set -e

echo "=== GRID Game Railway Setup ==="
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Login to Railway (uses token from env or prompts)
echo "Logging into Railway..."
railway login || true

# Link to the project
echo "Linking to grid-game project..."
railway link --project f8a0a8f7-59ae-424c-a10f-b88dd78ea9b7

echo ""
echo "=== Configuration Complete ==="
echo ""
echo "Next steps:"
echo "1. Set environment variables in Railway dashboard:"
echo "   - DATABASE_URL (from Postgres service)"
echo "   - REDIS_URL (from Redis service)"
echo "   - JWT_SECRET (generate: openssl rand -base64 32)"
echo "   - FRONTEND_URL (your web domain)"
echo "   - NODE_ENV=production"
echo ""
echo "2. Deploy with: railway up"
echo ""
echo "3. Or push to main branch to trigger GitHub Actions deploy"
