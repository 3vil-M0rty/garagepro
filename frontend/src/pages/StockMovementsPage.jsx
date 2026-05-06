import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  TrendingUp, TrendingDown, ArrowLeftRight, Package,
  ShoppingCart, Wrench, RotateCcw, X, Filter, Search
} from 'lucide-react';
import api from '../services/api';
import Pagination from '../components/common/Pagination';
import toast from 'react-hot-toast';

const REASON_CONFIG = {
  sale:            { label: 'Vente',                icon: ShoppingCart,  color: 'text-red-400',    bg: 'bg-red-900/20 border-red-800/40' },
  sale_cancel:     { label: 'Annulation vente',     icon: RotateCcw,     color: 'text-green-400',  bg: 'bg-green-900/20 border-green-800/40' },
  assembly:        { label: 'Assemblage',            icon: Wrench,        color: 'text-orange-400', bg: 'bg-orange-900/20 border-orange-800/40' },
  disassembly:     { label: 'Désassemblage',        icon: Wrench,        color: 'text-blue-400',   bg: 'bg-blue-900/20 border-blue-800/40' },
  component_sold:  { label: 'Composant vendu',      icon: ShoppingCart,  color: 'text-red-400',    bg: 'bg-red-900/20 border-red-800/40' },
  component_moved: { label: 'Composant déplacé',    icon: ArrowLeftRight, color: 'text-purple-400', bg: 'bg-purple-900/20 border-purple-800/40' },
  manual_in:       { label: 'Entrée manuelle',      icon: TrendingUp,    color: 'text-green-400',  bg: 'bg-green-900/20 border-green-800/40' },
  manual_out:      { label: 'Sortie manuelle',      icon: TrendingDown,  color: 'text-red-400',    bg: 'bg-red-900/20 border-red-800/40' },
  initial:         { label: 'Stock initial',        icon: Package,       color: 'text-slate-400',  bg: 'bg-slate-800/50 border-slate-700/40' },
};

export default function StockMovementsPage() {
  const { t } = useTranslation();
  const [movements, setMovements] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters]     = useState({ reason: '', productSearch: '' });
  const [products, setProducts]   = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showProductSearch, setShowProductSearch] = useState(false);

  const fetchMovements = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (filters.reason)          params.set('reason', filters.reason);
      if (selectedProduct?._id)    params.set('productId', selectedProduct._id);
      const { data } = await api.get(`/products/movements?${params}`);
      setMovements(data.data || []);
      setPagination({ page: data.page, pages: data.pages, total: data.total });
    } catch { toast.error(t('errors.serverError')); }
    finally { setLoading(false); }
  }, [filters, selectedProduct]);

  useEffect(() => { fetchMovements(); }, [fetchMovements]);

  // Product search
  useEffect(() => {
    if (!filters.productSearch.trim()) { setProducts([]); return; }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`/products?search=${encodeURIComponent(filters.productSearch)}&limit=6`);
        setProducts(data.data || []);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.productSearch]);

  const fmt = (n) => new Intl.NumberFormat('fr-MA').format(n);

  return (
    <div className="space-y-4 animate-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Mouvements de Stock</h1>
        <p className="text-slate-500 text-sm">{pagination.total} mouvement{pagination.total !== 1 ? 's' : ''}</p>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          {/* Reason filter */}
          <select value={filters.reason}
            onChange={e => setFilters(f => ({ ...f, reason: e.target.value }))}
            className="input-field flex-1 min-w-[160px]">
            <option value="">Tous les types</option>
            {Object.entries(REASON_CONFIG).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>

          {/* Product search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text"
              value={selectedProduct ? selectedProduct.name : filters.productSearch}
              onChange={e => {
                setSelectedProduct(null);
                setFilters(f => ({ ...f, productSearch: e.target.value }));
                setShowProductSearch(true);
              }}
              onFocus={() => setShowProductSearch(true)}
              placeholder="Filtrer par produit..."
              className="input-field pl-9" />
            {(filters.productSearch || selectedProduct) && (
              <button onClick={() => { setSelectedProduct(null); setFilters(f => ({ ...f, productSearch: '' })); setProducts([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
            {showProductSearch && products.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-slate-800 border border-white/10 rounded-xl shadow-xl z-50 py-1">
                {(products || []).map(p => (
                  <button key={p._id} onClick={() => { setSelectedProduct(p); setShowProductSearch(false); setFilters(f => ({ ...f, productSearch: '' })); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center gap-3">
                    <Package className="w-4 h-4 text-slate-500" />
                    <span className="text-white">{p.name}</span>
                    <span className="text-slate-500 text-xs ms-auto font-mono">{p.sku}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Active filter chips */}
        {(filters.reason || selectedProduct) && (
          <div className="flex gap-2 flex-wrap">
            {filters.reason && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-600/20 border border-primary-500/30 text-primary-400 text-xs">
                {REASON_CONFIG[filters.reason]?.label}
                <button onClick={() => setFilters(f => ({ ...f, reason: '' }))}><X className="w-3 h-3" /></button>
              </span>
            )}
            {selectedProduct && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-600/20 border border-primary-500/30 text-primary-400 text-xs">
                {selectedProduct.name}
                <button onClick={() => setSelectedProduct(null)}><X className="w-3 h-3" /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Movements list */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-600">
            <Package className="w-16 h-16 mb-4" />
            <p>Aucun mouvement trouvé</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Produit</th>
                    <th className="text-center">Avant</th>
                    <th className="text-center">Delta</th>
                    <th className="text-center">Après</th>
                    <th>Lié à</th>
                    <th>Opérateur</th>
                    <th>Date</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {(movements || []).map(m => {
                    const cfg = REASON_CONFIG[m.reason] || REASON_CONFIG.manual_in;
                    const Icon = cfg.icon;
                    return (
                      <tr key={m._id}>
                        <td>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </td>
                        <td>
                          <p className="text-sm font-medium text-white">{m.productName || m.product?.name}</p>
                          <p className="text-xs text-slate-600 font-mono">{m.productSku || m.product?.sku}</p>
                        </td>
                        <td className="text-center text-slate-400 tabular-nums">{fmt(m.quantityBefore)}</td>
                        <td className="text-center">
                          <span className={`font-bold tabular-nums ${m.delta > 0 ? 'text-green-400' : m.delta < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                            {m.delta > 0 ? '+' : ''}{fmt(m.delta)}
                          </span>
                        </td>
                        <td className="text-center font-semibold text-white tabular-nums">{fmt(m.quantityAfter)}</td>
                        <td className="text-sm text-slate-400 max-w-[120px] truncate">
                          {m.relatedProductName || m.relatedProduct?.name || '—'}
                        </td>
                        <td className="text-sm text-slate-400">{m.doneByName || m.doneBy?.username || '—'}</td>
                        <td className="text-xs text-slate-500 whitespace-nowrap">
                          {format(new Date(m.createdAt), 'dd/MM/yy HH:mm')}
                        </td>
                        <td className="text-xs text-slate-500 max-w-[140px] truncate">{m.note || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-white/5">
              {(movements || []).map(m => {
                const cfg = REASON_CONFIG[m.reason] || REASON_CONFIG.manual_in;
                const Icon = cfg.icon;
                return (
                  <div key={m._id} className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-sm truncate">{m.productName || m.product?.name}</p>
                        <p className="text-xs text-slate-600 font-mono">{m.productSku}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                        <Icon className="w-3 h-3" />{cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-slate-500 tabular-nums">{fmt(m.quantityBefore)}</span>
                      <span className="text-slate-600">→</span>
                      <span className={`font-bold tabular-nums ${m.delta > 0 ? 'text-green-400' : m.delta < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                        {m.delta > 0 ? '+' : ''}{fmt(m.delta)}
                      </span>
                      <span className="text-slate-600">→</span>
                      <span className="font-semibold text-white tabular-nums">{fmt(m.quantityAfter)}</span>
                      <span className="text-slate-600 ms-auto text-xs">{format(new Date(m.createdAt), 'dd/MM HH:mm')}</span>
                    </div>
                    {m.note && <p className="text-xs text-slate-600 mt-1 truncate">{m.note}</p>}
                  </div>
                );
              })}
            </div>
          </>
        )}
        <Pagination {...pagination} onPageChange={fetchMovements} />
      </div>
    </div>
  );
}