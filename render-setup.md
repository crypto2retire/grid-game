# Render Deployment Setup

## Step 1: Create Blueprint Instance
1. Go to https://dashboard.render.com/blueprints
2. Click "New Blueprint Instance"
3. Connect your GitHub repo: `crypto2retire/grid-game`
4. Select branch: `main`
5. Render will read the `render.yaml` file automatically

## Step 2: Environment Variables (Auto-Generated)
Render will auto-generate:
- `JWT_SECRET` - Random secure value
- `DAILY_SALT` - Random secure value
- `DATABASE_URL` - Auto-populated from the `grid-db` database

## Step 3: Manual Variables to Add After Deploy
After the first deploy, go to the web service dashboard and add:
- `FRONTEND_URL` = `https://grid-game.onrender.com` (or your custom domain)

## What Gets Deployed
- **Web Service**: `grid-game` - Single container running both API + frontend
- **Database**: `grid-db` - PostgreSQL managed by Render
- **Health Check**: `/api/health` endpoint configured

## Post-Deploy Steps
1. Wait for first deploy to complete
2. Check logs for "Database connected" and "Seeded" messages
3. Visit `https://grid-game.onrender.com` to test

## Future Deploys
Just push to `main` branch - Render auto-deploys on every push.
No tokens needed ever.
