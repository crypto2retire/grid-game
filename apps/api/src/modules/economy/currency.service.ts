import { AppError } from '../../middleware/errorHandler';
import { recordCurrencyLedger } from './ledger';
import { processBurn, processTreasuryInflow } from '../treasury/treasury.service';
import { ECONOMY_BALANCE_POLICY } from './balance.service';

export type WalletCurrency = 'CASH' | 'DYN' | 'SOL';

const WALLET_FIELD_BY_CURRENCY: Record<WalletCurrency, 'cash' | 'dynTokens' | 'solBalance'> = {
  CASH: 'cash',
  DYN: 'dynTokens',
  SOL: 'solBalance',
};

const CURRENCY_LABEL: Record<WalletCurrency, string> = {
  CASH: 'CASH',
  DYN: 'DYN',
  SOL: 'SOL',
};

export const MARKETPLACE_FEE_RATE = ECONOMY_BALANCE_POLICY.marketplaceSaleFeeRate;
export const SINK_BURN_RATE = 0.10;

export interface CurrencyMovementInput {
  userId: string;
  currency: WalletCurrency | string;
  amount: number;
  reason: string;
  sourceType?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
}

export interface DebitCurrencyInput extends CurrencyMovementInput {
  allowPartial?: boolean;
}

export interface CurrencyMovementResult {
  wallet: any;
  amount: number;
  currency: WalletCurrency;
}

export interface CurrencyDeltaInput extends CurrencyMovementInput {
  allowNegativeBalance?: boolean;
  allowPartial?: boolean;
}

export interface CurrencyExchangeInput {
  userId: string;
  fromCurrency: WalletCurrency | string;
  toCurrency: WalletCurrency | string;
  fromAmount: number;
  toAmount: number;
  reason: string;
  sourceType?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
}

export interface SetWalletBalancesInput {
  userId: string;
  cash?: number;
  dynTokens?: number;
  solBalance?: number;
  reason: string;
  sourceType?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
}

export interface MarketplaceSettlementInput {
  buyerId: string;
  sellerId?: string | null;
  currency: WalletCurrency | string;
  price: number;
  reasonPrefix: string;
  sourceType: string;
  sourceId: string;
  metadata?: Record<string, unknown>;
  feeRate?: number;
}

export function normalizeCurrency(currency: WalletCurrency | string): WalletCurrency {
  const normalized = String(currency || '').trim().toUpperCase();
  if (normalized === 'GRID') return 'DYN';
  if (normalized === 'CASH' || normalized === 'DYN' || normalized === 'SOL') return normalized;
  throw new AppError(400, `Unsupported currency: ${currency}`);
}

export function walletFieldForCurrency(currency: WalletCurrency | string) {
  return WALLET_FIELD_BY_CURRENCY[normalizeCurrency(currency)];
}

export function getWalletBalance(wallet: any, currency: WalletCurrency | string): number {
  const field = walletFieldForCurrency(currency);
  return Number(wallet?.[field] ?? 0);
}

const SOL_DECIMAL_PLACES = 9;
const SOL_UNIT = 10 ** SOL_DECIMAL_PLACES;

function roundSol(amount: number): number {
  return Math.round(amount * SOL_UNIT) / SOL_UNIT;
}

function normalizeAmountForCurrency(currency: WalletCurrency, amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new AppError(400, 'Currency amount must be a finite number');
  }
  if (currency === 'SOL') {
    return Math.max(0, roundSol(amount));
  }
  return Math.max(0, Math.round(amount));
}

function normalizeSignedAmountForCurrency(currency: WalletCurrency, amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new AppError(400, 'Currency amount must be a finite number');
  }
  if (currency === 'SOL') {
    return roundSol(amount);
  }
  return Math.round(amount);
}

function ledgerBalance(wallet: any, currency: WalletCurrency): number {
  const balance = getWalletBalance(wallet, currency);
  return currency === 'SOL' ? roundSol(balance) : Math.round(balance);
}

function formatCurrencyAmount(amount: number, currency: WalletCurrency): string {
  return currency === 'SOL' ? roundSol(amount).toLocaleString(undefined, { maximumFractionDigits: SOL_DECIMAL_PLACES }) : Math.round(amount).toLocaleString();
}

async function ensureWallet(tx: any, userId: string) {
  const existing = await tx.wallet.findUnique({ where: { userId } });
  if (existing) return existing;
  return tx.wallet.create({ data: { userId } });
}

export async function creditCurrency(tx: any, input: CurrencyMovementInput): Promise<CurrencyMovementResult> {
  const currency = normalizeCurrency(input.currency);
  const amount = normalizeAmountForCurrency(currency, input.amount);
  const field = WALLET_FIELD_BY_CURRENCY[currency];

  await ensureWallet(tx, input.userId);

  const wallet = amount > 0
    ? await tx.wallet.update({
        where: { userId: input.userId },
        data: { [field]: { increment: amount } },
      })
    : await tx.wallet.findUnique({ where: { userId: input.userId } });

  if (amount > 0) {
    await recordCurrencyLedger(tx, {
      userId: input.userId,
      currency: CURRENCY_LABEL[currency],
      amount,
      balanceAfter: ledgerBalance(wallet, currency),
      reason: input.reason,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadata: input.metadata,
    });

    // Track DYN inflows/outflows for the luck system after the ledger is written.
    // Marketplace transfers are handled separately so buyer/seller movements do
    // not inflate earned/sold metrics.
    if (currency === 'DYN') {
      if (input.sourceType === 'MARKETPLACE_TRANSFER') {
        // no-op: handled by marketplace settlement
      } else if (input.sourceType === 'EXCHANGE' || input.sourceType === 'SOL_PURCHASE' || input.reason === 'TOKEN_PURCHASE') {
        await tx.wallet.update({
          where: { userId: input.userId },
          data: { lifetimeDynPurchased: { increment: amount } },
        });
      } else {
        await tx.wallet.update({
          where: { userId: input.userId },
          data: { lifetimeDynEarned: { increment: amount } },
        });
      }
    }
  }

  return { wallet, amount, currency };
}

export async function debitCurrency(tx: any, input: DebitCurrencyInput): Promise<CurrencyMovementResult> {
  const currency = normalizeCurrency(input.currency);
  const requestedAmount = normalizeAmountForCurrency(currency, input.amount);
  const field = WALLET_FIELD_BY_CURRENCY[currency];

  const walletBefore = await tx.wallet.findUnique({ where: { userId: input.userId } });
  if (!walletBefore) {
    throw new AppError(404, 'Wallet not found');
  }

  const currentBalance = getWalletBalance(walletBefore, currency);
  const amount = input.allowPartial ? Math.min(currentBalance, requestedAmount) : requestedAmount;

  if (amount <= 0) {
    if (input.allowPartial) {
      return { wallet: walletBefore, amount: 0, currency };
    }
    throw new AppError(400, `Need ${formatCurrencyAmount(requestedAmount, currency)} ${CURRENCY_LABEL[currency]}`);
  }

  let wallet;
  if (input.allowPartial) {
    wallet = await tx.wallet.update({
      where: { userId: input.userId },
      data: { [field]: { decrement: amount } },
    });
  } else {
    const updated = await tx.wallet.updateMany({
      where: { userId: input.userId, [field]: { gte: amount } },
      data: { [field]: { decrement: amount } },
    });

    if (updated.count !== 1) {
      throw new AppError(400, `Insufficient ${CURRENCY_LABEL[currency]}. Need ${formatCurrencyAmount(amount, currency)} ${CURRENCY_LABEL[currency]}`);
    }

    wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
  }

  await recordCurrencyLedger(tx, {
    userId: input.userId,
    currency: CURRENCY_LABEL[currency],
    amount: -amount,
    balanceAfter: ledgerBalance(wallet, currency),
    reason: input.reason,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    metadata: {
      ...(input.metadata ?? {}),
      requestedAmount,
      partial: amount !== requestedAmount,
    },
  });

  // Track DYN outflows for the luck system. Marketplace transfers are handled
  // separately so that selling a token on the marketplace does not inflate
  // lifetimeSold. Sinks/spending do count toward sold because the token is
  // leaving the player's wallet permanently.
  if (currency === 'DYN' && amount > 0 && input.sourceType !== 'MARKETPLACE_TRANSFER') {
    await tx.wallet.update({
      where: { userId: input.userId },
      data: { lifetimeDynSold: { increment: amount } },
    });
  }

  return { wallet, amount, currency };
}

export async function applyCurrencyDelta(tx: any, input: CurrencyDeltaInput): Promise<CurrencyMovementResult> {
  const currency = normalizeCurrency(input.currency);
  const amount = normalizeSignedAmountForCurrency(currency, input.amount);

  if (amount > 0) {
    return creditCurrency(tx, { ...input, currency, amount });
  }

  if (amount < 0) {
    const debitAmount = Math.abs(amount);
    if (!input.allowNegativeBalance) {
      return debitCurrency(tx, { ...input, currency, amount: debitAmount, allowPartial: input.allowPartial });
    }

    const field = WALLET_FIELD_BY_CURRENCY[currency];
    const walletBefore = await tx.wallet.findUnique({ where: { userId: input.userId } });
    if (!walletBefore) {
      throw new AppError(404, 'Wallet not found');
    }

    const wallet = await tx.wallet.update({
      where: { userId: input.userId },
      data: { [field]: { decrement: debitAmount } },
    });

    await recordCurrencyLedger(tx, {
      userId: input.userId,
      currency: CURRENCY_LABEL[currency],
      amount,
      balanceAfter: ledgerBalance(wallet, currency),
      reason: input.reason,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadata: {
        ...(input.metadata ?? {}),
        allowNegativeBalance: true,
      },
    });

    return { wallet, amount: debitAmount, currency };
  }

  const wallet = await ensureWallet(tx, input.userId);
  return { wallet, amount: 0, currency };
}

export async function setWalletBalances(tx: any, input: SetWalletBalancesInput) {
  const walletBefore = await ensureWallet(tx, input.userId);
  const data: Record<string, number> = {};
  const movements: Array<{ currency: WalletCurrency; amount: number; balanceAfter: number }> = [];

  if (input.cash !== undefined) {
    const cash = normalizeAmountForCurrency('CASH', input.cash);
    data.cash = cash;
    movements.push({ currency: 'CASH', amount: cash - Math.round(walletBefore.cash ?? 0), balanceAfter: cash });
  }

  if (input.dynTokens !== undefined) {
    const dynTokens = normalizeAmountForCurrency('DYN', input.dynTokens);
    data.dynTokens = dynTokens;
    movements.push({ currency: 'DYN', amount: dynTokens - Math.round(walletBefore.dynTokens ?? 0), balanceAfter: dynTokens });
  }

  if (input.solBalance !== undefined) {
    if (!Number.isFinite(input.solBalance)) {
      throw new AppError(400, 'SOL balance must be a finite number');
    }
    const solBalance = normalizeAmountForCurrency('SOL', input.solBalance);
    data.solBalance = solBalance;
    movements.push({ currency: 'SOL', amount: roundSol(solBalance - Number(walletBefore.solBalance ?? 0)), balanceAfter: solBalance });
  }

  const wallet = Object.keys(data).length > 0
    ? await tx.wallet.update({ where: { userId: input.userId }, data })
    : walletBefore;

  for (const movement of movements) {
    if (movement.amount === 0) continue;
    await recordCurrencyLedger(tx, {
      userId: input.userId,
      currency: CURRENCY_LABEL[movement.currency],
      amount: movement.amount,
      balanceAfter: movement.balanceAfter,
      reason: input.reason,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadata: input.metadata,
    });
  }

  return wallet;
}

export async function exchangeCurrency(tx: any, input: CurrencyExchangeInput) {
  const fromCurrency = normalizeCurrency(input.fromCurrency);
  const toCurrency = normalizeCurrency(input.toCurrency);
  const fromAmount = normalizeAmountForCurrency(fromCurrency, input.fromAmount);
  const toAmount = normalizeAmountForCurrency(toCurrency, input.toAmount);
  const metadata = {
    ...(input.metadata ?? {}),
    fromCurrency: CURRENCY_LABEL[fromCurrency],
    toCurrency: CURRENCY_LABEL[toCurrency],
    fromAmount,
    toAmount,
  };

  const debit = await debitCurrency(tx, {
    userId: input.userId,
    currency: fromCurrency,
    amount: fromAmount,
    reason: input.reason,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    metadata,
  });

  const credit = await creditCurrency(tx, {
    userId: input.userId,
    currency: toCurrency,
    amount: toAmount,
    reason: input.reason,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    metadata,
  });

  return { debit, credit, wallet: credit.wallet };
}

export async function processCurrencySink(
  tx: any,
  currencyInput: WalletCurrency | string,
  amountInput: number,
  reason: string,
  sourceType?: string,
  sourceId?: string,
  metadata: Record<string, unknown> = {},
) {
  const currency = normalizeCurrency(currencyInput);
  const amount = normalizeAmountForCurrency(currency, amountInput);
  if (amount <= 0) {
    return { treasuryAmount: 0, burnAmount: 0 };
  }

  const burnAmount = currency === 'SOL' ? 0 : Math.floor(amount * SINK_BURN_RATE);
  const treasuryAmount = amount - burnAmount;

  if (treasuryAmount > 0) {
    await processTreasuryInflow(tx, CURRENCY_LABEL[currency], treasuryAmount, reason, sourceId, sourceType, metadata);
  }
  if (burnAmount > 0) {
    await processBurn(tx, CURRENCY_LABEL[currency], burnAmount, reason, sourceId, sourceType, metadata);
  }

  return { treasuryAmount, burnAmount };
}

export function calculateMarketplaceFee(priceInput: number, currencyInput: WalletCurrency | string, feeRate: number = MARKETPLACE_FEE_RATE) {
  const currency = normalizeCurrency(currencyInput);
  const price = normalizeAmountForCurrency(currency, priceInput);
  const feeAmount = currency === 'SOL' ? roundSol(price * feeRate) : Math.ceil(price * feeRate);
  const treasuryAmount = currency === 'SOL' ? feeAmount : Math.floor(feeAmount * 0.9);
  const burnAmount = currency === 'SOL' ? 0 : feeAmount - treasuryAmount;
  const sellerReceives = price - feeAmount;

  return {
    currency,
    price,
    feeAmount,
    treasuryAmount,
    burnAmount,
    sellerReceives,
  };
}

export async function settleMarketplaceSale(tx: any, input: MarketplaceSettlementInput) {
  const fee = calculateMarketplaceFee(input.price, input.currency, input.feeRate);
  const metadata = {
    ...(input.metadata ?? {}),
    price: fee.price,
    currency: CURRENCY_LABEL[fee.currency],
    feeAmount: fee.feeAmount,
    treasuryAmount: fee.treasuryAmount,
    burnAmount: fee.burnAmount,
    sellerReceives: fee.sellerReceives,
  };

  const buyer = await debitCurrency(tx, {
    userId: input.buyerId,
    currency: fee.currency,
    amount: fee.price,
    reason: `${input.reasonPrefix}_PURCHASE`,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    metadata,
  });

  let seller: CurrencyMovementResult | null = null;
  if (input.sellerId && fee.sellerReceives > 0) {
    seller = await creditCurrency(tx, {
      userId: input.sellerId,
      currency: fee.currency,
      amount: fee.sellerReceives,
      reason: `${input.reasonPrefix}_SALE`,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadata: { ...metadata, buyerId: input.buyerId },
    });
  }

  if (fee.feeAmount > 0) {
    await processCurrencySink(
      tx,
      fee.currency,
      fee.feeAmount,
      `${input.reasonPrefix}_MARKETPLACE_FEE`,
      input.sourceType,
      input.sourceId,
      metadata,
    );
  }

  return { buyer, seller, ...fee };
}
