import { Router } from 'express';
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
  walletLinkingEnabled: false,
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
      SELECT "usdgBalance" FROM "Wallet" WHERE "userId" = ${userId}
    `;
    const chainWalletRows = await prisma.$queryRaw<Array<{
      address: string;
      status: string;
      verifiedAt: Date | null;
    }>>`
      SELECT "address", "status", "verifiedAt"
      FROM "ChainWallet"
      WHERE "userId" = ${userId} AND "chain" = 'ROBINHOOD'
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

// Security hold: never accept a wallet address based only on client attestation.
// Re-enable only after nonce issuance, domain binding, expiration, single-use
// consumption, and EIP-191/SIWE signature recovery are implemented and tested.
router.post(
  '/wallet/connect',
  authMiddleware,
  asyncHandler(async (_req: AuthRequest, _res) => {
    throw new AppError(
      503,
      'Wallet linking is temporarily disabled until cryptographic ownership verification is available.',
    );
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
      WHERE "userId" = ${req.user!.id} AND "chain" = 'ROBINHOOD'
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
