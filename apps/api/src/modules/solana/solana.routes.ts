import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();

// GET /api/solana/purchases — list user's SOLANA purchase records
// NOTE: The mutable POST /purchase and /resale endpoints have been removed.
// Any on-chain Solana purchase flow must verify the transaction signature via
// RPC (recipient, mint, amount, finalized status, and signature uniqueness) and
// derive price server-side before writing a SolanaPurchase record. Client-
// attested prices or unverified signatures must not be accepted.
router.get(
  '/purchases',
  authMiddleware,
  asyncHandler(async (_req: any, res) => {
    res.json({
      status: 'success',
      data: [],
      message: 'Solana purchase records are not populated until on-chain verification is implemented.',
    });
  })
);

export const solanaRouter = router;
