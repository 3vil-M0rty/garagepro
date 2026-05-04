import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, Check, Layers, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function ProductForm({ product, categories, onSuccess, onCancel }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    category: '',
    price: '',
    quantity: '',
    lowStockThreshold: 5,
    description: '',
    components: [],
  });

  // For new products: track which default component names are checked
  // key = component name, value = boolean
  const [defaultSelections, setDefaultSelections] = useState({});

  // Custom components added manually (not from defaults)
  const [customComponents, setCustomComponents] = useState([]);
  const [newComponent, setNewComponent] = useState('');

  // ── Editing an existing product ──────────────────────────────────────────
  useEffect(() => {
    if (!product) return;
    const catId = product.category?._id || product.category || '';
    setForm({
      name: product.name || '',
      category: catId,
      price: product.price || '',
      quantity: product.quantity || '',
      lowStockThreshold: product.lowStockThreshold || 5,
      description: product.description || '',
      components: product.components || [],
    });
    // In edit mode we don't use defaultSelections / customComponents —
    // the existing components array is shown directly.
  }, [product]);

  // ── When category changes (new product only) ─────────────────────────────
  const handleCategoryChange = (categoryId) => {
    setForm(f => ({ ...f, category: categoryId }));
    if (product) return; // editing — don't touch components

    const selected = categories.find(c => c._id === categoryId);
    if (selected?.defaultComponents?.length > 0) {
      // All defaults pre-selected by default
      const initial = {};
      selected.defaultComponents.forEach(dc => { initial[dc.name] = true; });
      setDefaultSelections(initial);
    } else {
      setDefaultSelections({});
    }
    // Keep custom components the user already typed
  };

  // Toggle a default component checkbox
  const toggleDefault = (name) => {
    setDefaultSelections(prev => ({ ...prev, [name]: !prev[name] }));
  };

  // Select all / deselect all defaults
  const selectAllDefaults = (val) => {
    const selected = categories.find(c => c._id === form.category);
    if (!selected) return;
    const next = {};
    selected.defaultComponents.forEach(dc => { next[dc.name] = val; });
    setDefaultSelections(next);
  };

  // Add a custom component
  const addCustom = () => {
    const trimmed = newComponent.trim();
    if (!trimmed) return;
    const selectedCat = categories.find(c => c._id === form.category);
    const isAlreadyDefault = selectedCat?.defaultComponents?.some(
      dc => dc.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (isAlreadyDefault) {
      toast.error('Ce composant est déjà dans les défauts — cochez-le ci-dessus');
      return;
    }
    if (customComponents.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Composant déjà ajouté');
      return;
    }
    setCustomComponents(prev => [...prev, trimmed]);
    setNewComponent('');
  };

  const removeCustom = (idx) => {
    setCustomComponents(prev => prev.filter((_, i) => i !== idx));
  };

  // ── For EDIT mode: toggle component checked state ────────────────────────
  const toggleExistingComponent = (idx) => {
    setForm(f => ({
      ...f,
      components: f.components.map((c, i) =>
        i === idx ? { ...c, checked: !c.checked } : c
      ),
    }));
  };

  const removeExistingComponent = (idx) => {
    setForm(f => ({ ...f, components: f.components.filter((_, i) => i !== idx) }));
  };

  const addExistingComponent = () => {
    const trimmed = newComponent.trim();
    if (!trimmed) return;
    setForm(f => ({
      ...f,
      components: [...f.components, { name: trimmed, checked: false }],
    }));
    setNewComponent('');
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let finalComponents;

      if (product) {
        // Edit mode — use form.components directly
        finalComponents = form.components;
      } else {
        // New product — merge selected defaults + custom
        const selectedCat = categories.find(c => c._id === form.category);
        const fromDefaults = (selectedCat?.defaultComponents || [])
          .filter(dc => defaultSelections[dc.name])
          .map(dc => ({ name: dc.name, checked: false }));
        const fromCustom = customComponents.map(name => ({ name, checked: false }));
        finalComponents = [...fromDefaults, ...fromCustom];
      }

      const payload = {
        ...form,
        price: Number(form.price),
        quantity: Number(form.quantity),
        components: finalComponents,
      };

      if (product) {
        await api.put(`/products/${product._id}`, payload);
        toast.success('Produit mis à jour');
      } else {
        await api.post('/products', payload);
        toast.success('Produit créé');
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || t('errors.serverError'));
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = categories.find(c => c._id === form.category);
  const hasDefaults = !product && selectedCategory?.defaultComponents?.length > 0;
  const checkedCount = Object.values(defaultSelections).filter(Boolean).length;
  const totalCount = selectedCategory?.defaultComponents?.length || 0;

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">

      {/* ── Basic fields ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-400 mb-1.5">
            {t('products.name')} *
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="input-field"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">
            {t('products.category')} *
          </label>
          <select
            value={form.category}
            onChange={e => handleCategoryChange(e.target.value)}
            className="input-field"
            required
          >
            <option value="">{t('products.filterByCategory')}</option>
            {categories.map(c => (
              <option key={c._id} value={c._id}>
                {c.name}
                {c.defaultComponents?.length > 0 ? ` · ${c.defaultComponents.length} composants` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">
            {t('products.price')} (MAD) *
          </label>
          <input
            type="number"
            value={form.price}
            onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            className="input-field"
            min="0" step="0.01" required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">
            {t('products.quantity')} *
          </label>
          <input
            type="number"
            value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
            className="input-field"
            min="0" required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">
            {t('products.lowStockThreshold')}
          </label>
          <input
            type="number"
            value={form.lowStockThreshold}
            onChange={e => setForm(f => ({ ...f, lowStockThreshold: Number(e.target.value) }))}
            className="input-field"
            min="0"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-400 mb-1.5">
            {t('products.description')}
          </label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="input-field resize-none"
            rows={2}
          />
        </div>
      </div>

      {/* ── COMPONENTS SECTION ── */}
      <div className="border border-white/5 rounded-xl overflow-hidden">

        {/* Section header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-white/3 border-b border-white/5">
          <Layers className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">{t('products.components')}</span>
        </div>

        <div className="p-4 space-y-4">

          {/* ── NEW PRODUCT: default components picker ── */}
          {hasDefaults && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary-400" />
                  <span className="text-xs font-semibold text-primary-400 uppercase tracking-wider">
                    Composants par défaut
                  </span>
                  <span className="text-xs text-slate-500">
                    ({checkedCount}/{totalCount} sélectionnés)
                  </span>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => selectAllDefaults(true)}
                    className="text-xs text-slate-500 hover:text-primary-400 transition-colors px-1.5 py-0.5 rounded hover:bg-primary-500/10">
                    Tout
                  </button>
                  <button type="button" onClick={() => selectAllDefaults(false)}
                    className="text-xs text-slate-500 hover:text-red-400 transition-colors px-1.5 py-0.5 rounded hover:bg-red-500/10">
                    Aucun
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {selectedCategory.defaultComponents.map((dc) => {
                  const isChecked = !!defaultSelections[dc.name];
                  return (
                    <button
                      key={dc.name}
                      type="button"
                      onClick={() => toggleDefault(dc.name)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all duration-150
                        ${isChecked
                          ? 'bg-primary-600/15 border-primary-500/40 text-white'
                          : 'bg-white/2 border-white/5 text-slate-500 hover:border-white/15 hover:text-slate-300'
                        }`}
                    >
                      {/* Checkbox visual */}
                      <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors
                        ${isChecked
                          ? 'bg-primary-600 border-primary-600'
                          : 'border-slate-600'}`}
                      >
                        {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                      </span>
                      <span className="text-sm truncate">{dc.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Divider between defaults and custom — only when both exist */}
          {hasDefaults && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-xs text-slate-600">+ composants supplémentaires</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>
          )}

          {/* ── NEW PRODUCT: custom extra components ── */}
          {!product && (
            <>
              {customComponents.length > 0 && (
                <div className="space-y-1.5">
                  {customComponents.map((name, idx) => (
                    <div key={idx}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 border border-white/5 group">
                      <span className="w-4 h-4 rounded border border-slate-700 flex-shrink-0" />
                      <span className="text-sm text-slate-300 flex-1">{name}</span>
                      <button type="button" onClick={() => removeCustom(idx)}
                        className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComponent}
                  onChange={e => setNewComponent(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
                  placeholder="Ajouter un composant personnalisé..."
                  className="input-field text-sm"
                />
                <button type="button" onClick={addCustom}
                  className="btn-secondary px-3 flex-shrink-0">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {/* ── EDIT PRODUCT: show existing components with toggle/remove ── */}
          {product && (
            <>
              {form.components.length === 0 && (
                <p className="text-xs text-slate-600 italic text-center py-2">
                  Aucun composant pour ce produit
                </p>
              )}
              <div className="space-y-1.5">
                {form.components.map((comp, idx) => (
                  <div key={idx}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 border border-white/5 group">
                    <button
                      type="button"
                      onClick={() => toggleExistingComponent(idx)}
                      className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors
                        ${comp.checked
                          ? 'bg-primary-600 border-primary-600'
                          : 'border-slate-600 hover:border-primary-500'}`}
                    >
                      {comp.checked && <Check className="w-2.5 h-2.5 text-white" />}
                    </button>
                    <span className={`text-sm flex-1 ${comp.checked ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                      {comp.name}
                    </span>
                    <button type="button" onClick={() => removeExistingComponent(idx)}
                      className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComponent}
                  onChange={e => setNewComponent(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addExistingComponent())}
                  placeholder={t('products.addComponent')}
                  className="input-field text-sm"
                />
                <button type="button" onClick={addExistingComponent}
                  className="btn-secondary px-3 flex-shrink-0">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {/* Summary badge for new products */}
          {!product && (checkedCount > 0 || customComponents.length > 0) && (
            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-xs text-slate-500 whitespace-nowrap">
                {checkedCount + customComponents.length} composant{checkedCount + customComponents.length > 1 ? 's' : ''} seront ajoutés
              </span>
              <div className="flex-1 h-px bg-white/5" />
            </div>
          )}

        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-3 justify-end pt-1 border-t border-white/5">
        <button type="button" onClick={onCancel} className="btn-secondary">
          {t('common.cancel')}
        </button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? t('common.loading') : t('common.save')}
        </button>
      </div>
    </form>
  );
}
