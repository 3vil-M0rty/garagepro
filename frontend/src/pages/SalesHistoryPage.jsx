import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactToPrint } from 'react-to-print';
import { History, Printer, Eye, X, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../services/api';
import Pagination from '../components/common/Pagination';
import Modal from '../components/common/Modal';
import Receipt from '../components/sales/Receipt';
import { useAuthStore } from '../store/authStore';

const pmLabel = (pm) => ({ cash: 'Espèces', card: 'Carte', transfer: 'Virement', other: 'Autre' }[pm] || pm);
const pmBadge = (pm) => ({ cash: 'badge-green', card: 'badge-blue', transfer: 'badge-purple', other: 'badge-yellow' }[pm] || 'badge-blue');

// Mobile card for a single sale row
function SaleCard({ sale, isAdmin, fmt, onView, onPrint }) {
  return (
    <div className="p-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <span className="font-mono text-xs bg-white/5 px-2 py-0.5 rounded text-primary-400">
            {sale.receiptNumber}
          </span>
          <p className="text-xs text-slate-500 mt-1">
            {format(new Date(sale.createdAt), 'dd/MM/yyyy HH:mm')}
            {isAdmin && sale.seller && ` · ${sale.seller.username || sale.sellerName}`}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {sale.items?.length} article{sale.items?.length !== 1 ? 's' : ''}
            {sale.items?.[0] && ` · ${sale.items[0].productName}${sale.items.length > 1 ? '…' : ''}`}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-green-400 tabular-nums">{fmt(sale.total)}</p>
          <p className="text-xs text-slate-500">MAD</p>
          <span className={`badge text-xs mt-1 ${pmBadge(sale.paymentMethod)}`}>{pmLabel(sale.paymentMethod)}</span>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={() => onView(sale)}
          className="flex-1 btn-secondary py-1.5 text-xs justify-center">
          <Eye className="w-3.5 h-3.5" /> Détails
        </button>
        <button onClick={() => onPrint(sale)}
          className="flex-1 btn-secondary py-1.5 text-xs justify-center text-primary-400">
          <Printer className="w-3.5 h-3.5" /> Imprimer
        </button>
      </div>
    </div>
  );
}

export default function SalesHistoryPage() {
  const { t } = useTranslation();
  const { isAdmin } = useAuthStore();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ startDate: '', endDate: '' });
  const [selectedSale, setSelectedSale] = useState(null);
  const [printSale, setPrintSale] = useState(null);
  const receiptRef = useRef(null);

  const fetchSales = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 15, ...filters });
      Object.keys(filters).forEach(k => !filters[k] && params.delete(k));
      const { data } = await api.get(`/sales?${params}`);
      setSales(data.data);
      setPagination({ page: data.page, pages: data.pages, total: data.total });
    } catch { toast.error(t('errors.serverError')); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const handlePrint = useReactToPrint({
    content: () => receiptRef.current,
    documentTitle: printSale?.receiptNumber || 'Receipt',
    pageStyle: `@page { size: 58mm auto; margin: 0; }`,
  });

  const triggerPrint = (sale) => {
    setPrintSale(sale);
    setTimeout(handlePrint, 100);
  };

  const fmt = (n) => new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 2 }).format(n);

  return (
    <div className="space-y-4 animate-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white">{t('sales.history')}</h1>
          <p className="text-slate-500 text-sm">{pagination.total} ventes</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-slate-500 mb-1">{t('sales.startDate')}</label>
            <input type="date" value={filters.startDate}
              onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
              className="input-field" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-slate-500 mb-1">{t('sales.endDate')}</label>
            <input type="date" value={filters.endDate}
              onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
              className="input-field" />
          </div>
          {(filters.startDate || filters.endDate) && (
            <button onClick={() => setFilters({ startDate: '', endDate: '' })}
              className="btn-secondary text-red-400 py-2.5 flex-shrink-0">
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-600">
            <History className="w-16 h-16 mb-4" />
            <p>{t('sales.noSales')}</p>
          </div>
        ) : (
          <>
            {/* Desktop table — hidden on mobile */}
            <div className="hidden md:block table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('sales.receiptNumber')}</th>
                    <th>{t('sales.date')}</th>
                    {isAdmin() && <th>{t('sales.seller')}</th>}
                    <th>Articles</th>
                    <th>{t('sales.paymentMethod')}</th>
                    <th className="text-right">{t('sales.total')}</th>
                    <th className="text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(sale => (
                    <tr key={sale._id}>
                      <td>
                        <span className="font-mono text-xs bg-white/5 px-2 py-1 rounded text-primary-400">
                          {sale.receiptNumber}
                        </span>
                      </td>
                      <td className="text-slate-400 text-sm whitespace-nowrap">
                        {format(new Date(sale.createdAt), 'dd/MM/yyyy HH:mm')}
                      </td>
                      {isAdmin() && (
                        <td className="text-sm text-slate-300">
                          {sale.seller?.username || sale.sellerName}
                        </td>
                      )}
                      <td>
                        <div className="text-sm text-slate-400">
                          {sale.items?.length} art.
                          {sale.items?.[0] && (
                            <span className="text-slate-600 ms-1 text-xs hidden lg:inline">
                              ({sale.items[0].productName}{sale.items.length > 1 ? '…' : ''})
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`badge text-xs ${pmBadge(sale.paymentMethod)}`}>
                          {pmLabel(sale.paymentMethod)}
                        </span>
                      </td>
                      <td className="text-right font-bold text-green-400 tabular-nums whitespace-nowrap">
                        {fmt(sale.total)} MAD
                      </td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => setSelectedSale(sale)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => triggerPrint(sale)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-primary-600/20 text-slate-400 hover:text-primary-400 transition-colors">
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards — shown only on mobile */}
            <div className="md:hidden divide-y divide-white/5">
              {sales.map(sale => (
                <SaleCard
                  key={sale._id}
                  sale={sale}
                  isAdmin={isAdmin()}
                  fmt={fmt}
                  onView={setSelectedSale}
                  onPrint={triggerPrint}
                />
              ))}
            </div>
          </>
        )}
        <Pagination {...pagination} onPageChange={fetchSales} />
      </div>

      {/* Sale detail modal */}
      <Modal isOpen={!!selectedSale} onClose={() => setSelectedSale(null)}
        title={`Vente ${selectedSale?.receiptNumber}`} size="md">
        {selectedSale && (
          <div className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/3 border border-white/5">
                <p className="text-xs text-slate-500">{t('sales.date')}</p>
                <p className="text-sm font-medium text-white mt-1">
                  {format(new Date(selectedSale.createdAt), 'dd/MM/yyyy HH:mm')}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/3 border border-white/5">
                <p className="text-xs text-slate-500">{t('sales.seller')}</p>
                <p className="text-sm font-medium text-white mt-1">
                  {selectedSale.seller?.username || selectedSale.sellerName}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-2">{t('products.title')}</p>
              <div className="space-y-2">
                {selectedSale.items?.map((item, i) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-white/3 border border-white/5 gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{item.productName}</p>
                      <p className="text-xs text-slate-500">{item.quantity} × {fmt(item.unitPrice)} MAD</p>
                    </div>
                    <span className="text-sm font-bold text-white flex-shrink-0 tabular-nums">
                      {fmt(item.totalPrice)} MAD
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-white/5 pt-3 space-y-1.5">
              <div className="flex justify-between text-sm text-slate-400">
                <span>{t('sales.subtotal')}</span>
                <span className="tabular-nums">{fmt(selectedSale.subtotal)} MAD</span>
              </div>
              {selectedSale.discount > 0 && (
                <div className="flex justify-between text-sm text-green-400">
                  <span>− {t('sales.discount')}</span>
                  <span className="tabular-nums">−{fmt(selectedSale.discount)} MAD</span>
                </div>
              )}
              {selectedSale.tax > 0 && (
                <div className="flex justify-between text-sm text-slate-400">
                  <span>+ TVA</span>
                  <span className="tabular-nums">+{fmt(selectedSale.tax)} MAD</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-white text-lg border-t border-white/5 pt-2">
                <span>{t('sales.grandTotal')}</span>
                <span className="text-green-400 tabular-nums">{fmt(selectedSale.total)} MAD</span>
              </div>
            </div>

            <button onClick={() => triggerPrint(selectedSale)} className="btn-primary w-full justify-center py-3">
              <Printer className="w-4 h-4" /> {t('sales.printReceipt')}
            </button>
          </div>
        )}
      </Modal>

      {/* Hidden receipt for printing */}
      <div className="hidden">
        <Receipt ref={receiptRef} sale={printSale || selectedSale} />
      </div>
    </div>
  );
}
