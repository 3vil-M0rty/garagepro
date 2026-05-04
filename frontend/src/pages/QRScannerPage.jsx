import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QrCode, Package, ShoppingCart, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import QRScanner from '../components/qr/QRScanner';

export default function QRScannerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleScan = async (qrCodeId) => {
    setLoading(true);
    setError(null);
    setProduct(null);
    try {
      const { data } = await api.get(`/products/qr/${qrCodeId}`);
      setProduct(data.data);
      toast.success(t('qr.found'));
    } catch {
      setError(t('qr.notFound'));
      toast.error(t('qr.notFound'));
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n) => new Intl.NumberFormat('fr-MA').format(n);

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white">{t('qr.scan')</h1>
        <p className="text-slate-500 text-sm mt-1">{t('qr.scanInstructions')}</p>
      </div>

      <div className="card">
        <QRScanner onResult={handleScan} />
      </div>

      {loading && (
        <div className="card flex items-center justify-center py-10">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && !loading && (
        <div className="card flex items-center gap-3 text-red-400 border-red-800/30 bg-red-900/10">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {product && !loading && (
        <div className="card animate-in">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${product.category?.color}20`, color: product.category?.color }}>
              <Package className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white">{product.name}</h2>
              <p className="text-slate-500 text-sm font-mono">{product.sku}</p>
              <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block"
                style={{ backgroundColor: `${product.category?.color}20`, color: product.category?.color }}>
                {product.category?.name}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-white/3 border border-white/5">
              <p className="text-xs text-slate-500">{t('products.price')}</p>
              <p className="text-xl font-bold text-white mt-1">{fmt(product.price)} <span className="text-sm text-slate-500">MAD</span></p>
            </div>
            <div className="p-3 rounded-xl bg-white/3 border border-white/5">
              <p className="text-xs text-slate-500">{t('products.stock')}</p>
              <p className={`text-xl font-bold mt-1 ${product.quantity === 0 ? 'text-red-400' : product.quantity <= product.lowStockThreshold ? 'text-yellow-400' : 'text-green-400'}`}>
                {product.quantity}
              </p>
            </div>
          </div>

          {product.components?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-slate-500 mb-2">{t('products.components')}</p>
              <div className="flex flex-wrap gap-1.5">
                {product.components.map((c, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/5 text-slate-400">
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => navigate('/sales/new', { state: { product } })}
            disabled={product.quantity === 0}
            className="btn-primary w-full justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShoppingCart className="w-4 h-4" />
            {product.quantity === 0 ? t('products.outOfStock') : t('common.sell')}
          </button>
        </div>
      )}
    </div>
  );
}
