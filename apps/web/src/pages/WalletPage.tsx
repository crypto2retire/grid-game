import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { Wallet, ArrowDown, ArrowUp, Clock, Trophy } from 'lucide-react';

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
  const { user } = useAuthStore();
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
      <h1 className="text-3xl font-bold text-white">Wallet</h1>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-yellow-400/10 rounded-lg flex items-center justify-center">
              <Wallet className="w-6 h-6 text-yellow-400" />
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
            <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
              <Trophy className="w-6 h-6 text-accent" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Earned</div>
              <div className="text-3xl font-bold text-green-400">
                +{totalEarned.toLocaleString()} CASH
              </div>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Total XP Gained: {totalXP.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Rewards Info */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Match Rewards</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-4 bg-secondary rounded-lg">
            <div className="w-10 h-10 bg-green-400/10 rounded-lg flex items-center justify-center">
              <ArrowUp className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <div className="font-semibold text-white">Win</div>
              <div className="text-sm text-green-400">5,000 CASH + XP</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-secondary rounded-lg">
            <div className="w-10 h-10 bg-yellow-400/10 rounded-lg flex items-center justify-center">
              <ArrowUp className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <div className="font-semibold text-white">Draw</div>
              <div className="text-sm text-yellow-400">2,000 CASH + XP</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-secondary rounded-lg">
            <div className="w-10 h-10 bg-red-400/10 rounded-lg flex items-center justify-center">
              <ArrowDown className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <div className="font-semibold text-white">Loss</div>
              <div className="text-sm text-red-400">1,000 CASH + XP</div>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Transaction History</h2>
        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No transactions yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Play matches to earn CASH and XP
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-4 bg-secondary rounded-lg"
              >
                <div>
                  <div className="font-medium text-white">
                    {transaction.match.homeTeam.name} vs {transaction.match.awayTeam.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {transaction.match.homeScore} - {transaction.match.awayScore} • {transaction.side}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {new Date(transaction.match.completedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-green-400">
                    +{transaction.cashWon.toLocaleString()} CASH
                  </div>
                  <div className="text-sm text-accent">
                    +{transaction.xpGained} XP
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
