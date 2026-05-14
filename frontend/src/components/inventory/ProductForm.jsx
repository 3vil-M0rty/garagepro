import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Plus, X, Check, Layers, Sparkles, Link2,
  ShoppingBag, MoveRight, Package,
  AlertCircle, ChevronDown, ChevronRight, QrCode, Printer, Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

/* ─── load products from component subcategories ─────────────── */
async function loadCompSubcatProducts(categoryId, allCategories) {
  if (!allCategories) return {};
  const compCats = allCategories.filter(
    c => (c.parent?._id || c.parent) === categoryId && c.isComponentCategory
  );
  const result = {};
  for (const cc of compCats) {
    try {
      const { data } = await api.get(`/products?category=${cc._id}&limit=200`);
      result[cc._id] = { subcat: cc, products: data.data };
    } catch {}
  }
  return result;
}

/* ─── Print a QR label via window.open — no ref needed ───────── */
function printQRLabel(title, subtitle, qrCode, qrCodeId) {
  const html = `
    <div style="width:52mm;padding:3mm;font-family:monospace;font-size:10px;color:#000;background:#fff;text-align:center">
      <div style="border-bottom:1px dashed #ccc;padding-bottom:2mm;margin-bottom:2mm">
        <div style="font-weight:bold;font-size:11px">${title}</div>
        <div style="color:#555">${subtitle}</div>
      </div>
      ${qrCode ? `<img src="${qrCode}" alt="QR" style="width:36mm;height:36mm" />` : ''}
      <div style="color:#555;font-size:8px;margin-top:2mm">${qrCodeId || ''}</div>
    </div>`;
  const win = window.open('', '_blank', 'width=300,height=400');
  if (!win) { alert('Autorisez les popups pour imprimer'); return; }
  win.document.write(`<html><head><style>@page{size:58mm auto;margin:0}body{margin:0}</style></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 300);
}

/* ─── Status config ───────────────────────────────────────────── */
const STATUS_CFG = {
  installed: { label: 'Installé', dot: 'bg-green-400',  text: 'text-green-400' },
  sold:      { label: 'Vendu',    dot: 'bg-slate-500',  text: 'text-slate-500 line-through' },
  moved:     { label: 'Déplacé', dot: 'bg-blue-400',   text: 'text-blue-400' },
  missing:   { label: 'Manquant',dot: 'bg-red-400',    text: 'text-red-400' },
};

/* ─── Inline units table for EDIT mode ───────────────────────── */
function EditUnitsTable({ productId, productName, onSell }) {
  const [units, setUnits]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState({});
  const [checked, setChecked]     = useState({});
  const [actionState, setAction]  = useState({});
  const [moveTargets, setMove]    = useState({});
  const [allProducts, setAllProds]= useState([]);
  const [busy, setBusy]           = useState({});
  const [showQR, setShowQR]       = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/products/${productId}/units`);
      setUnits(data.data);
    } catch { toast.error('Erreur chargement unités'); }
    finally { setLoading(false); }
  }, [productId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/products?limit=200').then(({ data }) =>
      setAllProds(data.data.filter(p => p._id !== productId))
    ).catch(() => {});
  }, [productId]);

  const k = (u, c) => `${u}-${c}`;

  const markStatus = async (unitNum, compIdx, status) => {
    const key = k(unitNum, compIdx);
    setBusy(p => ({ ...p, [key]: true }));
    try {
      await api.put(`/products/${productId}/units/${unitNum}/components/${compIdx}`, { status });
      toast.success(`Marqué "${STATUS_CFG[status]?.label}"`);
      setAction(p => ({ ...p, [key]: null }));
      setChecked(p => ({ ...p, [key]: false }));
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Erreur'); }
    finally { setBusy(p => ({ ...p, [key]: false })); }
  };

  const doMove = async (unitNum, compIdx) => {
    const key = k(unitNum, compIdx);
    const targetId = moveTargets[key];
    if (!targetId) { toast.error('Sélectionnez un produit cible'); return; }
    setBusy(p => ({ ...p, [key]: true }));
    try {
      await api.put(`/products/${productId}/units/${unitNum}/components/${compIdx}`, { status: 'moved' });
      toast.success('Composant marqué comme déplacé');
      setAction(p => ({ ...p, [key]: null }));
      setChecked(p => ({ ...p, [key]: false }));
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Erreur'); }
    finally { setBusy(p => ({ ...p, [key]: false })); }
  };

  if (loading) return (
    <div className="flex justify-center py-6">
      <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (units.length === 0) return (
    <p className="text-xs text-slate-600 italic text-center py-4">
      Aucune unité — créées automatiquement lors de l'ajout avec composants liés.
    </p>
  );

  return (
    <div className="space-y-2">
      {(units || []).map(unit => {
        const isOpen = !!expanded[unit.unitNumber];
        const inst   = (unit.components || []).filter(c => c.status === 'installed').length;
        const other  = (unit.components || []).filter(c => c.status !== 'installed').length;

        return (
          <div key={unit.unitNumber} className="rounded-xl border border-white/5 overflow-visible">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5">
              <button type="button"
                onClick={() => setExpanded(p => ({ ...p, [unit.unitNumber]: !p[unit.unitNumber] }))}
                className="flex items-center gap-2 flex-1 text-left">
                <div className="w-7 h-7 rounded-lg bg-primary-600/20 border border-primary-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary-400">#{unit.unitNumber}</span>
                </div>
                <div className="text-sm text-white flex-1">
                  Unité #{unit.unitNumber}
                  <span className="text-xs text-slate-500 ms-2">
                    {inst} installé{inst !== 1 ? 's' : ''}
                    {other > 0 && <span className="text-slate-600"> · {other} extrait{other !== 1 ? 's' : ''}</span>}
                  </span>
                </div>
                {isOpen
                  ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
              </button>

              {/* Unit QR button */}
              {unit.qrCode && (
                <button type="button"
                  onClick={() => setShowQR(p => ({ ...p, [unit.unitNumber]: !p[unit.unitNumber] }))}
                  className={`p-1.5 rounded-lg border transition-colors flex-shrink-0
                    ${showQR[unit.unitNumber]
                      ? 'bg-primary-600/20 border-primary-500/40 text-primary-400'
                      : 'bg-white/3 border-white/10 text-slate-500 hover:text-primary-400'}`}
                  title="QR Code de l'unité">
                  <QrCode className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* QR display */}
            {showQR[unit.unitNumber] && unit.qrCode && (
              <div className="border-t border-white/5 px-3 pb-3 flex items-start gap-4">
                <div className="bg-white p-2 rounded-xl flex-shrink-0">
                  <img src={unit.qrCode} alt="QR" className="w-24 h-24" />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <p className="text-xs text-white font-medium">{productName} — Unité #{unit.unitNumber}</p>
                  <p className="text-xs text-slate-600 font-mono truncate">{unit.qrCodeId}</p>
                  <button type="button"
                    onClick={() => printQRLabel(productName, `Unité #${unit.unitNumber}`, unit.qrCode, unit.qrCodeId)}
                    className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1">
                    <Printer className="w-3 h-3" /> Imprimer
                  </button>
                </div>
              </div>
            )}

            {/* Components list */}
            {isOpen && (
              <div className="border-t border-white/5 divide-y divide-white/5">
                {(unit.components || []).length === 0 && (
                  <p className="text-xs text-slate-600 italic px-4 py-3">Aucun composant lié</p>
                )}
                {(unit.components || []).map((comp, ci) => {
                  const key    = k(unit.unitNumber, ci);
                  const isChk  = !!checked[key];
                  const action = actionState[key];
                  const cfg    = STATUS_CFG[comp.status] || STATUS_CFG.installed;

                  return (
                    <div key={ci} className="px-3 py-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <button type="button"
                          onClick={() => setChecked(p => ({ ...p, [key]: !p[key] }))}
                          className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors
                            ${isChk ? 'bg-primary-600 border-primary-600' : 'border-slate-600 hover:border-primary-500'}`}>
                          {isChk && <Check className="w-2.5 h-2.5 text-white" />}
                        </button>
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                        <span className={`text-sm flex-1 ${cfg.text}`}>
                          {comp.name}
                          {comp.quantity > 1 && <span className="text-slate-500 ms-1 text-xs">×{comp.quantity}</span>}
                        </span>
                        <span className="text-xs text-slate-600">{cfg.label}</span>
                      </div>

                      {/* Actions when checked + installed */}
                      {isChk && comp.status === 'installed' && (
                        <div className="ms-6 space-y-2">
                          <div className="flex gap-2 flex-wrap">
                            <button type="button"
                              onClick={() => { setChecked(p => ({ ...p, [key]: false })); onSell(comp, unit.unitNumber, ci); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-900/20 border border-green-800/40 text-green-400 hover:bg-green-900/40 transition-colors">
                              <ShoppingBag className="w-3 h-3" /> Vendre séparément
                            </button>
                            <button type="button"
                              onClick={() => setAction(p => ({ ...p, [key]: p[key] === 'move' ? null : 'move' }))}
                              disabled={!!busy[key]}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                                ${action === 'move'
                                  ? 'bg-blue-900/30 border-blue-800/50 text-blue-300'
                                  : 'bg-white/3 border-white/10 text-slate-400 hover:border-blue-500/30 hover:text-blue-400'}`}>
                              <MoveRight className="w-3 h-3" /> Déplacer
                            </button>
                            <button type="button"
                              onClick={() => markStatus(unit.unitNumber, ci, 'missing')}
                              disabled={!!busy[key]}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/3 border border-white/10 text-red-400 hover:bg-red-900/20 hover:border-red-800/40 transition-colors">
                              <X className="w-3 h-3" /> Manquant
                            </button>
                          </div>
                          {action === 'move' && (
                            <div className="p-3 rounded-xl bg-blue-900/10 border border-blue-800/30 space-y-2">
                              <p className="text-xs text-blue-300">Déplacer vers quel produit ?</p>
                              <select value={moveTargets[key] || ''}
                                onChange={e => setMove(p => ({ ...p, [key]: e.target.value }))}
                                className="input-field text-sm">
                                <option value="">— Sélectionner —</option>
                                {allProducts.map(p => (
                                  <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>
                                ))}
                              </select>
                              <div className="flex gap-2">
                                <button type="button"
                                  onClick={() => setAction(p => ({ ...p, [key]: null }))}
                                  className="btn-secondary text-xs py-1.5 flex-1 justify-center">Annuler</button>
                                <button type="button"
                                  onClick={() => doMove(unit.unitNumber, ci)}
                                  disabled={!moveTargets[key] || !!busy[key]}
                                  className="btn-primary text-xs py-1.5 flex-1 justify-center disabled:opacity-50">
                                  {busy[key] ? '...' : 'Confirmer'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Restore for non-installed */}
                      {isChk && comp.status !== 'installed' && (
                        <div className="ms-6">
                          <button type="button"
                            onClick={() => markStatus(unit.unitNumber, ci, 'installed')}
                            disabled={!!busy[key]}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-green-900/20 border border-green-800/40 text-green-400 transition-colors">
                            <Check className="w-3 h-3" /> Marquer installé
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Live units preview for NEW product ─────────────────────── */
function LiveUnitsPreview({ quantity, selectedComps, units, onUnitsChange }) {
  const qty = parseInt(quantity) || 0;

  // Sync units when qty or selectedComps change — preserve per-unit exclusions
  useEffect(() => {
    if (qty === 0 || selectedComps.length === 0) { onUnitsChange([]); return; }
    const newUnits = Array.from({ length: qty }, (_, i) => {
      const existing = (units || []).find(u => u.unitNumber === i + 1);
      const components = selectedComps.map(comp => {
        const linkedId = comp.linkedProduct?._id || comp.linkedProduct;
        const existingComp = existing?.components.find(
          ec => String(ec.linkedProduct) === String(linkedId)
        );
        return existingComp || {
          name: comp.name,
          linkedProduct: linkedId,
          linkedProductName: comp.name,
          quantity: comp.quantity || 1,
          status: 'installed',
          excluded: false,
        };
      });
      return { unitNumber: i + 1, components };
    });
    onUnitsChange(newUnits);
  }, [qty, JSON.stringify(selectedComps)]);

  if (qty === 0 || selectedComps.length === 0) return null;

  const toggleComp = (unitIdx, compIdx) => {
    const updated = (units || []).map((u, ui) =>
      ui !== unitIdx ? u : {
        ...u,
        components: u.components.map((c, ci) =>
          ci !== compIdx ? c : { ...c, excluded: !c.excluded }
        ),
      }
    );
    onUnitsChange(updated);
  };

  const toggleCompAll = (compIdx, exclude) => {
    onUnitsChange((units || []).map(u => ({
      ...u,
      components: u.components.map((c, ci) => ci === compIdx ? { ...c, excluded: exclude } : c),
    })));
  };

  const totalIncluded = (units || []).reduce(
    (s, u) => s + u.components.filter(c => !c.excluded).length, 0
  );
  const unitsWithExclusions = (units || []).filter(u => u.components.some(c => c.excluded)).length;

  return (
    <div className="border border-primary-500/20 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-primary-600/10 border-b border-primary-500/20">
        <Package className="w-4 h-4 text-primary-400" />
        <span className="text-sm font-medium text-primary-300">
          {qty} unité{qty !== 1 ? 's' : ''} — cliquez pour inclure/exclure par unité
        </span>
        <span className="text-xs text-primary-500 ms-auto">QR à la sauvegarde</span>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white/2 border-b border-white/5 overflow-x-auto">
        <div className="w-10 flex-shrink-0" />
        {selectedComps.map((comp, ci) => (
          <div key={ci} className="flex-1 min-w-[80px] text-center">
            <p className="text-xs text-slate-400 font-medium truncate">{comp.name}</p>
            <div className="flex gap-1 justify-center mt-0.5">
              <button type="button" onClick={() => toggleCompAll(ci, false)}
                className="text-xs text-green-500 hover:text-green-400 px-1">Tous</button>
              <span className="text-slate-700">·</span>
              <button type="button" onClick={() => toggleCompAll(ci, true)}
                className="text-xs text-red-500 hover:text-red-400 px-1">Aucun</button>
            </div>
          </div>
        ))}
        <div className="w-16 flex-shrink-0" />
      </div>

      {/* Unit rows */}
      <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
        {(units.length > 0 ? units : Array.from({ length: qty }, (_, i) => ({
          unitNumber: i + 1,
          components: selectedComps.map(c => ({ ...c, excluded: false })),
        }))).map((unit, ui) => (
          <div key={unit.unitNumber}
            className="flex items-center gap-2 px-4 py-2.5 hover:bg-white/2 transition-colors">
            <div className="w-10 flex-shrink-0">
              <div className="w-7 h-7 rounded-lg bg-primary-600/15 border border-primary-500/20 flex items-center justify-center">
                <span className="text-xs font-bold text-primary-400">#{unit.unitNumber}</span>
              </div>
            </div>

            {unit.components.map((comp, ci) => {
              const included = !comp.excluded;
              return (
                <div key={ci} className="flex-1 min-w-[80px] flex justify-center">
                  <button type="button" onClick={() => toggleComp(ui, ci)}
                    title={included
                      ? `Retirer ${comp.name} de l'unité #${unit.unitNumber}`
                      : `Ajouter ${comp.name} à l'unité #${unit.unitNumber}`}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium transition-all
                      ${included
                        ? 'bg-green-900/20 border-green-800/40 text-green-400 hover:bg-red-900/20 hover:border-red-800/40 hover:text-red-400'
                        : 'bg-slate-800/50 border-slate-700/40 text-slate-600 hover:bg-green-900/20 hover:border-green-800/40 hover:text-green-400'}`}>
                    {included
                      ? <><Check className="w-2.5 h-2.5 flex-shrink-0" /><span className="truncate max-w-[50px]">{comp.name}</span></>
                      : <><X className="w-2.5 h-2.5 flex-shrink-0" /><span className="line-through truncate max-w-[50px]">{comp.name}</span></>
                    }
                  </button>
                </div>
              );
            })}

            <div className="w-16 flex-shrink-0 flex items-center justify-end gap-1 text-xs text-slate-600">
              <QrCode className="w-3 h-3" />
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-white/2 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
        <span>{totalIncluded} composant{totalIncluded !== 1 ? 's' : ''} inclus au total</span>
        {unitsWithExclusions > 0 && (
          <span className="text-orange-400">
            {unitsWithExclusions} unité{unitsWithExclusions !== 1 ? 's' : ''} avec exclusions
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Main ProductForm ───────────────────────────────────────── */
export default function ProductForm({ product, categories, onSuccess, onCancel }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading]           = useState(false);
  const [loadingComps, setLoadingComps] = useState(false);

  const [form, setForm] = useState({
    name: '', category: '', price: '', quantity: '',
    lowStockThreshold: 5, description: '', components: [], imageUrl: '',
  });

  // NEW product state
  const [subcatProducts, setSubcatProducts]           = useState({});
  const [selectedSubcatProds, setSelectedSubcatProds] = useState({});
  const [freeTextComps, setFreeTextComps]             = useState([]);
  const [newComp, setNewComp]                         = useState('');
  const [previewUnits, setPreviewUnits]               = useState([]);

  // EDIT product state
  const [allCompProducts, setAllCompProducts]     = useState([]);
  const [compSearches, setCompSearches]           = useState({});
  const [compDropdowns, setCompDropdowns]         = useState({});
  const [actionState, setActionState]             = useState({});
  const [moveTargets, setMoveTargets]             = useState({});
  const [actionLoading, setActionLoading]         = useState({});
  const [allParentProducts, setAllParentProducts] = useState([]);

  /* prefill when editing */
  useEffect(() => {
    if (!product) return;
    const catId = product.category?._id || product.category || '';
    setForm({
      name:              product.name || '',
      category:          catId,
      price:             product.price ?? '',
      quantity:          product.quantity ?? '',
      lowStockThreshold: product.lowStockThreshold ?? 5,
      description:       product.description || '',
      components:        product.components || [],
      imageUrl:          product.imageUrl || '',
    });
    if (catId) {
      loadCompSubcatProducts(catId, categories).then(res =>
        setAllCompProducts(Object.values(res).flatMap(r => r.products))
      );
    }
  }, [product]);

  useEffect(() => {
    if (!product) return;
    api.get('/products?limit=200').then(({ data }) =>
      setAllParentProducts(data.data.filter(p => p._id !== product._id))
    ).catch(() => {});
  }, [product]);

  /* category change (new product only) */
  const handleCategoryChange = async (categoryId) => {
    setForm(f => ({ ...f, category: categoryId }));
    if (product) return;
    setSubcatProducts({}); setSelectedSubcatProds({}); setPreviewUnits([]);
    if (!categoryId) return;
    setLoadingComps(true);
    try {
      const res = await loadCompSubcatProducts(categoryId, categories);
      setSubcatProducts(res);
      setAllCompProducts(Object.values(res).flatMap(r => r.products));
    } finally { setLoadingComps(false); }
  };

  const toggleSubcatProd = (prod) => {
    setSelectedSubcatProds(prev => {
      if (prev[prod._id]) { const n = { ...prev }; delete n[prod._id]; return n; }
      return { ...prev, [prod._id]: { product: prod, qty: 1 } };
    });
  };
  const setSubcatProdQty = (id, qty) =>
    setSelectedSubcatProds(p => ({ ...p, [id]: { ...p[id], qty: Math.max(1, qty) } }));

  const addFreeText = () => {
    const v = newComp.trim(); if (!v) return;
    if (freeTextComps.includes(v)) { toast.error('Déjà ajouté'); return; }
    setFreeTextComps(p => [...p, v]); setNewComp('');
  };

  /* selected components array for live preview */
  const selectedCompsArray = useMemo(() =>
    Object.values(selectedSubcatProds).map(({ product: p, qty }) => ({
      name: p.name, linkedProduct: p._id, quantity: qty,
    })),
    [selectedSubcatProds]
  );

  /* edit helpers */
  const updateComp = (idx, field, value) =>
    setForm(f => ({ ...f, components: f.components.map((c, i) => i === idx ? { ...c, [field]: value } : c) }));
  const removeComp = (idx) =>
    setForm(f => ({ ...f, components: f.components.filter((_, i) => i !== idx) }));
  const addEditComp = () => {
    const v = newComp.trim(); if (!v) return;
    setForm(f => ({
      ...f,
      components: [...f.components, { name: v, checked: false, linkedProduct: null, quantity: 1 }],
    }));
    setNewComp('');
  };
  const linkToProduct = (idx, p) => {
    updateComp(idx, 'linkedProduct', p._id);
    updateComp(idx, 'name', p.name);
    setCompDropdowns(prev => ({ ...prev, [idx]: false }));
  };
  const toggleAction = (idx, action) =>
    setActionState(p => ({ ...p, [idx]: p[idx] === action ? null : action }));

  const doSell = async (idx) => {
    const comp = form.components[idx];
    const linkedId = comp?.linkedProduct?._id || comp?.linkedProduct;
    if (!linkedId) { toast.error('Composant non lié à un produit stock'); return; }
    setActionLoading(p => ({ ...p, [idx]: true }));
    try {
      const { data } = await api.get(`/products/${linkedId}`);
      onCancel();
      navigate('/sales/new', {
        state: {
          product: data.data,
          fromComponent: { parentId: product._id, parentName: product.name, componentIdx: idx, componentName: comp.name },
        },
      });
    } catch (err) { toast.error(err.response?.data?.message || 'Erreur'); }
    finally { setActionLoading(p => ({ ...p, [idx]: false })); }
  };

  const doMove = async (idx) => {
    const targetId = moveTargets[idx];
    if (!targetId || !product) { toast.error('Sélectionnez un produit cible'); return; }
    setActionLoading(p => ({ ...p, [idx]: true }));
    try {
      await api.post(`/products/${product._id}/component/move`, { componentIdx: idx, targetProductId: targetId });
      toast.success('Composant déplacé'); setActionState(p => ({ ...p, [idx]: null })); onSuccess();
    } catch (err) { toast.error(err.response?.data?.message || 'Erreur'); }
    finally { setActionLoading(p => ({ ...p, [idx]: false })); }
  };

  const handleUnitSell = async (comp, unitNumber, compIdx) => {
    const linkedId = comp.linkedProduct?._id || comp.linkedProduct;
    if (!linkedId) { toast.error('Composant non lié à un produit stock'); return; }
    try {
      const { data } = await api.get(`/products/${linkedId}`);
      onCancel();
      navigate('/sales/new', {
        state: {
          product: data.data,
          fromComponent: {
            parentId: product._id, parentName: product.name,
            componentIdx: compIdx, componentName: comp.name, unitNumber,
          },
        },
      });
    } catch (err) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  /* submit */
  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      let finalComponents;
      let finalUnits;

      if (product) {
        finalComponents = form.components;
      } else {
        const fromSubcat = Object.values(selectedSubcatProds).map(({ product: p, qty }) => ({
          name: p.name, checked: false, linkedProduct: p._id, quantity: qty,
          canSellSeparately: false, canMove: true,
        }));
        const fromFree = freeTextComps.map(name => ({
          name, checked: false, linkedProduct: null, quantity: 1,
          canSellSeparately: false, canMove: true,
        }));
        finalComponents = [...fromSubcat, ...fromFree];

        // Send preview units — filter excluded components per unit
        if (previewUnits.length > 0) {
          finalUnits = previewUnits.map(u => ({
            unitNumber: u.unitNumber,
            components: u.components
              .filter(c => !c.excluded)
              .map(({ excluded, ...rest }) => rest),
          }));
        }
      }

      const payload = {
        ...form,
        price:      form.price !== '' ? Number(form.price) : 0,
        quantity:   Number(form.quantity),
        components: finalComponents,
        ...(finalUnits ? { units: finalUnits } : {}),
      };

      if (product) {
        await api.put(`/products/${product._id}`, payload);
        toast.success('Produit mis à jour');
      } else {
        await api.post('/products', payload);
        toast.success('Produit créé');
      }
      onSuccess();
    } catch (err) { toast.error(err.response?.data?.message || t('errors.serverError')); }
    finally { setLoading(false); }
  };

  const hasSubcats    = Object.keys(subcatProducts).length > 0;
  const selectedCount = Object.keys(selectedSubcatProds).length;
  const qty           = parseInt(form.quantity) || 0;

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">

      {/* ── Basic fields ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-400 mb-1.5">{t('products.name')} *</label>
          <input type="text" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="input-field" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">{t('products.category')} *</label>
          <select value={form.category} onChange={e => handleCategoryChange(e.target.value)}
            className="input-field" required>
            <option value="">{t('products.filterByCategory')}</option>
            {(categories || []).filter(c => !c.parent).map(c => (
              <optgroup key={c._id} label={c.name}>
                <option value={c._id}>{c.name}</option>
                {(categories || []).filter(sub => (sub.parent?._id || sub.parent) === c._id).map(sub => (
                  <option key={sub._id} value={sub._id}>
                    {'  '}&#8627; {sub.name}{sub.isComponentCategory ? ' (composants)' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">
            {t('products.price')} (MAD)
          </label>
          <input type="number" value={form.price}
            onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            className="input-field" min="0" step="0.01" placeholder="0.00" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">{t('products.quantity')} *</label>
          <input type="number" value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
            className="input-field" min="0" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">{t('products.lowStockThreshold')}</label>
          <input type="number" value={form.lowStockThreshold}
            onChange={e => setForm(f => ({ ...f, lowStockThreshold: Number(e.target.value) }))}
            className="input-field" min="0" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-400 mb-1.5">{t('products.description')}</label>
          <textarea value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="input-field resize-none" rows={2} />
        </div>

        {/* Image URL + disabled upload */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-400 mb-1.5">{t('products.imageUrl')}</label>
          <div className="flex gap-2">
            <input
              type="url"
              value={form.imageUrl}
              onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
              className="input-field flex-1"
              placeholder={t('products.imageUrlPlaceholder')}
            />
            <button
              type="button"
              disabled
              title={t('products.uploadDisabled')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/5 bg-slate-800/40 text-slate-600 cursor-not-allowed text-sm select-none flex-shrink-0"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">{t('products.uploadImage')}</span>
            </button>
          </div>
          {form.imageUrl && (
            <div className="mt-2">
              <img
                src={form.imageUrl}
                alt="Aperçu"
                className="h-16 w-auto rounded-lg border border-white/10 object-cover bg-white/5"
                onError={e => { e.target.style.display = 'none'; }}
                onLoad={e => { e.target.style.display = 'block'; }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Components section ── */}
      <div className="border border-white/5 rounded-xl overflow-visible">
        <div className="flex items-center gap-2 px-4 py-3 bg-white/3 border-b border-white/5">
          <Layers className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">{t('products.components')}</span>
        </div>
        <div className="p-4 space-y-4">

          {/* NEW PRODUCT: subcategory picker */}
          {!product && (
            <>
              {loadingComps && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  Chargement...
                </div>
              )}
              {!form.category && !loadingComps && (
                <p className="text-xs text-slate-600 italic text-center py-2">
                  Sélectionnez une catégorie pour voir les composants disponibles
                </p>
              )}
              {form.category && !loadingComps && !hasSubcats && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-900/50 border border-white/5">
                  <AlertCircle className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-600">Aucune sous-catégorie de composants pour cette catégorie.</p>
                </div>
              )}

              {hasSubcats && !loadingComps && Object.entries(subcatProducts).map(([id, { subcat, products }]) => (
                <div key={id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5" style={{ color: subcat.color }} />
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: subcat.color }}>
                        {subcat.name}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button type="button"
                        onClick={() => (products || []).forEach(p =>
                          setSelectedSubcatProds(prev => ({ ...prev, [p._id]: { product: p, qty: prev[p._id]?.qty || 1 } }))
                        )}
                        className="text-xs text-slate-500 hover:text-primary-400 px-1.5 py-0.5 rounded">Tout</button>
                      <button type="button"
                        onClick={() => setSelectedSubcatProds(prev => {
                          const n = { ...prev }; (products || []).forEach(p => delete n[p._id]); return n;
                        })}
                        className="text-xs text-slate-500 hover:text-red-400 px-1.5 py-0.5 rounded">Aucun</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {(products || []).map(prod => {
                      const isSelected = !!selectedSubcatProds[prod._id];
                      const selData    = selectedSubcatProds[prod._id];
                      const free       = prod.quantity - (prod.quantityAssembled || 0);
                      return (
                        <div key={prod._id}
                          className={`rounded-xl border transition-all ${isSelected ? 'bg-primary-600/10 border-primary-500/40' : 'bg-white/2 border-white/5 hover:border-white/15'}`}>
                          <button type="button" onClick={() => toggleSubcatProd(prod)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
                            <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${isSelected ? 'bg-primary-600 border-primary-600' : 'border-slate-600'}`}>
                              {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm truncate ${isSelected ? 'text-white font-medium' : 'text-slate-400'}`}>{prod.name}</p>
                              <p className={`text-xs ${free > 0 ? 'text-green-500' : 'text-red-500'}`}>{free} libre{free !== 1 ? 's' : ''}</p>
                            </div>
                          </button>
                          {isSelected && (
                            <div className="flex items-center gap-2 px-3 pb-2.5">
                              <span className="text-xs text-slate-500">Qté/unité :</span>
                              <input type="number" min="1" max={free} value={selData.qty}
                                onChange={e => setSubcatProdQty(prod._id, Number(e.target.value))}
                                onClick={e => e.stopPropagation()}
                                className="input-field py-1 px-2 text-center text-sm w-20" />
                              {selData.qty > free && <span className="text-xs text-red-400">Insuffisant</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {(hasSubcats || form.category) && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-xs text-slate-600">+ composants sans stock</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
              )}

              {freeTextComps.length > 0 && (
                <div className="space-y-1.5">
                  {freeTextComps.map((name, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 border border-white/5 group">
                      <span className="w-4 h-4 rounded border border-slate-700 flex-shrink-0" />
                      <span className="text-sm text-slate-300 flex-1">{name}</span>
                      <button type="button" onClick={() => setFreeTextComps(p => p.filter((_, i) => i !== idx))}
                        className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input type="text" value={newComp}
                  onChange={e => setNewComp(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFreeText())}
                  placeholder="Composant sans stock..." className="input-field text-sm" />
                <button type="button" onClick={addFreeText} className="btn-secondary px-3 flex-shrink-0">
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {(selectedCount > 0 || freeTextComps.length > 0) && (
                <div className="flex items-center gap-2 border-t border-white/5 pt-2">
                  <Check className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-xs text-slate-400">
                    {selectedCount + freeTextComps.length} composant(s) · {selectedCount} avec suivi stock
                  </span>
                </div>
              )}
            </>
          )}

          {/* EDIT PRODUCT: component template */}
          {product && (
            <>
              {form.components.length === 0 && (
                <p className="text-xs text-slate-600 italic text-center py-2">Aucun composant template</p>
              )}
              <div className="space-y-2">
                {form.components.map((comp, idx) => {
                  const action = actionState[idx];
                  const busy   = !!actionLoading[idx];
                  return (
                    <div key={idx} className="rounded-xl border border-white/5 bg-white/3 overflow-visible">
                      <div className="flex items-center gap-2 p-3">
                        <button type="button" onClick={() => updateComp(idx, 'checked', !comp.checked)}
                          className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${comp.checked ? 'bg-primary-600 border-primary-600' : 'border-slate-600 hover:border-primary-500'}`}>
                          {comp.checked && <Check className="w-2.5 h-2.5 text-white" />}
                        </button>
                        <input type="text" value={comp.name}
                          onChange={e => updateComp(idx, 'name', e.target.value)}
                          className={`flex-1 bg-transparent text-sm outline-none border-b border-white/10 focus:border-primary-500 pb-0.5 ${comp.checked ? 'line-through text-slate-500' : 'text-white'}`} />
                        <input type="number" value={comp.quantity || 1} min="1"
                          onChange={e => updateComp(idx, 'quantity', Number(e.target.value))}
                          className="w-14 input-field py-1 px-2 text-center text-sm" />
                        <button type="button" onClick={() => removeComp(idx)} className="text-slate-600 hover:text-red-400 p-1">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="px-3 pb-3 space-y-2">
                        {/* Link to stock product */}
                        <div className="relative">
                          <div className="flex items-center gap-2">
                            <Link2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            {comp.linkedProduct ? (
                              <div className="flex items-center gap-2 flex-1">
                                <span className="text-xs text-primary-400 font-medium">
                                  {allCompProducts.find(p => p._id === (comp.linkedProduct?._id || comp.linkedProduct))?.name || comp.name}
                                </span>
                                <button type="button" onClick={() => updateComp(idx, 'linkedProduct', null)}
                                  className="text-slate-600 hover:text-red-400 ms-auto"><X className="w-3 h-3" /></button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => setCompDropdowns(p => ({ ...p, [idx]: !p[idx] }))}
                                className="text-xs text-slate-500 hover:text-primary-400 transition-colors">
                                Lier à un produit stock...
                              </button>
                            )}
                          </div>
                          {compDropdowns[idx] && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                              <div className="p-2 border-b border-white/5">
                                <input type="text" value={compSearches[idx] || ''}
                                  onChange={e => setCompSearches(p => ({ ...p, [idx]: e.target.value }))}
                                  placeholder="Chercher..." className="input-field text-sm py-1.5" autoFocus />
                              </div>
                              <div className="max-h-40 overflow-y-auto">
                                {allCompProducts
                                  .filter(p => !compSearches[idx] || p.name.toLowerCase().includes((compSearches[idx] || '').toLowerCase()))
                                  .map(p => (
                                    <button key={p._id} type="button" onClick={() => linkToProduct(idx, p)}
                                      className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 flex justify-between gap-2">
                                      <span className="text-white truncate">{p.name}</span>
                                      <span className="text-slate-500 text-xs">stock: {p.quantity}</span>
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Sell / Move buttons */}
                        {comp.linkedProduct && (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <button type="button" onClick={() => toggleAction(idx, 'sell')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all
                                  ${action === 'sell' ? 'bg-green-600/20 border-green-500/40 text-green-400' : 'bg-white/3 border-white/10 text-slate-400 hover:text-green-400 hover:border-green-500/30'}`}>
                                <ShoppingBag className="w-3.5 h-3.5" /> Vendre séparément
                                <ChevronDown className={`w-3 h-3 transition-transform ${action === 'sell' ? 'rotate-180' : ''}`} />
                              </button>
                              <button type="button" onClick={() => toggleAction(idx, 'move')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all
                                  ${action === 'move' ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-white/3 border-white/10 text-slate-400 hover:text-blue-400 hover:border-blue-500/30'}`}>
                                <MoveRight className="w-3.5 h-3.5" /> Déplacer
                                <ChevronDown className={`w-3 h-3 transition-transform ${action === 'move' ? 'rotate-180' : ''}`} />
                              </button>
                            </div>
                            {action === 'sell' && (
                              <div className="p-3 rounded-xl bg-green-900/10 border border-green-800/30 space-y-2">
                                <p className="text-xs text-green-300">Vendre <strong>1 unité</strong> de "{comp.name}" séparément.</p>
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => toggleAction(idx, 'sell')} className="btn-secondary text-xs py-1.5 flex-1 justify-center">Annuler</button>
                                  <button type="button" onClick={() => doSell(idx)} disabled={busy}
                                    className="text-xs py-1.5 px-4 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium flex items-center gap-1.5 flex-1 justify-center disabled:opacity-50">
                                    <ShoppingBag className="w-3.5 h-3.5" />{busy ? '...' : 'Aller à la vente'}
                                  </button>
                                </div>
                              </div>
                            )}
                            {action === 'move' && (
                              <div className="p-3 rounded-xl bg-blue-900/10 border border-blue-800/30 space-y-2">
                                <p className="text-xs text-blue-300">Déplacer vers quel produit ?</p>
                                <select value={moveTargets[idx] || ''} onChange={e => setMoveTargets(p => ({ ...p, [idx]: e.target.value }))} className="input-field text-sm w-full">
                                  <option value="">— Sélectionner —</option>
                                  {allParentProducts.map(p => <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>)}
                                </select>
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => toggleAction(idx, 'move')} className="btn-secondary text-xs py-1.5 flex-1 justify-center">Annuler</button>
                                  <button type="button" onClick={() => doMove(idx)} disabled={!moveTargets[idx] || busy}
                                    className="text-xs py-1.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1.5 flex-1 justify-center disabled:opacity-50">
                                    <MoveRight className="w-3.5 h-3.5" />{busy ? '...' : 'Confirmer'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input type="text" value={newComp}
                  onChange={e => setNewComp(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEditComp())}
                  placeholder={t('products.addComponent')} className="input-field text-sm" />
                <button type="button" onClick={addEditComp} className="btn-secondary px-3 flex-shrink-0">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Live units preview (new product) ── */}
      {!product && qty > 0 && selectedCompsArray.length > 0 && (
        <LiveUnitsPreview
          quantity={form.quantity}
          selectedComps={selectedCompsArray}
          units={previewUnits}
          onUnitsChange={setPreviewUnits}
        />
      )}

      {/* ── Units table (edit mode) ── */}
      {product && (
        <div className="border border-white/5 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-white/3 border-b border-white/5">
            <Package className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">
              Unités ({product.quantity})
            </span>
            {/* Parent product QR */}
            {product.qrCode && (
              <button type="button"
                onClick={() => printQRLabel(product.name, 'Produit', product.qrCode, product.qrCodeId)}
                className="ms-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-primary-400 hover:border-primary-500/30 transition-colors text-xs"
                title="QR Code du produit parent">
                <QrCode className="w-3.5 h-3.5" />
                QR Produit
              </button>
            )}
          </div>
          <div className="p-4">
            <EditUnitsTable
              productId={product._id}
              productName={product.name}
              onSell={handleUnitSell}
            />
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex gap-3 justify-end pt-1 border-t border-white/5">
        <button type="button" onClick={onCancel} className="btn-secondary">{t('common.cancel')}</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? t('common.loading') : t('common.save')}
        </button>
      </div>
    </form>
  );
}