import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Swords, Trophy, Users, TrendingUp, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden py-24 px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 rounded-full mb-8">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              <span className="text-sm text-accent">Now in Beta</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              Build Your
              <span className="text-accent"> Dream Team</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              GRID is the ultimate sports management game. Build your squad, compete in matches,
              trade players, and climb the global leaderboard.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-8 py-4 bg-accent text-white rounded-lg font-semibold hover:bg-accent/90 transition-colors"
              >
                Start Playing <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/leaderboard"
                className="inline-flex items-center gap-2 px-8 py-4 bg-secondary text-white rounded-lg font-semibold hover:bg-secondary/80 transition-colors"
              >
                View Leaderboard
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Swords, title: 'Competitive Matches', desc: 'Face off against other managers in real-time simulated matches.' },
            { icon: Users, title: 'Player Management', desc: 'Build your squad with 200+ unique players. Scout, trade, and develop talent.' },
            { icon: Trophy, title: 'Global Leaderboard', desc: 'Compete for the top spot. Weekly tournaments and seasonal rewards.' },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="glass-card p-8"
            >
              <feature.icon className="w-10 h-10 text-accent mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '200+', label: 'Players' },
            { value: '1,000+', label: 'Matches Played' },
            { value: '500+', label: 'Managers' },
            { value: '50K', label: 'Starting CASH' },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl md:text-4xl font-bold text-accent mb-2">{stat.value}</div>
              <div className="text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">G</span>
            </div>
            <span className="font-bold text-white">GRID</span>
          </div>
          <p className="text-muted-foreground text-sm"> 2026 GRID Game. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
