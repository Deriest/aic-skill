import { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../api';

interface MetricsSummary {
  totalRequests: number;
  totalInput: number;
  totalOutput: number;
  totalCache: number;
  cacheHitRate: number;
  byWorker: Record<string, { requests: number; input: number; output: number; cache: number }>;
  byDay: Record<string, { requests: number; input: number; output: number; cache: number }>;
}

interface MetricEntry {
  id: string;
  timestamp: string;
  worker: string;
  tier: string;
  model: string;
  taskId?: string;
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
  durationSec: number;
}

type TimeRange = 'daily' | 'weekly' | 'monthly' | 'total';
type TierFilter = 'all' | 'thinker' | 'crafter' | 'sprinter';

export function CostsPage() {
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('daily');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, [timeRange, tierFilter]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      // Calculate date range
      const now = new Date();
      if (timeRange === 'daily') {
        const from = new Date(now);
        from.setDate(from.getDate() - 1);
        params.set('from', from.toISOString().slice(0, 10));
      } else if (timeRange === 'weekly') {
        const from = new Date(now);
        from.setDate(from.getDate() - 7);
        params.set('from', from.toISOString().slice(0, 10));
      } else if (timeRange === 'monthly') {
        const from = new Date(now);
        from.setMonth(from.getMonth() - 1);
        params.set('from', from.toISOString().slice(0, 10));
      }
      
      if (tierFilter !== 'all') {
        params.set('tier', tierFilter);
      }
      
      const data = await api.getMetrics(params.toString());
      setSummary(data.summary);
      setMetrics(data.metrics);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getChartData = () => {
    const days = Object.entries(summary?.byDay || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14); // Last 14 days
    
    return days.map(([day, data]) => ({
      date: day.slice(5), // MM-DD
      input: data.input,
      output: data.output,
      cache: data.cache,
      requests: data.requests,
    }));
  };

  const getWorkerData = () => {
    return Object.entries(summary?.byWorker || {})
      .map(([worker, data]) => ({
        worker,
        requests: data.requests,
        input: data.input,
        output: data.output,
        cache: data.cache,
      }))
      .sort((a, b) => b.requests - a.requests);
  };

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-aic-accent font-pixel animate-pulse">LOADING METRICS...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full p-4 min-h-0 overflow-auto">
      {/* Header with filters */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h2 className="text-px-lg font-pixel text-aic-accent tracking-widest uppercase">
          TOKEN COSTS
        </h2>
        
        <div className="flex gap-4">
          {/* Time Range Filter */}
          <div className="flex gap-1 bg-aic-bg-panel border border-aic-border/50 rounded p-1">
            {(['daily', 'weekly', 'monthly', 'total'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 font-pixel text-px-xs uppercase transition-colors ${
                  timeRange === range
                    ? 'bg-aic-accent text-aic-bg-dark'
                    : 'text-aic-text-muted hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          
          {/* Tier Filter */}
          <div className="flex gap-1 bg-aic-bg-panel border border-aic-border/50 rounded p-1">
            {(['all', 'thinker', 'crafter', 'sprinter'] as TierFilter[]).map((tier) => (
              <button
                key={tier}
                onClick={() => setTierFilter(tier)}
                className={`px-3 py-1 font-pixel text-px-xs uppercase transition-colors ${
                  tierFilter === tier
                    ? 'bg-aic-accent text-aic-bg-dark'
                    : 'text-aic-text-muted hover:text-white'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-3 mb-4 shrink-0">
        <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded p-4 flex flex-col items-center">
          <span className="text-3xl text-aic-accent mb-1">{summary?.totalRequests || 0}</span>
          <span className="text-px-sm text-aic-text-muted uppercase tracking-widest">REQUESTS</span>
        </div>
        <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded p-4 flex flex-col items-center">
          <span className="text-3xl text-aic-green mb-1">{formatNumber(summary?.totalInput || 0)}</span>
          <span className="text-px-sm text-aic-text-muted uppercase tracking-widest">INPUT</span>
        </div>
        <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded p-4 flex flex-col items-center">
          <span className="text-3xl text-aic-yellow mb-1">{formatNumber(summary?.totalOutput || 0)}</span>
          <span className="text-px-sm text-aic-text-muted uppercase tracking-widest">OUTPUT</span>
        </div>
        <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded p-4 flex flex-col items-center">
          <span className="text-3xl text-aic-cyan mb-1">{formatNumber(summary?.totalCache || 0)}</span>
          <span className="text-px-sm text-aic-text-muted uppercase tracking-widest">CACHE</span>
        </div>
        <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded p-4 flex flex-col items-center">
          <span className="text-3xl text-aic-accent mb-1">
            {((summary?.cacheHitRate || 0) * 100).toFixed(1)}%
          </span>
          <span className="text-px-sm text-aic-text-muted uppercase tracking-widest">HIT RATE</span>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4 mb-4 min-h-[300px]">
        {/* Tokens Over Time */}
        <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded p-4">
          <h3 className="font-pixel text-px-sm text-aic-text-muted uppercase tracking-widest mb-3">
            TOKENS OVER TIME
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={getChartData()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 10 }} />
              <YAxis stroke="#666" tick={{ fontSize: 10 }} tickFormatter={formatNumber} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #444' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Area type="monotone" dataKey="input" stackId="1" stroke="#00ff88" fill="#00ff8840" name="Input" />
              <Area type="monotone" dataKey="output" stackId="1" stroke="#ffaa00" fill="#ffaa0040" name="Output" />
              <Area type="monotone" dataKey="cache" stackId="1" stroke="#00ccff" fill="#00ccff40" name="Cache" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* By Worker */}
        <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded p-4">
          <h3 className="font-pixel text-px-sm text-aic-text-muted uppercase tracking-widest mb-3">
            BY WORKER
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={getWorkerData()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="worker" stroke="#666" tick={{ fontSize: 10 }} />
              <YAxis stroke="#666" tick={{ fontSize: 10 }} tickFormatter={formatNumber} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #444' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Bar dataKey="input" fill="#00ff88" name="Input" />
              <Bar dataKey="output" fill="#ffaa00" name="Output" />
              <Bar dataKey="cache" fill="#00ccff" name="Cache" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-Worker Table */}
      <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded p-4 flex-1 min-h-0 overflow-auto">
        <h3 className="font-pixel text-px-sm text-aic-text-muted uppercase tracking-widest mb-3">
          PER-WORKER BREAKDOWN
        </h3>
        <table className="w-full font-pixel text-px-xs">
          <thead>
            <tr className="border-b border-aic-border/50 text-aic-text-muted">
              <th className="text-left py-2">WORKER</th>
              <th className="text-right py-2">REQUESTS</th>
              <th className="text-right py-2">INPUT</th>
              <th className="text-right py-2">OUTPUT</th>
              <th className="text-right py-2">CACHE</th>
              <th className="text-right py-2">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {getWorkerData().map((row) => (
              <tr key={row.worker} className="border-b border-aic-border/30 hover:bg-aic-border/10">
                <td className="py-2 text-aic-accent">{row.worker.toUpperCase()}</td>
                <td className="py-2 text-right text-aic-text-bright">{row.requests}</td>
                <td className="py-2 text-right text-aic-green">{formatNumber(row.input)}</td>
                <td className="py-2 text-right text-aic-yellow">{formatNumber(row.output)}</td>
                <td className="py-2 text-right text-aic-cyan">{formatNumber(row.cache)}</td>
                <td className="py-2 text-right text-aic-text-bright">
                  {formatNumber(row.input + row.output + row.cache)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
