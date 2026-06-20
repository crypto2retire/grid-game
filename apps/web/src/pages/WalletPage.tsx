import { useState, useEffect } from 'react';
import { ArrowDown, ArrowUp, Clock, Trophy, Coins } from 'lucide-react';

interface WalletData {
  cash: number;
  gridTokens: number;
}

interface Transaction {
  id: string;
  match: {
    id: string;
    homeScore: number;
    awayScore: number;
    completedAt: string;
    homeTeam: { name: string };
    awayTeam: { name: string };
  };
  side: string;
  cashWon: number;
  xpGained: number;
}

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

  const totalEarned = transactions.reduce((sum, t) => sum + t.cashWon, 0);
  const totalXP = transactions.reduce((sum, t) => sum + t.xpGained, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Wallet</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your CASH and view earnings
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
              <div className="text-sm text-muted-foreground">Total Earned</div>
              <div className="text-3xl font-bold text-white">
                {totalEarned.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            From matches and rewards
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-purple-400/10 rounded-lg flex items-center justify-center">
              <Trophy className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total XP</div>
              <div className="text-3xl font-bold text-white">
                {totalXP.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Experience gained from play
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Transactions</h2>
        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-white font-medium mb-1">No transactions yet</p>
            <p className="text-muted-foreground text-sm">Play matches to earn CASH and XP</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    t.cashWon >= 0 ? 'bg-green-400/10' : 'bg-red-400/10'
                  }`}>
                    {t.cashWon >= 0 ? (
                      <ArrowUp className="w-5 h-5 text-green-400" />
                    ) : (
                      <ArrowDown className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-white">
                      {t.match.homeTeam.name} vs {t.match.awayTeam.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Score: {t.match.homeScore} - {t.match.awayScore} • You played as {t.side}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${t.cashWon >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {t.cashWon >= 0 ? '+' : ''}{t.cashWon.toLocaleString()} CASH
                  </div>
                  <div className="text-sm text-purple-400">+{t.xpGained} XP</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
