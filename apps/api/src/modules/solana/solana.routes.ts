import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { prisma } from '../../config/database';
import { env } from '../../config/env';

const router = Router();

const robinhoodNetwork = () => ({
  key: 'ROBINHOOD_CHAIN',
  name: env.ROBINHOOD_CHAIN_NAME,
  chainId: env.ROBINHOOD_CHAIN_ID ?? null,
  rpcUrl: env.ROBINHOOD_CHAIN_RPC_URL ?? null,
  explorerUrl: env.ROBINHOOD_CHAIN_EXPLORER_URL,
  nativeCurrency: env.ROBINHOOD_CHAIN_NATIVE_SYMBOL,
  confirmationsRequired: env.ROBINHOOD_CONFIRMATIONS_REQUIRED,
  currencies: {
    CASH: { settlement: 'INTERNAL', withdrawable: false },
    DYN: {
      settlement: 'ROBINHOOD_CHAIN',
      withdrawable: true,
      tokenAddress: env.ROBINHOOD_DYN_TOKEN_ADDRESS ?? null,
    },
    USDG: {
      settlement: 'ROBINHOOD_CHAIN',
      withdrawable: true,
      tokenAddress: env.ROBINHOOD_USDG_TOKEN_ADDRESS ?? null,
    },
  },
  ready: Boolean(
    env.ROBINHOOD_CHAIN_ID &&
    env.ROBINHOOD_CHAIN_RPC_URL &&
    env.ROBINHOOD_DYN_TOKEN_ADDRESS &&
    env.ROBINHOOD_USDG_TOKEN_ADDRESS
  ),
});

// The router remains mounted at /api/solana for backward compatibility while
// clients migrate to Robinhood Chain. No Solana purchase flow is active.
router.get(
  '/network',
  asyncHandler(async (_req, res) => {
    res.json({
      status: 'success',
      data: robinhoodNetwork(),
      message: 'GRID uses Robinhood Chain for DYN and USDG settlement. CASH remains off-chain.',
    });
  }),
);

router.get(
  '/wallet',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const walletRows = await prisma.$queryRaw<Array<{ usdgBalance: Prisma.Decimal }>>`
      SELECT "usdgBalance" FROM "Wallet" WHERE "userId" = ${userId}::uuid
    `;
    const chainWalletRows = await prisma.$queryRaw<Array<{
      address: string;
      status: string;
      verifiedAt: Date | null;
    }>>`
      SELECT "address", "status", "verifiedAt"
      FROM "ChainWallet"
      WHERE "userId" = ${userId}::uuid AND "chain" = 'ROBINHOOD'
      LIMIT 1
    `;

    res.json({
      status: 'success',
      data: {
        network: robinhoodNetwork(),
        usdgBalance: Number(walletRows[0]?.usdgBalance ?? 0),
        chainWallet: chainWalletRows[0] ?? null,
      },
    });
  }),
);

router.post(
  '/wallet/connect',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const input = z.object({
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'A valid EVM address is required'),
    }).parse(req.body);
    const userId = req.user!.id;
    const address = input.address.toLowerCase();

    try {
      const rows = await prisma.$queryRaw<Array<{ address: string; status: string }>>`
        INSERT INTO "ChainWallet" ("userId", "chain", "address", "status", "updatedAt")
        VALUES (${userId}::uuid, 'ROBINHOOD', ${address}, 'UNVERIFIED', NOW())
        ON CONFLICT ("userId", "chain")
        DO UPDATE SET "address" = EXCLUDED."address", "status" = 'UNVERIFIED', "verifiedAt" = NULL, "updatedAt" = NOW()
        RETURNING "address", "status"
      `;

      res.json({
        status: 'success',
        data: rows[0],
        message: 'Robinhood Chain address saved. Signature verification is required before deposits or withdrawals are enabled.',
      });
    } catch (error: any) {
      if (String(error?.message || '').includes('ChainWallet_chain_address_key')) {
        throw new AppError(409, 'That Robinhood Chain address is already linked to another account');
      }
      throw error;
    }
  }),
);

router.get(
  '/transactions',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const rows = await prisma.$queryRaw<Array<{
      id: string;
      currency: string;
      direction: string;
      txHash: string;
      amountDisplay: Prisma.Decimal;
      status: string;
      confirmations: number;
      blockNumber: bigint | null;
      createdAt: Date;
      confirmedAt: Date | null;
    }>>`
      SELECT "id", "currency", "direction", "txHash", "amountDisplay", "status",
             "confirmations", "blockNumber", "createdAt", "confirmedAt"
      FROM "ChainTransaction"
      WHERE "userId" = ${req.user!.id}::uuid AND "chain" = 'ROBINHOOD'
      ORDER BY "createdAt" DESC
      LIMIT 100
    `;

    res.json({
      status: 'success',
      data: rows.map((row) => ({
        ...row,
        amountDisplay: Number(row.amountDisplay),
        blockNumber: row.blockNumber?.toString() ?? null,
      })),
    });
  }),
);

router.get(
  '/purchases',
  authMiddleware,
  asyncHandler(async (_req: AuthRequest, res) => {
    res.json({
      status: 'success',
      data: [],
      message: 'Solana purchases are retired. DYN and USDG settlement is moving to Robinhood Chain.',
    });
  }),
);

export const solanaRouter = router;
