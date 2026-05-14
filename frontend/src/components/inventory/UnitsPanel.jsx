import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactToPrint } from 'react-to-print';
import {
  Plus, Printer, Package, QrCode, X, CheckCircle,
  AlertCircle, Clock, Wrench, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import QRCode from 'qrcode.react';

const STATUS_CFG = {
  available:  { label: null, badgeClass: 'badge-green',  dot: 'bg-green-400' },
  sold:       { label: null, badgeClass: 'badge-red',    dot: 'bg-red-400'   },
  lent:       { label: null, badgeClass: 'badge-yellow', dot: 'bg-yellow-400'},
  installed:  { label: null, badgeClass: 'badge-blue',   dot: 'bg-blue-400'  },
  dismantled: { label: null, badgeClass: 'badge-purple', dot: 'bg-purple-400'},
  retired:    { label: null, badgeClass: 'bg-slate-700 text-slate-400 border border-slate-600', dot: 'bg-slate-500' },
};

const CONDITION_CFG = {
  new:       'badge-blue',
  good:      'badge-green',
  worn:      'badge-yellow',
  for_parts: 'badge-red',
};

export default function UnitsPanel({ product }) {
  const { t } = useTranslation();
  const [units, setUnits]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [addForm, setAddForm]     = useState({ quantity: 1, condition: 'good', purchasePrice: '' });
  const [adding, setAdding]       = useState(false);
  const [printUnit, setPrintUnit] = useState(null);
  const [showQR, setShowQR]       = useState({});
  const [settings, setSettings]   = useState({});
  const labelRef = useRef(null);

  const handlePrintLabel = useReactToPrint({
    contentRef: labelRef,
    documentTitle: `Etiquette-${printUnit?.serialNumber || ''}`,
    pageStyle: `@page { size: 80mm 50mm; margin: 0; } @media print { body { margin: 0; } }`,
  });

  useEffect(() => {
    api.get('/settings').then(({ data }) => { if (data.success) setSettings(data.data); }).catch(() => {});
  }, []);

  const fetchUnits = useCallback(async () => {
    if (!product?._id) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/units/by-product/${product._id}`);
      setUnits(data.data || []);
    } catch { toast.error(t('errors.serverError')); }
    finally { setLoading(false); }
  }, [product?._id]);

  useEffect(() => { fetchUnits(); }, [fetchUnits]);

  const handleAddUnits = async () => {
    setAdding(true);
    try {
      await api.post('/units', {
        productId: product._id,
        quantity: Number(addForm.quantity) || 1,
        condition: addForm.condition,
        purchasePrice: parseFloat(addForm.purchasePrice) || 0,
      });
      toast.success(t('common.success'));
      setShowAdd(false);
      setAddForm({ quantity: 1, condition: 'good', purchasePrice: '' });
      fetchUnits();
    } catch (err) {
      toast.error(err.response?.data?.message || t('errors.serverError'));
    } finally { setAdding(false); }
  };

  const handleStatusChange = async (unitId, status) => {
    try {
      await api.put(`/units/${unitId}`, { status });
      fetchUnits();
      toast.success(t('common.success'));
    } catch (err) { toast.error(err.response?.data?.message || t('errors.serverError')); }
  };

  // Count by status
  const counts = units.reduce((acc, u) => { acc[u.status] = (acc[u.status] || 0) + 1; return acc; }, {});

  const activeStatuses = ['available', 'lent', 'dismantled', 'installed'];
  const available = units.filter(u => activeStatuses.includes(u.status));
  const archived  = units.filter(u => !activeStatuses.includes(u.status));

  return (
    <div className="p-4 space-y-4">
      {/* Summary pills */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(counts).map(([st, n]) => (
            <span key={st} className={`badge ${STATUS_CFG[st]?.badgeClass || 'badge-blue'} text-xs`}>
              {n} {t(`status.${st}`)}
            </span>
          ))}
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary py-1.5 px-3 text-xs">
          <Plus className="w-3.5 h-3.5" />
          {t('units.addUnits')}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="rounded-xl border border-primary-500/20 bg-primary-950/20 p-4 space-y-3 animate-in">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t('units.quantity')}</label>
              <input type="number" min="1" max="50" className="input-field"
                value={addForm.quantity} onChange={e => setAddForm(p => ({ ...p, quantity: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t('units.condition')}</label>
              <select className="input-field" value={addForm.condition} onChange={e => setAddForm(p => ({ ...p, condition: e.target.value }))}>
                {['new', 'good', 'worn', 'for_parts'].map(c => (
                  <option key={c} value={c}>{t(`condition.${c}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t('units.purchasePrice')} MAD</label>
              <input type="number" min="0" step="0.01" className="input-field"
                value={addForm.purchasePrice} onChange={e => setAddForm(p => ({ ...p, purchasePrice: e.target.value }))}
                placeholder="0.00" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="btn-secondary py-1.5 px-3 text-xs">{t('common.cancel')}</button>
            <button onClick={handleAddUnits} disabled={adding} className="btn-primary py-1.5 px-3 text-xs">
              {adding ? t('common.loading') : t('common.add')}
            </button>
          </div>
        </div>
      )}

      {/* Hidden print label */}
      <div style={{ display: 'none' }}>
        <div ref={labelRef} style={{
          width: '80mm', height: '50mm', padding: '3mm', fontFamily: 'Arial, sans-serif',
          fontSize: '10px', color: '#000', background: '#fff', boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2mm',
        }}>
          {settings.garage_name && <div style={{ fontWeight: 'bold', fontSize: '11px' }}>{settings.garage_name}</div>}
          {printUnit && (
            <QRCode value={printUnit.serialNumber || printUnit._id} size={80} level="M" />
          )}
          <div style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '11px' }}>{printUnit?.serialNumber}</div>
          <div style={{ color: '#475569' }}>{product?.name}</div>
          {printUnit?.condition && <div style={{ color: '#64748b', fontSize: '9px' }}>{printUnit.condition}</div>}
          <div style={{ color: '#94a3b8', fontSize: '8px' }}>{new Date().toLocaleDateString('fr-MA')}</div>
        </div>
      </div>

      {/* Unit list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent" />
        </div>
      ) : units.length === 0 ? (
        <div className="text-center py-10 text-slate-500">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
          {t('units.noUnits')}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Active units */}
          {available.map(unit => (
            <UnitRow key={unit._id} unit={unit} t={t}
              onStatusChange={handleStatusChange}
              onPrint={() => { setPrintUnit(unit); setTimeout(handlePrintLabel, 100); }}
              showQR={showQR[unit._id]}
              onToggleQR={() => setShowQR(p => ({ ...p, [unit._id]: !p[unit._id] }))}
            />
          ))}
          {/* Sold/retired */}
          {archived.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-slate-500 cursor-pointer select-none py-1">
                {archived.length} unité(s) vendue(s) / réformée(s)
              </summary>
              <div className="space-y-2 mt-2">
                {archived.map(unit => (
                  <UnitRow key={unit._id} unit={unit} t={t} archived
                    onStatusChange={handleStatusChange}
                    onPrint={() => { setPrintUnit(unit); setTimeout(handlePrintLabel, 100); }}
                    showQR={showQR[unit._id]}
                    onToggleQR={() => setShowQR(p => ({ ...p, [unit._id]: !p[unit._id] }))}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function UnitRow({ unit, t, archived = false, onStatusChange, onPrint, showQR, onToggleQR }) {
  const [showActions, setShowActions] = useState(false);
  const cfg = STATUS_CFG[unit.status] || STATUS_CFG.available;

  return (
    <div className={`rounded-xl border ${archived ? 'border-white/3 bg-white/[0.01] opacity-60' : 'border-white/8 bg-white/[0.02]'} p-3`}>
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status dot */}
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />

        {/* Serial */}
        <span className="font-mono text-sm text-white font-medium flex-1 min-w-0 truncate">
          {unit.serialNumber}
        </span>

        {/* Badges */}
        <span className={`badge ${cfg.badgeClass} text-xs flex-shrink-0`}>
          {t(`status.${unit.status}`)}
        </span>
        <span className={`badge ${CONDITION_CFG[unit.condition] || 'badge-blue'} text-xs flex-shrink-0`}>
          {t(`condition.${unit.condition}`)}
        </span>

        {/* Actions row */}
        <div className="flex gap-1.5 ml-auto flex-shrink-0">
          <button onClick={onToggleQR}
            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
            title="QR Code">
            <QrCode className="w-3.5 h-3.5" />
          </button>
          <button onClick={onPrint}
            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
            title={t('units.printLabel')}>
            <Printer className="w-3.5 h-3.5" />
          </button>
          {!archived && (
            <button onClick={() => setShowActions(!showActions)}
              className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors text-xs font-bold">
              ⋮
            </button>
          )}
        </div>
      </div>

      {/* QR display */}
      {showQR && (
        <div className="mt-3 flex justify-center">
          <div className="bg-white p-2 rounded-lg inline-block">
            <QRCode value={unit.serialNumber || unit._id} size={96} level="M" />
          </div>
        </div>
      )}

      {/* Status change actions */}
      {showActions && !archived && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {['available', 'lent', 'installed', 'dismantled', 'retired'].filter(s => s !== unit.status).map(s => (
            <button key={s}
              onClick={() => { onStatusChange(unit._id, s); setShowActions(false); }}
              className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 transition-colors">
              → {t(`status.${s}`)}
            </button>
          ))}
        </div>
      )}

      {/* Price info */}
      {unit.purchasePrice > 0 && (
        <div className="mt-1 text-xs text-slate-600">
          {t('units.purchasePrice')}: {unit.purchasePrice.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
        </div>
      )}
    </div>
  );
}
