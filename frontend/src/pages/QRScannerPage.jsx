import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactToPrint } from 'react-to-print';
import {
  QrCode, Package, ShoppingCart, AlertCircle,
  Printer, Settings, ChevronDown, Layers, Wrench,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import QRScanner from '../components/qr/QRScanner';
import Modal from '../components/common/Modal';

const PAPER_SIZES = [
  { label: '58mm (Ticket)', width: 58 },
  { label: '80mm (Standard)', width: 80 },
  { label: '104mm (Large)', width: 104 },
  { label: 'Personnalisé', width: null },
];

const STATUS_CFG = {
  installed: { label: 'Installé',  cls: 'text-green-400 bg-green-900/20 border-green-800/40' },
  sold:      { label: 'Vendu',     cls: 'text-slate-400 bg-slate-800/50 border-slate-700/40' },
  moved:     { label: 'Déplacé',  cls: 'text-blue-400  bg-blue-900/20  border-blue-800/40' },
  missing:   { label: 'Manquant', cls: 'text-red-400   bg-red-900/20   border-red-800/40' },
};

export default function QRScannerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const printRef = useRef(null);

  // Can be null | { type: 'product', data } | { type: 'unit', data, unit }
  const [result, setResult]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [showDimModal, setShowDimModal] = useState(false);
  const [selectedSize, setSelectedSize] = useState(PAPER_SIZES[0]);
  const [customWidth, setCustomWidth]  = useState(72);

  const paperWidth = selectedSize.width ?? customWidth;
  const product    = result?.data || null;
  const unit       = result?.unit || null;

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: unit
      ? `Unit-${product?.sku}-${unit.unitNumber}`
      : `Product-${product?.sku}`,
    pageStyle: `@page { size: ${paperWidth}mm auto; margin: 0; }`,
  });

  const handleScan = async (raw) => {
    setLoading(true); setError(null); setResult(null);
    try {
      // Parse the QR payload
      let parsed = {};
      try { parsed = JSON.parse(raw); } catch { parsed = { qrCodeId: raw }; }

      // Detect unit QR vs product QR
      // Unit QR has: { productId, unitNumber, qrCodeId }
      // Product QR has: { id, qrCodeId, sku }
      const isUnitQR = parsed.productId && parsed.unitNumber != null;

      if (isUnitQR) {
        // Look up by unit QR code ID
        const { data } = await api.get(`/products/unit-qr/${parsed.qrCodeId}`);
        setResult(data); // { type: 'unit', data: product, unit: { ... } }
        toast.success(`Unité #${data.unit.unitNumber} — ${data.data.name}`);
      } else {
        // Fall back to product-level lookup
        const qrCodeId = parsed.qrCodeId || parsed.id || raw;
        const { data } = await api.get(`/products/qr/${qrCodeId}`);
        setResult({ type: 'product', data: data.data });
        toast.success(t('qr.found'));
      }
    } catch {
      setError(t('qr.notFound'));
      toast.error(t('qr.notFound'));
    } finally { setLoading(false); }
  };

  const fmt = (n) => new Intl.NumberFormat('fr-MA').format(n);

  const stockColor = product
    ? product.quantity === 0 ? 'text-red-400'
      : product.quantity <= product.lowStockThreshold ? 'text-yellow-400'
      : 'text-green-400'
    : '';

  return (
    <div className="max-w-lg mx-auto space-y-4 animate-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white">{t('qr.scan')}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{t('qr.scanInstructions')}</p>
        </div>
        <button onClick={() => setShowDimModal(true)}
          className="btn-secondary px-3 py-2 flex-shrink-0" title="Paramètres d'impression">
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline text-xs ms-1">{paperWidth}mm</span>
        </button>
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
        <div className="card flex items-center gap-3 text-red-400 border border-red-800/30 bg-red-900/10">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* ── UNIT result ── */}
      {result?.type === 'unit' && product && unit && !loading && (
        <div className="card animate-in space-y-4">
          {/* Unit badge */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-primary-600/10 border border-primary-500/20">
            <div className="w-10 h-10 rounded-xl bg-primary-600/30 border border-primary-500/40 flex flex-col items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary-300 leading-none">#{unit.unitNumber}</span>
              <span className="text-xs text-primary-500 leading-none mt-0.5">unité</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-white">{product.name}</h2>
              <p className="text-xs text-primary-400 font-mono mt-0.5">
                {product.sku} — Unité #{unit.unitNumber}
              </p>
              <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block"
                style={{ backgroundColor: `${product.category?.color}20`, color: product.category?.color }}>
                {product.category?.name}
              </span>
            </div>
          </div>

          {/* Unit components */}
          {unit.components?.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Composants de cette unité
              </p>
              <div className="space-y-1.5">
                {unit.components.map((comp, i) => {
                  const cfg = STATUS_CFG[comp.status] || STATUS_CFG.installed;
                  return (
                    <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${cfg.cls}`}>
                      <div className="w-2 h-2 rounded-full bg-current flex-shrink-0" />
                      <span className="flex-1">{comp.name}</span>
                      {comp.quantity > 1 && <span className="opacity-60">×{comp.quantity}</span>}
                      <span className="opacity-75 ms-auto">{cfg.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Product stock info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-white/3 border border-white/5">
              <p className="text-xs text-slate-500">Prix catalogue</p>
              <p className="text-lg font-bold text-white mt-1">
                {fmt(product.price)} <span className="text-sm text-slate-500">MAD</span>
              </p>
            </div>
            <div className="p-3 rounded-xl bg-white/3 border border-white/5">
              <p className="text-xs text-slate-500">Stock produit</p>
              <p className={`text-lg font-bold mt-1 ${stockColor}`}>
                {product.quantity - (product.quantityAssembled || 0)} libres
              </p>
            </div>
          </div>

          {/* Unit QR */}
          {unit.qrCode && (
            <div className="flex items-start gap-4">
              <div className="bg-white p-2 rounded-xl">
                <img src={unit.qrCode} alt="QR" className="w-20 h-20" />
              </div>
              <div className="space-y-1 min-w-0">
                <p className="text-xs text-slate-500">QR de l'unité #{unit.unitNumber}</p>
                <p className="text-xs font-mono text-slate-600 break-all">{unit.qrCodeId}</p>
                {/* Hidden printable */}
                <div className="hidden">
                  <div ref={printRef} style={{ width: `${paperWidth}mm`, padding: '3mm', fontFamily: 'monospace', fontSize: '10px', color: '#000', background: '#fff' }}>
                    <div style={{ textAlign: 'center', borderBottom: '1px dashed #ccc', paddingBottom: '2mm', marginBottom: '2mm' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '11px' }}>{product.name}</div>
                      <div style={{ color: '#555' }}>Unité #{unit.unitNumber}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <img src={unit.qrCode} alt="QR" style={{ width: '36mm', height: '36mm' }} />
                    </div>
                    <div style={{ textAlign: 'center', color: '#555', fontSize: '8px', marginTop: '2mm' }}>{unit.qrCodeId}</div>
                  </div>
                </div>
                <button onClick={handlePrint} className="btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1.5">
                  <Printer className="w-3 h-3" /> Imprimer
                </button>
              </div>
            </div>
          )}

          {/* Sell button */}
          <button
            onClick={() => navigate('/sales/new', { state: { product } })}
            disabled={product.quantity === 0}
            className="btn-primary w-full justify-center py-3 disabled:opacity-50">
            <ShoppingCart className="w-4 h-4" />
            {product.quantity === 0 ? t('products.outOfStock') : t('common.sell')}
          </button>
        </div>
      )}

      {/* ── PRODUCT result (unchanged) ── */}
      {result?.type === 'product' && product && !loading && (
        <div className="card animate-in space-y-4">
          <div className="flex items-start gap-4">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-white/3 border border-white/5">
              <p className="text-xs text-slate-500">{t('products.price')}</p>
              <p className="text-xl font-bold text-white mt-1">{fmt(product.price)} <span className="text-sm text-slate-500">MAD</span></p>
            </div>
            <div className="p-3 rounded-xl bg-white/3 border border-white/5">
              <p className="text-xs text-slate-500">{t('products.stock')}</p>
              <p className={`text-xl font-bold mt-1 ${stockColor}`}>{product.quantity}</p>
            </div>
          </div>

          {product.components?.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">{t('products.components')}</p>
              <div className="flex flex-wrap gap-1.5">
                {product.components.map((c, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/5 text-slate-400">
                    {c.name}
                    {c.quantity > 1 && <span className="opacity-60 ms-0.5">×{c.quantity}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Hidden printable */}
          <div className="hidden">
            <div ref={result?.type === 'product' ? printRef : null}
              style={{ width: `${paperWidth}mm`, padding: '3mm', fontFamily: 'monospace', fontSize: '10px', color: '#000', background: '#fff' }}>
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #ccc', paddingBottom: '2mm', marginBottom: '2mm' }}>
                <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{product.name}</div>
                <div style={{ color: '#555', fontSize: '9px' }}>{product.sku}</div>
              </div>
              {product.qrCode && <div style={{ textAlign: 'center' }}><img src={product.qrCode} alt="QR" style={{ width: `${Math.min(paperWidth - 10, 40)}mm`, height: `${Math.min(paperWidth - 10, 40)}mm` }} /></div>}
              <div style={{ textAlign: 'center', borderTop: '1px dashed #ccc', paddingTop: '2mm', marginTop: '2mm' }}>
                <div style={{ fontWeight: 'bold' }}>{fmt(product.price)} MAD</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={handlePrint} className="btn-secondary justify-center py-2.5">
              <Printer className="w-4 h-4" /> Imprimer
            </button>
            <button
              onClick={() => navigate('/sales/new', { state: { product } })}
              disabled={product.quantity === 0}
              className="btn-primary justify-center py-2.5 disabled:opacity-50">
              <ShoppingCart className="w-4 h-4" />
              {product.quantity === 0 ? t('products.outOfStock') : t('common.sell')}
            </button>
          </div>
        </div>
      )}

      {/* ── Dimension modal ── */}
      <Modal isOpen={showDimModal} onClose={() => setShowDimModal(false)}
        title="Paramètres d'impression" size="sm">
        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-400 mb-3">Format papier</p>
            <div className="space-y-2">
              {PAPER_SIZES.map(size => (
                <button key={size.label} type="button"
                  onClick={() => setSelectedSize(size)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all
                    ${selectedSize.label === size.label
                      ? 'border-primary-500/50 bg-primary-600/10 text-primary-400'
                      : 'border-white/10 bg-white/3 text-slate-300 hover:border-white/20'}`}>
                  <span className="font-medium">{size.label}</span>
                  {size.width && <span className="text-sm font-mono">{size.width}mm</span>}
                </button>
              ))}
            </div>
          </div>
          {selectedSize.width === null && (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Largeur personnalisée (mm)</label>
              <div className="flex items-center gap-3">
                <input type="range" min="40" max="210" value={customWidth}
                  onChange={e => setCustomWidth(Number(e.target.value))}
                  className="flex-1 accent-primary-500" />
                <div className="flex items-center gap-1 w-24">
                  <input type="number" min="40" max="210" value={customWidth}
                    onChange={e => setCustomWidth(Number(e.target.value))}
                    className="input-field text-center py-1.5 w-16" />
                  <span className="text-slate-500 text-sm">mm</span>
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-end border-t border-white/5 pt-3">
            <button onClick={() => setShowDimModal(false)} className="btn-primary">Appliquer</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}