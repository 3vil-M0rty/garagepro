import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Search, Filter, Edit2, Trash2, QrCode,
  Package, X, Layers, Wrench, ExternalLink,
  MoveRight, ShoppingBag, Printer,
} from 'lucide-react';


import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Pagination from '../components/common/Pagination';
import ProductForm from '../components/inventory/ProductForm';
import UnitsPanel from '../components/inventory/UnitsPanel';
import QRModal from '../components/qr/QRModal';

/* ── Stock bar: shows total / free / assembled ──────────────── */
function StockBar({ product, onAssembledClick }) {
  const total    = product.quantity ?? 0;
  const assembled = product.quantityAssembled ?? 0;
  const free     = Math.max(0, total - assembled);
  const pctFree  = total > 0 ? (free / total) * 100 : 0;
  const pctAss   = total > 0 ? (assembled / total) * 100 : 0;

  const freeColor  = free === 0 ? 'bg-red-500' : free <= product.lowStockThreshold ? 'bg-yellow-400' : 'bg-green-400';

  return (
    <div className="space-y-1.5">
      {/* Numbers row */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">Total</span>
        <span className="font-bold text-white tabular-nums">{total}</span>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="h-2 rounded-full bg-white/5 overflow-hidden flex">
          <div className={`${freeColor} transition-all duration-300`} style={{ width: `${pctFree}%` }} />
          {assembled > 0 && (
            <div className="bg-orange-400 transition-all duration-300" style={{ width: `${pctAss}%` }} />
          )}
        </div>
      )}

      {/* Free / Assembled labels */}
      <div className="flex items-center justify-between text-xs">
        <span className={`font-medium ${free === 0 ? 'text-red-400' : free <= product.lowStockThreshold ? 'text-yellow-400' : 'text-green-400'}`}>
          {free} libre{free !== 1 ? 's' : ''}
        </span>
        {assembled > 0 && (
          <button
            onClick={onAssembledClick}
            className="flex items-center gap-1 text-orange-400 hover:text-orange-300 transition-colors font-medium group"
            title="Voir les produits utilisant ce composant"
          >
            <Wrench className="w-3 h-3" />
            {assembled} assemblé{assembled !== 1 ? 's' : ''}
            <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
      </div>
    </div>
  );
}



/* ── Print unit QR via popup window ─────────────────────────── */
function printUnitQR(parentName, unitNumber, qrCode, qrCodeId) {
  const html = `<div style="width:52mm;padding:3mm;font-family:monospace;font-size:10px;color:#000;text-align:center">
    <div style="border-bottom:1px dashed #ccc;padding-bottom:2mm;margin-bottom:2mm">
      <div style="font-weight:bold;font-size:11px">${parentName}</div>
      <div style="color:#555">Unité #${unitNumber}</div>
    </div>
    ${qrCode ? `<img src="${qrCode}" style="width:36mm;height:36mm" />` : '<div style="width:36mm;height:36mm;border:1px dashed #ccc;margin:auto;display:flex;align-items:center;justify-content:center;font-size:8px;color:#999">Pas de QR</div>'}
    <div style="color:#555;font-size:8px;margin-top:2mm">${qrCodeId || ''}</div>
  </div>`;
  const win = window.open('', '_blank', 'width=300,height=400');
  if (!win) { alert('Autorisez les popups pour imprimer'); return; }
  win.document.write(`<html><head><style>@page{size:58mm auto;margin:0}body{margin:0}</style></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 300);
}

/* ── Unit card inside UsedInModal ────────────────────────────── */
function UnitCard({ unit, allProducts, onAction }) {
  const [showQR, setShowQR]       = useState(false);
  const [showMove, setShowMove]   = useState(false);
  const [targetProduct, setTarget]= useState('');
  const [actLoading, setActLoad]  = useState(false);

  const STATUS_DOT = {
    installed: 'bg-green-400',
    sold:      'bg-slate-500',
    moved:     'bg-blue-400',
    missing:   'bg-red-400',
  };
  const STATUS_LABEL = {
    installed: 'Installé',
    sold:      'Vendu',
    moved:     'Déplacé',
    missing:   'Manquant',
  };

  const handleSell = () => {
    // Navigate to sales — handled by parent via onAction
    onAction('sell', unit);
  };

  const handleMove = async () => {
    if (!targetProduct) { toast.error('Sélectionnez un produit cible'); return; }
    setActLoad(true);
    try {
      await api.post(`/products/${unit._id}/component/move`, {
        componentIdx: unit.componentIdx,
        targetProductId: targetProduct,
      });
      toast.success('Composant déplacé');
      setShowMove(false);
      onAction('reload');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally { setActLoad(false); }
  };

  const statusDot  = STATUS_DOT[unit.unitCompStatus]  || STATUS_DOT.installed;
  const statusLabel= STATUS_LABEL[unit.unitCompStatus] || 'Installé';
  const isSoldOrMoved = unit.unitCompStatus === 'sold' || unit.unitCompStatus === 'moved';

  return (
    <div className="rounded-xl border border-white/5 bg-white/3 hover:border-white/10 transition-colors overflow-hidden">
      {/* Unit header */}
      <div className="flex items-center gap-3 p-4">
        {/* Unit badge */}
        <div className="w-10 h-10 rounded-xl bg-primary-600/20 border border-primary-500/30 flex flex-col items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-primary-400 leading-none">#{unit.unitNumber}</span>
          <span className="text-xs text-primary-500/60 leading-none mt-0.5">{unit.sku?.slice(-4)}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <p className="font-semibold text-white truncate">{unit.name}</p>
              <p className="text-xs text-slate-500 font-mono">Unité #{unit.unitNumber}</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
              style={{ backgroundColor: `${unit.category?.color}20`, color: unit.category?.color }}>
              {unit.category?.name}
            </span>
          </div>
          {/* Component status */}
          <div className="flex items-center gap-2 mt-1.5">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot}`} />
            <span className="text-xs text-slate-400">
              Composant: <span className="font-medium text-white">{unit.componentName}</span>
              <span className="text-slate-600 ms-1.5">· {statusLabel}</span>
            </span>
          </div>
        </div>
      </div>

      {/* QR display */}
      {showQR && (
        <div className="border-t border-white/5 p-4 flex items-start gap-4">
          {unit.unitQrCode ? (
            <>
              <div className="bg-white p-2 rounded-xl flex-shrink-0">
                <img src={unit.unitQrCode} alt="QR" className="w-28 h-28" />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-white font-medium">{unit.name} — Unité #{unit.unitNumber}</p>
                <p className="text-xs text-slate-600 font-mono break-all">{unit.unitQrCodeId}</p>
                <button onClick={() => printUnitQR(unit.name, unit.unitNumber, unit.unitQrCode, unit.unitQrCodeId)}
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5" /> Imprimer
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-slate-600 py-2">
              <QrCode className="w-5 h-5" />
              <p className="text-sm">Aucun QR disponible pour cette unité</p>
            </div>
          )}
        </div>
      )}

      {/* Move picker */}
      {showMove && (
        <div className="border-t border-white/5 p-4 space-y-3">
          <p className="text-xs text-slate-400 font-medium">Déplacer vers quel produit ?</p>
          <select value={targetProduct} onChange={e => setTarget(e.target.value)} className="input-field text-sm">
            <option value="">— Sélectionner —</option>
            {allProducts.filter(p => p._id !== unit._id).map(p => (
              <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button onClick={() => setShowMove(false)} className="btn-secondary flex-1 justify-center text-xs py-1.5">Annuler</button>
            <button onClick={handleMove} disabled={!targetProduct || actLoading}
              className="btn-primary flex-1 justify-center text-xs py-1.5 disabled:opacity-50">
              {actLoading ? '...' : 'Confirmer'}
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="border-t border-white/5 px-4 py-3 flex gap-2 flex-wrap">
        {/* QR button always shown */}
        <button onClick={() => { setShowQR(v => !v); setShowMove(false); }}
          className={`btn-secondary text-xs py-1.5 px-3 ${showQR ? 'border-primary-500/40 text-primary-400' : ''}`}>
          <QrCode className="w-3.5 h-3.5" />
          {showQR ? 'Masquer QR' : 'QR Unité'}
        </button>

        {/* Only show actions for installed components */}
        {!isSoldOrMoved && (
          <>
            {unit.canMove && (
              <button onClick={() => { setShowMove(v => !v); setShowQR(false); }}
                disabled={actLoading}
                className={`btn-secondary text-xs py-1.5 px-3 ${showMove ? 'border-blue-500/40 text-blue-400' : ''}`}>
                <MoveRight className="w-3.5 h-3.5" /> Déplacer
              </button>
            )}
            {unit.canSellSeparately && (
              <button onClick={handleSell} disabled={actLoading}
                className="btn-secondary text-xs py-1.5 px-3 text-green-400 hover:bg-green-500/10 hover:border-green-500/20">
                <ShoppingBag className="w-3.5 h-3.5" /> Vendre séparément
              </button>
            )}
          </>
        )}

        {isSoldOrMoved && (
          <span className="text-xs text-slate-600 italic py-1.5">
            Ce composant a été {unit.unitCompStatus === 'sold' ? 'vendu' : 'déplacé'}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Modal: units using this component ───────────────────────── */
function UsedInModal({ product, onClose, allProducts }) {
  const navigate = useNavigate();
  const [units, setUnits]     = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!product) return;
    setLoading(true);
    api.get(`/products/${product._id}/used-in`)
      .then(({ data }) => setUnits(data.data || []))
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [product]);

  const handleAction = async (type, unit) => {
    if (type === 'reload') { load(); return; }
    if (type === 'sell') {
      // Navigate to sales with the component product pre-filled
      try {
        const { data } = await api.get(`/products/${product._id}`);
        onClose();
        navigate('/sales/new', {
          state: {
            product: data.data,
            fromComponent: {
              parentId:     unit._id,
              parentName:   unit.name,
              componentIdx: unit.componentIdx,
              componentName: unit.componentName,
              unitNumber:   unit.unitNumber,
            },
          },
        });
      } catch { toast.error('Erreur'); }
    }
  };

  const installedCount = (units || []).filter(u => u.unitCompStatus === 'installed').length;

  return (
    <Modal isOpen={!!product} onClose={onClose}
      title={`"${product?.name}" — ${product?.quantityAssembled || 0} assemblé${product?.quantityAssembled !== 1 ? 's' : ''}`}
      size="lg">
      <div className="p-4 sm:p-6 space-y-4">

        {/* Summary */}
        {!loading && units.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-white/3 border border-white/5 text-center">
              <p className="text-xl font-bold text-orange-400">{units.length}</p>
              <p className="text-xs text-slate-500">unité{units.length !== 1 ? 's' : ''} total</p>
            </div>
            <div className="p-3 rounded-xl bg-green-900/20 border border-green-800/30 text-center">
              <p className="text-xl font-bold text-green-400">{installedCount}</p>
              <p className="text-xs text-slate-500">installé{installedCount !== 1 ? 's' : ''}</p>
            </div>
            <div className="p-3 rounded-xl bg-white/3 border border-white/5 text-center">
              <p className="text-xl font-bold text-white">{product?.quantity}</p>
              <p className="text-xs text-slate-500">stock total</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : units.length === 0 ? (
          <div className="text-center py-10 text-slate-600">
            <Wrench className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Ce composant n'est assemblé dans aucune unité actuellement</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(units || []).map((unit, i) => (
              <UnitCard
                key={`${unit._id}-${unit.unitNumber}-${i}`}
                unit={unit}
                allProducts={allProducts}
                onAction={(type) => handleAction(type, unit)}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ── Main page ──────────────────────────────────────────────── */
export default function ProductsPage() {
  const { t } = useTranslation();
  const { isAdmin } = useAuthStore();
  const [products, setProducts]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters]       = useState({ search: '', category: '', availability: '', minPrice: '', maxPrice: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [modal, setModal]           = useState({ type: null, data: null });
  const [usedInProduct, setUsedInProduct] = useState(null);
  const [deleting, setDeleting]     = useState(false);

  const fmt = (n) => new Intl.NumberFormat('fr-MA').format(n);

  const fetchProducts = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 12, ...filters });
      Object.keys(filters).forEach(k => !filters[k] && params.delete(k));
      const { data } = await api.get(`/products?${params}`);
      setProducts(data.data || []);
      setPagination({ page: data.page, pages: data.pages, total: data.total });
    } catch {
      toast.error(t('errors.serverError'));
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data.data || [])).catch(() => {});
  }, []);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/products/${modal.data._id}`);
      toast.success('Produit supprimé');
      setModal({ type: null, data: null });
      fetchProducts(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || t('errors.serverError'));
    } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-5 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white">{t('products.title')}</h1>
          <p className="text-slate-500 text-sm">{pagination.total} produits</p>
        </div>
        {isAdmin() && (
          <button onClick={() => setModal({ type: 'form', data: null })} className="btn-primary flex-shrink-0">
            <Plus className="w-4 h-4" /> {t('products.add')}
          </button>
        )}
      </div>

      {/* Search + Filter bar */}
      <div className="card p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder={t('products.search')} className="input-field pl-9" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary ${showFilters ? 'border-primary-500/50 text-primary-400' : ''}`}>
            <Filter className="w-4 h-4" /> {t('products.filter')}
          </button>
          {Object.values(filters).some(Boolean) && (
            <button onClick={() => setFilters({ search: '', category: '', availability: '', minPrice: '', maxPrice: '' })}
              className="btn-secondary text-red-400">
              <X className="w-4 h-4" /> Reset
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/5">
            <select value={filters.category}
              onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
              className="input-field">
              <option value="">{t('products.allCategories')}</option>
              {(categories || []).map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <select value={filters.availability}
              onChange={e => setFilters(f => ({ ...f, availability: e.target.value }))}
              className="input-field">
              <option value="">{t('products.allAvailability')}</option>
              <option value="in_stock">{t('products.inStock')}</option>
              <option value="low_stock">{t('products.lowStock')}</option>
              <option value="out_of_stock">{t('products.outOfStock')}</option>
            </select>
            <input type="number" value={filters.minPrice}
              onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value }))}
              placeholder={t('products.minPrice')} className="input-field" />
            <input type="number" value={filters.maxPrice}
              onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value }))}
              placeholder={t('products.maxPrice')} className="input-field" />
          </div>
        )}
      </div>

      {/* Products grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="card h-52 animate-pulse bg-slate-800/50" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-slate-600">
          <Package className="w-16 h-16 mb-4" />
          <p className="text-lg">{t('products.noProducts')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {(products || []).map(product => (
            <div key={product._id}
              className="card group hover:border-white/10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl flex flex-col">
              {/* Color bar */}
              <div className="h-1 rounded-t-xl -mt-5 -mx-5 mb-4"
                style={{ backgroundColor: product.category?.color || '#6366f1' }} />

              {/* Product image */}
              {product.imageUrl && (
                <div className="mb-3 -mt-1 rounded-lg overflow-hidden bg-white/5 border border-white/5 h-32 flex items-center justify-center">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-full w-full object-cover"
                    onError={e => { e.target.parentElement.style.display = 'none'; }}
                  />
                </div>
              )}

              {/* Name + category */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">{product.name}</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{product.sku}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                  style={{ backgroundColor: `${product.category?.color}20`, color: product.category?.color }}>
                  {product.category?.name}
                </span>
              </div>

              {/* Price */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xl font-bold text-white">{fmt(product.price)}</span>
                <span className="text-xs text-slate-500">{t('common.currency')}</span>
              </div>

              {/* Stock breakdown */}
              <StockBar
                product={product}
                onAssembledClick={() => setUsedInProduct(product)}
              />

              {/* Components preview */}
              {product.components?.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-slate-600 font-medium flex items-center gap-1">
                    <Layers className="w-3 h-3" /> {t('products.components')}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {product.components.slice(0, 3).map((c, i) => (
                      <span key={i}
                        className={`text-xs px-1.5 py-0.5 rounded border
                          ${c.linkedProduct
                            ? 'bg-primary-600/10 border-primary-500/20 text-primary-400'
                            : 'bg-white/5 border-white/5 text-slate-500'}`}>
                        {c.name}
                        {c.quantity > 1 && <span className="ms-0.5 opacity-60">×{c.quantity}</span>}
                      </span>
                    ))}
                    {product.components.length > 3 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-slate-500">
                        +{product.components.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-auto pt-4 flex-wrap">
                <button onClick={() => setModal({ type: 'units', data: product })}
                  className="flex-1 btn-secondary justify-center py-1.5 text-xs min-w-0">
                  <Package className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('units.title')}</span>
                </button>
                <button onClick={() => setModal({ type: 'qr', data: product })}
                  className="btn-secondary justify-center py-1.5 px-2 text-xs">
                  <QrCode className="w-3.5 h-3.5" />
                </button>

                {isAdmin() && (
                  <>
                    <button onClick={() => setModal({ type: 'form', data: product })}
                      className="btn-secondary justify-center py-1.5 px-2 text-xs">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setModal({ type: 'delete', data: product })}
                      className="btn-secondary py-1.5 px-2 text-red-400 hover:bg-red-500/10 hover:border-red-500/20">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination {...pagination} onPageChange={fetchProducts} />

      {/* Product form modal */}
      <Modal isOpen={modal.type === 'form'} onClose={() => setModal({ type: null, data: null })}
        title={modal.data ? t('products.edit') : t('products.add')} size="lg">
        <ProductForm
          product={modal.data}
          categories={categories}
          onSuccess={() => { setModal({ type: null, data: null }); fetchProducts(); }}
          onCancel={() => setModal({ type: null, data: null })} />
      </Modal>

      {/* Units modal */}
      <Modal isOpen={modal.type === 'units'} onClose={() => setModal({ type: null, data: null })}
        title={`${t('units.manageUnits')} — ${modal.data?.name || ''}`} size="xl">
        {modal.data && <UnitsPanel product={modal.data} />}
      </Modal>

      {/* QR modal */}
      <Modal isOpen={modal.type === 'qr'} onClose={() => setModal({ type: null, data: null })}
        title={`QR Code — ${modal.data?.name}`} size="sm">
        <QRModal product={modal.data} />
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog isOpen={modal.type === 'delete'}
        onClose={() => setModal({ type: null, data: null })}
        onConfirm={handleDelete}
        message={`${t('products.confirmDelete')} "${modal.data?.name}" ?`}
        loading={deleting} />

      {/* Used-in modal */}
      <UsedInModal
        product={usedInProduct}
        onClose={() => setUsedInProduct(null)}
        allProducts={products} />
    </div>
  );
}