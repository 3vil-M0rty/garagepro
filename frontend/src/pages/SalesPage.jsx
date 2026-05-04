import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import {
  ShoppingCart, Plus, Minus, Trash2, QrCode, Search,
  Printer, CheckCircle, Package, X, Receipt as ReceiptIcon,
  Percent,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import QRScanner from '../components/qr/QRScanner';
import Receipt from '../components/sales/Receipt';
import Modal from '../components/common/Modal';

const DEFAULT_TVA_RATE = 20; // %

export default function SalesPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const receiptRef = useRef(null);

  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [showQR, setShowQR] = useState(false);

  // TVA: rate (%) is stored, computed amount applied to subtotal
  const [form, setForm] = useState({
    discount: '',
    tvaRate: DEFAULT_TVA_RATE,   // editable percentage
    tvaEnabled: true,             // toggle TVA on/off
    paymentMethod: 'cash',
    notes: '',
  });

  const fmt = (n) => new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 2 }).format(n);

  useEffect(() => {
    if (location.state?.product) addToCart(location.state.product);
  }, []);

  const searchProducts = useCallback(async () => {
    if (!search.trim()) { setProducts([]); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/products?search=${encodeURIComponent(search)}&availability=in_stock&limit=8`);
      setProducts(data.data);
    } catch { toast.error(t('errors.serverError')); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(searchProducts, 350);
    return () => clearTimeout(timer);
  }, [searchProducts]);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product._id === product._id);
      if (existing) {
        if (existing.quantity >= product.quantity) {
          toast.error(t('errors.insufficientStock')); return prev;
        }
        return prev.map(i =>
          i.product._id === product._id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      if (product.quantity === 0) { toast.error(t('products.outOfStock')); return prev; }
      return [...prev, { product, quantity: 1 }];
    });
    setSearch(''); setProducts([]);
  };

  const updateQty = (productId, delta) => {
    setCart(prev => prev.map(i => {
      if (i.product._id !== productId) return i;
      const newQty = i.quantity + delta;
      if (newQty <= 0) return null;
      if (newQty > i.product.quantity) { toast.error(t('errors.insufficientStock')); return i; }
      return { ...i, quantity: newQty };
    }).filter(Boolean));
  };

  const removeFromCart = (productId) =>
    setCart(prev => prev.filter(i => i.product._id !== productId));

  const handleQRResult = async (qrCodeId) => {
    setShowQR(false);
    try {
      const { data } = await api.get(`/products/qr/${qrCodeId}`);
      addToCart(data.data);
      toast.success(`${data.data.name} ajouté`);
    } catch { toast.error(t('qr.notFound')); }
  };

  // Calculations
  const subtotal  = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const discount  = Number(form.discount) || 0;
  const tvaRate   = Number(form.tvaRate) || 0;
  const tvaAmount = form.tvaEnabled ? (subtotal - discount) * tvaRate / 100 : 0;
  const total     = subtotal - discount + tvaAmount;

  const handleSubmit = async () => {
    if (cart.length === 0) { toast.error('Panier vide'); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post('/sales', {
        items: cart.map(i => ({ product: i.product._id, quantity: i.quantity })),
        discount,
        tax: tvaAmount,
        paymentMethod: form.paymentMethod,
        notes: form.notes,
      });
      setCompletedSale(data.data);
      setCart([]);
      setForm({ discount: '', tvaRate: DEFAULT_TVA_RATE, tvaEnabled: true, paymentMethod: 'cash', notes: '' });
      toast.success(t('sales.saleSuccess'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('errors.serverError'));
    } finally { setSubmitting(false); }
  };

  const handlePrint = useReactToPrint({
    content: () => receiptRef.current,
    documentTitle: completedSale?.receiptNumber || 'Receipt',
    pageStyle: `@page { size: 58mm auto; margin: 0; }`,
  });

  // ── Success screen ──────────────────────────────────────────────────────
  if (completedSale) {
    return (
      <div className="max-w-sm mx-auto space-y-4 animate-in px-2">
        <div className="card text-center py-10">
          <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">{t('sales.saleSuccess')}</h2>
          <p className="text-slate-500 text-sm font-mono">{completedSale.receiptNumber}</p>
          <p className="text-3xl font-bold text-green-400 mt-4">{fmt(completedSale.total)}</p>
          <p className="text-slate-500 text-sm">MAD</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={handlePrint} className="btn-primary justify-center py-3">
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">{t('sales.printReceipt')}</span>
            <span className="sm:hidden">Imprimer</span>
          </button>
          <button onClick={() => setCompletedSale(null)} className="btn-secondary justify-center py-3">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nouvelle vente</span>
            <span className="sm:hidden">Nouveau</span>
          </button>
        </div>
        <div className="hidden"><Receipt ref={receiptRef} sale={completedSale} /></div>
      </div>
    );
  }

  // ── Main layout ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-in">
      <h1 className="text-xl sm:text-2xl font-display font-bold text-white">{t('sales.newSale')}</h1>

      <div className="flex flex-col xl:flex-row gap-4">

        {/* ── LEFT: Search + Cart ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Search bar */}
          <div className="card p-4">
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('sales.searchProduct')}
                  className="input-field pl-9 pr-8"
                />
                {search && (
                  <button onClick={() => { setSearch(''); setProducts([]); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button onClick={() => setShowQR(true)}
                className="btn-secondary px-3 flex-shrink-0" title="Scanner QR">
                <QrCode className="w-5 h-5" />
              </button>
            </div>

            {/* Search results */}
            {loading && (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {products.length > 0 && (
              <div className="space-y-1.5 mt-3">
                {products.map(p => (
                  <button key={p._id} onClick={() => addToCart(p)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5
                               hover:border-primary-500/30 hover:bg-primary-500/5 transition-all text-left group">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${p.category?.color}20`, color: p.category?.color }}>
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{p.name}</p>
                      <p className="text-xs text-slate-500 truncate">{p.category?.name} · Stock: {p.quantity}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-white">{fmt(p.price)}</p>
                      <p className="text-xs text-slate-500">MAD</p>
                    </div>
                    <Plus className="w-4 h-4 text-primary-400 opacity-0 group-hover:opacity-100 flex-shrink-0 hidden sm:block" />
                  </button>
                ))}
              </div>
            )}
            {search && !loading && products.length === 0 && (
              <p className="text-center text-slate-600 py-4 text-sm">{t('products.noProducts')}</p>
            )}
          </div>

          {/* Cart */}
          {cart.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2 text-sm sm:text-base">
                <ShoppingCart className="w-4 h-4 text-primary-400 flex-shrink-0" />
                Panier
                <span className="badge badge-purple text-xs">{cart.length}</span>
              </h3>
              <div className="space-y-2">
                {cart.map(({ product, quantity }) => (
                  <div key={product._id}
                    className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl bg-white/3 border border-white/5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{product.name}</p>
                      <p className="text-xs text-slate-500">
                        {fmt(product.price)} × {quantity} =&nbsp;
                        <span className="text-white font-medium">{fmt(product.price * quantity)}</span> MAD
                      </p>
                    </div>
                    {/* Qty controls */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => updateQty(product._id, -1)}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-bold text-white tabular-nums">{quantity}</span>
                      <button onClick={() => updateQty(product._id, 1)}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button onClick={() => removeFromCart(product._id)}
                      className="text-red-400 hover:text-red-300 p-1 flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Order Summary ── */}
        <div className="w-full xl:w-80 flex-shrink-0 space-y-4">
          <div className="card p-4 space-y-4">
            <h3 className="font-semibold text-white flex items-center gap-2 text-sm sm:text-base">
              <ReceiptIcon className="w-4 h-4 text-primary-400" />
              Récapitulatif
            </h3>

            {/* Discount */}
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">
                {t('sales.discount')} (MAD)
              </label>
              <input
                type="number"
                value={form.discount}
                min="0"
                placeholder="0.00"
                onChange={e => setForm(f => ({ ...f, discount: e.target.value }))}
                className="input-field"
              />
            </div>

            {/* TVA */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-500 flex items-center gap-1">
                  <Percent className="w-3 h-3" /> TVA
                </label>
                {/* Toggle TVA on/off */}
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, tvaEnabled: !f.tvaEnabled }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0
                    ${form.tvaEnabled ? 'bg-primary-600' : 'bg-slate-700'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform
                    ${form.tvaEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
              </div>
              {form.tvaEnabled && (
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={form.tvaRate}
                      min="0"
                      max="100"
                      step="0.5"
                      onChange={e => setForm(f => ({ ...f, tvaRate: e.target.value }))}
                      className="input-field pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
                  </div>
                  {/* Quick preset buttons */}
                  {[7, 10, 14, 20].map(rate => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, tvaRate: rate }))}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors flex-shrink-0
                        ${Number(form.tvaRate) === rate
                          ? 'bg-primary-600/20 border-primary-500/40 text-primary-400'
                          : 'bg-white/3 border-white/10 text-slate-500 hover:border-white/20 hover:text-white'}`}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
              )}
              {form.tvaEnabled && tvaAmount > 0 && (
                <p className="text-xs text-slate-600 mt-1">
                  = {fmt(tvaAmount)} MAD ({form.tvaRate}% sur {fmt(subtotal - discount)} MAD)
                </p>
              )}
            </div>

            {/* Payment method */}
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">{t('sales.paymentMethod')}</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { value: 'cash', label: '💵 Espèces' },
                  { value: 'card', label: '💳 Carte' },
                  { value: 'transfer', label: '🏦 Virement' },
                  { value: 'other', label: '• Autre' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, paymentMethod: value }))}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all
                      ${form.paymentMethod === value
                        ? 'bg-primary-600/20 border-primary-500/40 text-primary-400'
                        : 'bg-white/3 border-white/5 text-slate-400 hover:border-white/15'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">{t('sales.notes')}</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="input-field resize-none text-sm"
                rows={2}
                placeholder="Note optionnelle..."
              />
            </div>

            {/* Totals breakdown */}
            <div className="border-t border-white/5 pt-3 space-y-1.5">
              <div className="flex justify-between text-sm text-slate-400">
                <span>{t('sales.subtotal')}</span>
                <span className="tabular-nums">{fmt(subtotal)} MAD</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-400">
                  <span>− {t('sales.discount')}</span>
                  <span className="tabular-nums">−{fmt(discount)} MAD</span>
                </div>
              )}
              {form.tvaEnabled && tvaAmount > 0 && (
                <div className="flex justify-between text-sm text-slate-400">
                  <span>+ TVA {form.tvaRate}%</span>
                  <span className="tabular-nums">+{fmt(tvaAmount)} MAD</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-white text-base sm:text-lg border-t border-white/5 pt-2">
                <span>{t('sales.grandTotal')}</span>
                <span className="text-primary-400 tabular-nums">{fmt(total)} MAD</span>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || cart.length === 0}
              className="btn-primary w-full justify-center py-3 text-sm sm:text-base disabled:opacity-40 mt-1">
              <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
              {submitting ? t('common.loading') : t('sales.confirmSale')}
            </button>
          </div>
        </div>
      </div>

      {/* QR Scanner Modal */}
      <Modal isOpen={showQR} onClose={() => setShowQR(false)} title={t('qr.scan')} size="sm">
        <div className="p-4 sm:p-6">
          <QRScanner onResult={handleQRResult} />
        </div>
      </Modal>
    </div>
  );
}
