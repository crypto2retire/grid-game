import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Clock, Coins, ExternalLink, Landmark, Link2, Plus, ShieldCheck, WalletCards, Zap } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

interface WalletData {
  cash: number;
  dynTokens: number;
}

interface ChainNetwork {
  name: string;
  chainId: number | null;
  explorerUrl: string;
  nativeCurrency: string;
  ready: boolean;
  currencies: {
    CASH: { settlement: string; withdrawable: boolean };
    DYN: { settlement: string; withdrawable: boolean; tokenAddress: string | null };
    USDG: { settlement: string; withdrawable: boolean; tokenAddress: string | null };
  };
}

interface ChainWalletData {
  network: ChainNetwork;
  usdgBalance: number;
  chainWallet: {
    address: string;
    status: string;
    verifiedAt: string | null;
  } | null;
}

interface Transaction {
  id: string;
  currency: string;
  amount: number;
  balanceAfter: number | null;
  reason: string;
  sourceType?: string | null;
  sourceId?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
}

const REASON_LABELS: Record<string, string> = {
  GAME_DAY_NET_REVENUE: 'Game Day Revenue',
  MATCH_WIN_REWARD: 'Match Win Reward',
  MATCH_DRAW_REWARD: 'Match Draw Reward',
  MATCH_PARTICIPATION_REWARD: 'Match Participation',
  PLAYER_HIRE: 'Player Hire',
  PLAYER_SALE: 'Player Sale',
  MARKETPLACE_PURCHASE: 'Marketplace Purchase',
  MARKETPLACE_FEE: 'Marketplace Fee',
  SPONSOR_REWARD: 'Sponsor Reward',
  LEAGUE_BONUS: 'League Bonus',
  STADIUM_UPGRADE: 'Stadium Upgrade',
  TRANSPORTATION_PURCHASE: 'Transportation Purchase',
  PLAYER_DEVELOPMENT: 'Player Development',
};

const formatReason = (reason: string) => REASON_LABELS[reason] || reason
  .toLowerCase()
  .split('_')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const shortAddress = (address: string) => `${address.slice(0, 7)}…${address.slice(-5)}`;

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [chain, setChain] = useState<ChainWalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [address, setAddress] = useState('');
  const [chainMessage, setChainMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([fetchWallet(), fetchChainWallet(), fetchTransactions()]).finally(() => setLoading(false));
  }, []);

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const fetchWallet = async () => {
    try {
      const res = await fetch('/api/economy/wallet', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setWallet(data.data);
        useGameStore.getState().setWallet(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch wallet:', err);
    }
  };

  const fetchChainWallet = async () => {
    try {
      const res = await fetch('/api/solana/wallet', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setChain(data.data);
        if (data.data?.chainWallet?.address) setAddress(data.data.chainWallet.address);
      }
    } catch (err) {
      console.error('Failed to fetch Robinhood Chain wallet:', err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/economy/transactions', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    }
  };

  const topup = async (endpoint: string, amount: number) => {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ amount }),
      });
      if (res.ok) await fetchWallet();
    } catch (err) {
      console.error('Failed test top-up:', err);
    }
  };

  const connectAddress = async () => {
    setChainMessage(null);
    try {
      const res = await fetch('/api/solana/wallet/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to save address');
      setChainMessage(data.message);
      await fetchChainWallet();
    } catch (err) {
      setChainMessage(err instanceof Error ? err.message : 'Unable to save address');
    }
  };

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-accent" /></div>;
  }

  const totalEarned = transactions.filter((t) => t.currency === 'CASH' && t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const totalSpent = transactions.filter((t) => t.currency === 'CASH' && t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const network = chain?.network;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Finance</h1>
          <p className="mt-1 text-sm text-muted-foreground">CASH gameplay balance with DYN and USDG settlement on Robinhood Chain.</p>
        </div>
        {network && (
          <a href={network.explorerUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-300">
            <Landmark className="h-4 w-4" /> {network.name} <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      <section className="glass-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-white"><ShieldCheck className="h-5 w-5 text-emerald-400" /><strong>Payment rails</strong></div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">CASH stays inside the game. DYN is GRID utility and ownership settlement. USDG provides stable-value settlement for teams, stadiums, premium assets and tournaments.</p>
          </div>
          <div className={`rounded-full px-3 py-1 text-xs font-bold ${network?.ready ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}>
            {network?.ready ? 'Chain configured' : 'Awaiting RPC and token addresses'}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <BalanceCard icon={<Coins className="h-6 w-6" />} label="CASH" value={wallet?.cash || 0} detail="Off-chain gameplay currency" tone="yellow" action={<button onClick={() => topup('/api/economy/wallet/topup', 50000)}><Plus className="h-4 w-4" /> Add test CASH</button>} />
        <BalanceCard icon={<Zap className="h-6 w-6" />} label="DYN" value={wallet?.dynTokens || 0} detail="Robinhood Chain utility token" tone="purple" action={<button onClick={() => topup('/api/economy/wallet/topup-grid', 100000)}><Plus className="h-4 w-4" /> Add test DYN</button>} />
        <BalanceCard icon={<WalletCards className="h-6 w-6" />} label="USDG" value={chain?.usdgBalance || 0} detail="Stable-value Robinhood Chain settlement" tone="green" />
      </div>

      <section className="glass-card p-6">
        <div className="flex items-center gap-3"><Link2 className="h-5 w-5 text-cyan-300" /><div><h2 className="font-semibold text-white">Robinhood Chain wallet</h2><p className="text-xs text-muted-foreground">Saving an address does not enable withdrawals until signature verification is completed.</p></div></div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="0x…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 font-mono text-sm text-white outline-none focus:border-cyan-300/50" />
          <button onClick={connectAddress} className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">Save address</button>
        </div>
        {chain?.chainWallet && <div className="mt-3 flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-amber-300" /> {shortAddress(chain.chainWallet.address)} · {chain.chainWallet.status}</div>}
        {chainMessage && <p className="mt-3 text-sm text-amber-300">{chainMessage}</p>}
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MetricCard icon={<ArrowUp className="h-6 w-6 text-green-400" />} label="Total CASH credits" value={totalEarned} />
        <MetricCard icon={<ArrowDown className="h-6 w-6 text-red-400" />} label="Total CASH debits" value={totalSpent} />
      </div>

      <div className="glass-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Recent ledger activity</h2>
        {transactions.length === 0 ? (
          <div className="py-8 text-center"><Clock className="mx-auto mb-4 h-12 w-12 text-muted-foreground" /><p className="font-medium text-white">No ledger activity yet</p></div>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction) => {
              const positive = transaction.amount >= 0;
              return (
                <div key={transaction.id} className="space-y-2 rounded-lg bg-secondary p-3">
                  <div className="flex items-center justify-between gap-4"><div className="font-medium text-white text-sm">{formatReason(transaction.reason)}</div><div className={`text-sm font-bold ${positive ? 'text-green-400' : 'text-red-400'}`}>{positive ? '+' : ''}{transaction.amount.toLocaleString()} {transaction.currency}</div></div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{transaction.sourceType || 'Ledger'}</span><span>{new Date(transaction.createdAt).toLocaleDateString()}</span></div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function BalanceCard({ icon, label, value, detail, tone, action }: { icon: React.ReactNode; label: string; value: number; detail: string; tone: 'yellow' | 'purple' | 'green'; action?: React.ReactNode }) {
  const tones = { yellow: 'text-yellow-400 bg-yellow-400/10', purple: 'text-purple-400 bg-purple-400/10', green: 'text-emerald-400 bg-emerald-400/10' };
  return <div className="glass-card p-6"><div className="flex items-center gap-3"><div className={`grid h-12 w-12 place-items-center rounded-lg ${tones[tone]}`}>{icon}</div><div><div className="text-sm text-muted-foreground">{label} balance</div><div className="text-3xl font-bold text-white">{value.toLocaleString(undefined, { maximumFractionDigits: 6 })}</div></div></div><p className="mt-4 text-xs text-muted-foreground">{detail}</p>{action && <div className="mt-4 [&_button]:flex [&_button]:w-full [&_button]:items-center [&_button]:justify-center [&_button]:gap-2 [&_button]:rounded-lg [&_button]:bg-white/5 [&_button]:py-2 [&_button]:text-sm [&_button]:font-bold [&_button]:text-white">{action}</div>}</div>;
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="glass-card p-6"><div className="flex items-center gap-3">{icon}<div><div className="text-sm text-muted-foreground">{label}</div><div className="text-2xl font-bold text-white">{value.toLocaleString()}</div></div></div></div>;
}
