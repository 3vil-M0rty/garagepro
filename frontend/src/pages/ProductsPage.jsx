import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Filter, Edit2, Trash2, QrCode, Package, X, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Pagination from '../components/common/Pagination';
import ProductForm from '../components/inventory/ProductForm';
import QRModal from '../components/qr/QRModal';

const StockBadge = ({ status, qty, t }) => {
  const config = {
    in_stock: { class: 'badge-green', label: t('products.inStock') },
    low_stock: { class: 'badge-yellow', label: t('products.lowStock') },
    out_of_stock: { class: 'badge-red', label: t('products.outOfStock') },
  };
  const c = config[status] || config.in_stock;
  return <span className={`badge ${c.class}`}>{qty} · {c.label}</span>;
};

export default function ProductsPage() {
  const { t } = useTranslation();
  const { isAdmin } = useAuthStore();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', category: '', availability: '', minPrice: '', maxPrice: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [modal, setModal] = useState({ type: null, data: null });
  const [deleting, setDeleting] = useState(false);

  const fetchProducts = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 12, ...filters });
      Object.keys(filters).forEach(k => !filters[k] && params.delete(k));
      const { data } = await api.get(`/products?${params}`);
      setProducts(data.data);
      setPagination({ page: data.page, pages: data.pages, total: data.total });
    } catch {
      toast.error(t('errors.serverError'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data.data)).catch(() => {});
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
    } finally {
      setDeleting(false);
    }
  };

  const fmt = (n) => new Intl.NumberFormat('fr-MA').format(n);

  return (
    <div className="space-y-5 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white">{t('products.title')</h1>
          <p className="text-slate-500 text-sm">{pagination.total} produits</p>
        </div>
        {isAdmin() && (
          <button onClick={() => setModal({ type: 'form', data: null })} className="btn-primary">
            <Plus className="w-4 h-4" /> {t('products.add')}
          </button>
        )}
      </div>

      {/* Search + Filter bar */}
      <div className="card p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder={t('products.search')}
              className="input-field pl-9"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary ${showFilters ? 'border-primary-500/50 text-primary-400' : ''}`}
          >
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
            <select
              value={filters.category}
              onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
              className="input-field"
            >
              <option value="">{t('products.allCategories')}</option>
              {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <select
              value={filters.availability}
              onChange={e => setFilters(f => ({ ...f, availability: e.target.value }))}
              className="input-field"
            >
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
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card h-48 animate-pulse bg-slate-800/50" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-slate-600">
          <Package className="w-16 h-16 mb-4" />
          <p className="text-lg">{t('products.noProducts')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map(product => (
            <div key={product._id}
              className="card group hover:border-white/10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl flex flex-col">
              {/* Category color bar */}
              <div className="h-1 rounded-t-xl -mt-5 -mx-5 mb-4"
                style={{ backgroundColor: product.category?.color || '#6366f1' }} />

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

              <div className="flex items-center justify-between mb-3">
                <span className="text-xl font-bold text-white">{fmt(product.price)}</span>
                <span className="text-xs text-slate-500">{t('common.currency')}</span>
              </div>

              <StockBadge status={product.stockStatus} qty={product.quantity} t={t} />

              {product.components?.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-slate-600 font-medium">{t('products.components')}</p>
                  <div className="flex flex-wrap gap-1">
                    {product.components.slice(0, 3).map((c, i) => (
                      <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-slate-400">{c.name}</span>
                    ))}
                    {product.components.length > 3 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-slate-500">
                        +{product.components.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-auto pt-4">
                <button onClick={() => setModal({ type: 'qr', data: product })}
                  className="flex-1 btn-secondary justify-center py-1.5 text-xs">
                  <QrCode className="w-3.5 h-3.5" /> QR
                </button>
                {isAdmin() && (
                  <>
                    <button onClick={() => setModal({ type: 'form', data: product })}
                      className="flex-1 btn-secondary justify-center py-1.5 text-xs">
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

      {/* Modals */}
      <Modal
        isOpen={modal.type === 'form'}
        onClose={() => setModal({ type: null, data: null })}
        title={modal.data ? t('products.edit') : t('products.add')}
        size="lg"
      >
        <ProductForm
          product={modal.data}
          categories={categories}
          onSuccess={() => { setModal({ type: null, data: null }); fetchProducts(); }}
          onCancel={() => setModal({ type: null, data: null })}
        />
      </Modal>

      <Modal
        isOpen={modal.type === 'qr'}
        onClose={() => setModal({ type: null, data: null })}
        title={`QR Code — ${modal.data?.name}`}
        size="sm"
      >
        <QRModal product={modal.data} />
      </Modal>

      <ConfirmDialog
        isOpen={modal.type === 'delete'}
        onClose={() => setModal({ type: null, data: null })}
        onConfirm={handleDelete}
        message={`${t('products.confirmDelete')} "${modal.data?.name}" ?`}
        loading={deleting}
      />
    </div>
  );
}
