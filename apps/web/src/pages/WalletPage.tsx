import { useState, useEffect } from 'react';
import { ArrowDown, ArrowUp, Clock, Coins } from 'lucide-react';

interface WalletData {
  cash: number;
  gridTokens: number;
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

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWallet();
    fetchTransactions();
  }, []);

  const fetchWallet = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/economy/wallet', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWallet(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch wallet:', err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/economy/transactions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
      </div>
    );
  }

  const totalEarned = transactions
    .filter((t) => t.currency === 'CASH' && t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const totalSpent = transactions
    .filter((t) => t.currency === 'CASH' && t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Wallet</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage CASH and review your full game economy ledger
          </p>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-yellow-400/10 rounded-lg flex items-center justify-center">
              <Coins className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">CASH Balance</div>
              <div className="text-3xl font-bold text-white">
                {wallet?.cash?.toLocaleString() || 0}
              </div>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Starting balance: 50,000 CASH
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-400/10 rounded-lg flex items-center justify-center">
              <ArrowUp className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Credits</div>
              <div className="text-3xl font-bold text-white">
                {totalEarned.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Top-ups, game rewards, and sale proceeds
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-400/10 rounded-lg flex items-center justify-center">
              <ArrowDown className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Debits</div>
              <div className="text-3xl font-bold text-white">
                {totalSpent.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Player hires and marketplace purchases
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Ledger Activity</h2>
        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-white font-medium mb-1">No ledger activity yet</p>
            <p className="text-muted-foreground text-sm">Hire players, play games, or use the marketplace to create activity</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((t) => {
              const positive = t.amount >= 0;
              return (
                <div key={t.id} className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      positive ? 'bg-green-400/10' : 'bg-red-400/10'
                    }`}>
                      {positive ? (
                        <ArrowUp className="w-5 h-5 text-green-400" />
                      ) : (
                        <ArrowDown className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-white">
                        {formatReason(t.reason)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {t.sourceType || 'Ledger'}{t.metadata?.sportId ? ` • ${t.metadata.sportId}` : ''} • {new Date(t.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${positive ? 'text-green-400' : 'text-red-400'}`}>
                      {positive ? '+' : ''}{t.amount.toLocaleString()} {t.currency}
                    </div>
                    {t.balanceAfter !== null && (
                      <div className="text-sm text-muted-foreground">Balance: {t.balanceAfter.toLocaleString()}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
