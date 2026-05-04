import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Package, AlertTriangle, TrendingUp, DollarSign,
  ShoppingCart, BarChart3, Users, Tag, ArrowRight
} from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuthStore } from '../store/authStore';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const KPICard = ({ title, value, sub, icon: Icon, color, trend }) => (
  <div className="card group hover:border-white/10 transition-all duration-300">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-slate-500 font-medium">{title}</p>
        <p className="text-3xl font-display font-bold text-white mt-1">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  </div>
);

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin } = useAuthStore();
  const [data, setData] = useState(null);
  const [salesStats, setSalesStats] = useState(null);
  const [period, setPeriod] = useState('7d');
  const [loading, setLoading] = useState(true);

  const fmt = (n) => new Intl.NumberFormat('fr-MA').format(n);

  useEffect(() => {
    const load = async () => {
      try {
        const [dashRes, statsRes] = await Promise.all([
          api.get('/dashboard'),
          api.get(`/sales/stats?period=${period}`),
        ]);
        setData(dashRes.data.data);
        setSalesStats(statsRes.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const chartData = {
    labels: salesStats?.dailyStats.map(d => d._id) || [],
    datasets: [{
      label: t('dashboard.revenue'),
      data: salesStats?.dailyStats.map(d => d.revenue) || [],
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99,102,241,0.1)',
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#6366f1',
      pointRadius: 4,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        titleColor: '#94a3b8',
        bodyColor: '#f1f5f9',
        callbacks: {
          label: ctx => `${fmt(ctx.parsed.y)} ${t('common.currency')}`,
        },
      },
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#475569', font: { size: 11 } } },
      y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#475569', font: { size: 11 }, callback: v => `${fmt(v)}` } },
    },
  };

  const topProductsData = {
    labels: salesStats?.topProducts.map(p => p.name.slice(0, 15)) || [],
    datasets: [{
      label: t('dashboard.revenue'),
      data: salesStats?.topProducts.map(p => p.totalRevenue) || [],
      backgroundColor: ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'],
      borderRadius: 6,
    }],
  };

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white">{t('dashboard.title')}</h1>
        <p className="text-slate-500 text-sm mt-1">{new Date().toLocaleDateString('fr-MA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KPICard title={t('dashboard.totalProducts')} value={fmt(data?.inventory.total || 0)}
          icon={Package} color="bg-primary-600/20 text-primary-400" />
        <KPICard title={t('dashboard.lowStock')} value={fmt((data?.inventory.lowStock || 0) + (data?.inventory.outOfStock || 0))}
          icon={AlertTriangle} color="bg-yellow-600/20 text-yellow-400" />
        <KPICard title={t('dashboard.todaySales')} value={`${fmt(data?.sales.today.revenue || 0)}`}
          sub={`${data?.sales.today.count || 0} ${t('sales.title').toLowerCase()}`}
          icon={ShoppingCart} color="bg-green-600/20 text-green-400" />
        <KPICard title={t('dashboard.monthSales')} value={`${fmt(data?.sales.month.revenue || 0)}`}
          sub={`${data?.sales.month.count || 0} ${t('sales.title').toLowerCase()}`}
          icon={TrendingUp} color="bg-blue-600/20 text-blue-400" />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KPICard title={t('dashboard.inventoryValue')} value={`${fmt(data?.inventory.value || 0)}`}
          icon={DollarSign} color="bg-purple-600/20 text-purple-400" />
        <KPICard title={t('dashboard.categories')} value={data?.inventory.categories || 0}
          icon={Tag} color="bg-orange-600/20 text-orange-400" />
        <KPICard title={t('dashboard.users')} value={data?.inventory.users || 0}
          icon={Users} color="bg-cyan-600/20 text-cyan-400" />
        <KPICard title={t('dashboard.yearSales')} value={`${fmt(data?.sales.year.revenue || 0)}`}
          icon={BarChart3} color="bg-rose-600/20 text-rose-400" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Sales chart */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-white">{t('dashboard.salesOverTime')}</h2>
            <div className="flex gap-1.5">
              {['7d', '30d', '90d'].map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors
                    ${period === p ? 'bg-primary-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-container">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Low stock alerts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">{t('dashboard.lowStockAlerts')}</h2>
            <span className="badge badge-red">{data?.lowStockList?.length || 0}</span>
          </div>
          {data?.lowStockList?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-600">
              <Package className="w-10 h-10 mb-2" />
              <p className="text-sm">{t('dashboard.noAlerts')}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data?.lowStockList?.map(p => (
                <div key={p._id} className="flex items-center justify-between p-3 rounded-lg bg-white/3 border border-white/5">
                  <div>
                    <p className="text-sm font-medium text-white truncate max-w-[120px]">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.category?.name}</p>
                  </div>
                  <span className={`badge text-xs ${p.quantity === 0 ? 'badge-red' : 'badge-yellow'}`}>
                    {p.quantity} {p.quantity === 0 ? '⚠' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => navigate('/products?availability=low_stock')}
            className="w-full mt-4 text-sm text-primary-400 hover:text-primary-300 flex items-center justify-center gap-1 transition-colors"
          >
            {t('common.view')} <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Recent sales + Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent sales */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">{t('dashboard.recentSales')}</h2>
            <button onClick={() => navigate('/sales/history')} className="text-xs text-primary-400 hover:text-primary-300">
              {t('common.view')} →
            </button>
          </div>
          <div className="space-y-2">
            {data?.recentSales?.map(sale => (
              <div key={sale._id} className="flex items-center justify-between p-3 rounded-lg bg-white/3 border border-white/5">
                <div>
                  <p className="text-sm font-medium text-white">{sale.receiptNumber}</p>
                  <p className="text-xs text-slate-500">{sale.seller?.username} · {format(new Date(sale.createdAt), 'dd/MM HH:mm')}</p>
                </div>
                <span className="text-sm font-semibold text-green-400">{fmt(sale.total)} {t('common.currency')}</span>
              </div>
            ))}
            {!data?.recentSales?.length && (
              <p className="text-slate-600 text-sm text-center py-8">{t('sales.noSales')}</p>
            )}
          </div>
        </div>

        {/* Top products */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Top Produits ({period})</h2>
          <div className="chart-container" style={{ height: '200px' }}>
            <Bar data={topProductsData} options={{
              ...chartOptions,
              indexAxis: 'y',
              plugins: { ...chartOptions.plugins, legend: { display: false } },
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}
