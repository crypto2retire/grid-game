import { Router } from 'express';
import { listSports, summarizeSportEconomy, type SportId } from './sports.config';

export const sportsRouter = Router();

const commercialRoadmap = {
  positioning: 'Solana-powered multi-sport management economy with one shared DYN token.',
  launchOrder: ['american-football', 'soccer', 'basketball', 'baseball'] as SportId[],
  tokenThesis: 'Every sport adds utility sinks, asset demand, and marketplace volume for the same primary DYN token instead of fragmenting liquidity.',
  buildPrinciples: [
    'sport-agnostic core engine',
    'ledger-first economy accounting',
    'regular users earn through effort and skill',
    'whales fund infrastructure and contracts that regular users use',
    'limited-time widgets with capped supply and no identical reissues',
    'fast off-chain gameplay with Solana ownership and premium settlement',
  ],
  commercialReadinessGates: [
    'append-only currency ledger before real-money rewards',
    'admin economy dashboard sourced from live ledger rows',
    'anti-bot and abuse monitoring before cash-out',
    'clear risk language with no guaranteed-profit claims',
    'mobile-first UI with loading, empty, and error states',
    'source-complete marketplace and reward-pool reporting',
  ],
};

sportsRouter.get('/', (_req, res) => {
  const sports = listSports();
  res.json({
    status: 'ok',
    data: {
      sports,
      roadmap: commercialRoadmap,
      summaries: sports.map((sport) => ({
        id: sport.id,
        summary: summarizeSportEconomy(sport.id),
      })),
    },
  });
});

sportsRouter.get('/:sportId', (req, res) => {
  const sport = listSports().find((config) => config.id === req.params.sportId);

  if (!sport) {
    res.status(404).json({
      status: 'error',
      message: 'Sport configuration not found',
    });
    return;
  }

  res.json({
    status: 'ok',
    data: {
      sport,
      summary: summarizeSportEconomy(sport.id),
    },
  });
});
