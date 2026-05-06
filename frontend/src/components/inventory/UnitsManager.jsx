import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Wrench, Check, ShoppingBag, MoveRight, Plus, X,
  AlertCircle, ChevronDown, ChevronUp, Package,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Modal from '../common/Modal';

const STATUS_CONFIG = {
  installed: { label: 'Installé',  color: 'text-green-400',  bg: 'bg-green-900/20 border-green-800/40',  dot: 'bg-green-400' },
  sold:      { label: 'Vendu',     color: 'text-slate-500',  bg: 'bg-slate-800/50 border-slate-700/40',  dot: 'bg-slate-500' },
  moved:     { label: 'Déplacé',   color: 'text-blue-400',   bg: 'bg-blue-900/20 border-blue-800/40',    dot: 'bg-blue-400' },
  missing:   { label: 'Manquant',  color: 'text-red-400',    bg: 'bg-red-900/20 border-red-800/40',      dot: 'bg-red-400' },
};

/* ── Add component form for a unit ──────────────────────────────── */
function AddComponentToUnit({ productId, unitNumber, onSuccess, onCancel }) {
  const [search, setSearch]           = useState('');
  const [results, setResults]         = useState([]);
  const [selected, setSelected]       = useState(null);
  const [qty, setQty]                 = useState(1);
  const [loading, setLoading]         = useState(false);
  const [searching, setSearching]     = useState(false);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/products?search=${encodeURIComponent(search)}&limit=8`);
        setResults(data.data.filter(p => p._id !== productId));
      } catch {} finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleAdd = async () => {
    if (!selected) { toast.error('Sélectionnez un produit'); return; }
    setLoading(true);
    try {
      await api.post(`/products/${productId}/units/${unitNumber}/components`, {
        linkedProductId: selected._id,
        name: selected.name,
        quantity: qty,
      });
      toast.success(`${selected.name} ajouté à l'unité #${unitNumber}`);
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally { setLoading(false); }
  };

  return (
    <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5 space-y-3">
      <p className="text-xs font-semibold text-primary-400 uppercase tracking-wider">
        Ajouter un composant à l'unité #{unitNumber}
      </p>

      {/* Product search */}
      <div className="relative">
        <input
          type="text"
          value={selected ? selected.name : search}
          onChange={e => { setSelected(null); setSearch(e.target.value); }}
          placeholder="Chercher un produit composant..."
          className="input-field text-sm"
          autoFocus
        />
        {selected && (
          <button onClick={() => { setSelected(null); setSearch(''); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {!selected && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
            {results.map(p => {
              const free = p.quantity - (p.quantityAssembled || 0);
              return (
                <button key={p._id} onClick={() => { setSelected(p); setSearch(''); setResults([]); }}
                  className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.category?.name}</p>
                  </div>
                  <span className={`text-xs flex-shrink-0 font-medium ${free > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {free} libre{free !== 1 ? 's' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-500 flex-shrink-0">Quantité :</label>
          <input type="number" min="1" value={qty}
            onChange={e => setQty(Number(e.target.value))}
            className="input-field w-20 text-sm text-center py-1.5" />
          <span className="text-xs text-slate-600">
            (libre: {(selected.quantity - (selected.quantityAssembled || 0))})
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-secondary text-xs py-1.5 flex-1 justify-center">Annuler</button>
        <button onClick={handleAdd} disabled={!selected || loading}
          className="btn-primary text-xs py-1.5 flex-1 justify-center disabled:opacity-50">
          <Plus className="w-3.5 h-3.5" />
          {loading ? 'Ajout...' : 'Ajouter'}
        </button>
      </div>
    </div>
  );
}

/* ── Single unit card ───────────────────────────────────────────── */
function UnitCard({ unit, productId, productName, onRefresh }) {
  const navigate = useNavigate();
  const [expanded, setExpanded]   = useState(false);
  const [showAdd, setShowAdd]     = useState(false);
  const [actionIdx, setActionIdx] = useState(null); // comp index with open action
  const [updating, setUpdating]   = useState(false);

  const installedCount = unit.components.filter(c => c.status === 'installed').length;
  const soldCount      = unit.components.filter(c => c.status === 'sold').length;

  const handleSell = (comp, compIdx) => {
    // Navigate to sales page with the linked component product pre-filled
    navigate('/sales/new', {
      state: {
        product: {
          _id: comp.linkedProduct?._id || comp.linkedProduct,
          name: comp.linkedProductName || comp.name,
          quantity: 999, // will be validated server-side
          price: 0,      // user fills this in
          category: null,
          quantityAssembled: 0,
        },
        fromComponent: {
          parentId:     productId,
          parentName:   productName,
          componentIdx: compIdx, // template array idx — used by backend? No, we use unitNumber now
          unitNumber:   unit.unitNumber,
          componentName: comp.name,
        },
      },
    });
  };

  const handleMarkStatus = async (compIdx, status) => {
    setUpdating(true);
    try {
      await api.put(`/products/${productId}/units/${unit.unitNumber}/components/${compIdx}`, { status });
      toast.success(`Marqué comme "${STATUS_CONFIG[status].label}"`);
      setActionIdx(null);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally { setUpdating(false); }
  };

  return (
    <div className="rounded-xl border border-white/5 bg-white/2 overflow-hidden">
      {/* Unit header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-primary-600/20 border border-primary-500/30 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-primary-400">#{unit.unitNumber}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">
            Unité #{unit.unitNumber}
            {unit.unitLabel && <span className="text-slate-500 ms-2 font-normal">{unit.unitLabel}</span>}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {installedCount} installé{installedCount !== 1 ? 's' : ''}
            {soldCount > 0 && <span className="text-slate-600 ms-2">· {soldCount} vendu{soldCount !== 1 ? 's' : ''}</span>}
            {unit.components.length === 0 && <span className="text-slate-600">· Aucun composant</span>}
          </p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {/* Expanded: component list */}
      {expanded && (
        <div className="border-t border-white/5 p-3 space-y-2">
          {unit.components.length === 0 && (
            <p className="text-xs text-slate-600 italic text-center py-3">Aucun composant pour cette unité</p>
          )}

          {unit.components.map((comp, compIdx) => {
            const cfg = STATUS_CONFIG[comp.status] || STATUS_CONFIG.installed;
            const isOpen = actionIdx === compIdx;

            return (
              <div key={compIdx} className={`rounded-lg border overflow-hidden ${cfg.bg}`}>
                {/* Component row */}
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${comp.status !== 'installed' ? 'line-through opacity-50' : 'text-white'}`}>
                      {comp.name}
                      {comp.quantity > 1 && <span className="text-slate-500 ms-1">×{comp.quantity}</span>}
                    </p>
                    <p className={`text-xs ${cfg.color}`}>{cfg.label}</p>
                  </div>

                  {/* Actions — only for installed components with a linked product */}
                  {comp.status === 'installed' && comp.linkedProduct && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleSell(comp, compIdx)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-green-900/30 border border-green-800/40 text-green-400 hover:bg-green-900/50 transition-colors"
                        title="Vendre séparément"
                      >
                        <ShoppingBag className="w-3 h-3" />
                        Vendre
                      </button>
                      <button
                        onClick={() => setActionIdx(isOpen ? null : compIdx)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition-colors
                          ${isOpen
                            ? 'bg-blue-900/50 border-blue-800/60 text-blue-300'
                            : 'bg-white/3 border-white/10 text-slate-400 hover:border-blue-500/30 hover:text-blue-400'}`}
                        title="Autres actions"
                      >
                        <MoveRight className="w-3 h-3" />
                        Statut
                      </button>
                    </div>
                  )}

                  {/* For sold/moved: allow marking back as installed */}
                  {comp.status !== 'installed' && (
                    <button
                      onClick={() => handleMarkStatus(compIdx, 'installed')}
                      disabled={updating}
                      className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-500 hover:text-green-400 hover:border-green-500/30 transition-colors"
                      title="Marquer comme installé"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Status change panel */}
                {isOpen && (
                  <div className="border-t border-white/5 px-3 py-2 flex gap-2 flex-wrap">
                    <span className="text-xs text-slate-500 self-center me-1">Marquer comme :</span>
                    {Object.entries(STATUS_CONFIG)
                      .filter(([k]) => k !== comp.status && k !== 'installed')
                      .map(([status, cfg]) => (
                        <button key={status}
                          onClick={() => handleMarkStatus(compIdx, status)}
                          disabled={updating}
                          className={`text-xs px-2 py-1 rounded-lg border transition-colors ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </button>
                      ))}
                    <button onClick={() => setActionIdx(null)}
                      className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-500 ms-auto">
                      Fermer
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add component button */}
          {!showAdd ? (
            <button onClick={() => setShowAdd(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/10 text-slate-600 hover:border-primary-500/40 hover:text-primary-400 transition-colors text-xs">
              <Plus className="w-3.5 h-3.5" />
              Ajouter un composant à cette unité
            </button>
          ) : (
            <AddComponentToUnit
              productId={productId}
              unitNumber={unit.unitNumber}
              onSuccess={() => { setShowAdd(false); onRefresh(); }}
              onCancel={() => setShowAdd(false)} />
          )}

          {/* Unit notes */}
          {unit.notes && (
            <p className="text-xs text-slate-600 italic mt-1">{unit.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main UnitsManager modal ────────────────────────────────────── */
export default function UnitsManager({ product, onClose }) {
  const [units, setUnits]     = useState([]);
  const [loading, setLoading] = useState(true);

  const loadUnits = async () => {
    if (!product) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/products/${product._id}/units`);
      setUnits(data.data);
    } catch { toast.error('Erreur de chargement'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadUnits(); }, [product]);

  const installedTotal = units.reduce((s, u) => s + u.components.filter(c => c.status === 'installed').length, 0);
  const soldTotal      = units.reduce((s, u) => s + u.components.filter(c => c.status === 'sold').length, 0);

  return (
    <Modal
      isOpen={!!product}
      onClose={onClose}
      title={`Unités — ${product?.name}`}
      size="lg"
    >
      <div className="p-4 sm:p-6 space-y-4">
        {/* Summary bar */}
        {!loading && units.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-white/3 border border-white/5 text-center">
              <p className="text-xl font-bold text-white">{units.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">unité{units.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="p-3 rounded-xl bg-green-900/20 border border-green-800/30 text-center">
              <p className="text-xl font-bold text-green-400">{installedTotal}</p>
              <p className="text-xs text-slate-500 mt-0.5">installé{installedTotal !== 1 ? 's' : ''}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/40 text-center">
              <p className="text-xl font-bold text-slate-400">{soldTotal}</p>
              <p className="text-xs text-slate-500 mt-0.5">vendu{soldTotal !== 1 ? 's' : ''}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : units.length === 0 ? (
          <div className="text-center py-12 text-slate-600 space-y-2">
            <Package className="w-12 h-12 mx-auto opacity-40" />
            <p className="text-sm">Aucune unité enregistrée</p>
            <p className="text-xs text-slate-700">
              Les unités sont créées automatiquement lors de l'ajout du produit avec des composants liés
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {units.map(unit => (
              <UnitCard
                key={unit.unitNumber}
                unit={unit}
                productId={product._id}
                productName={product.name}
                onRefresh={loadUnits}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}