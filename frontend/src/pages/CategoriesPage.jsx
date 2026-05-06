import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Edit2, Trash2, Tag, X, Layers, ChevronRight,
  FolderOpen, Folder, GitBranch, ArrowLeft
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';

const PRESET_COLORS = [
  '#ef4444','#f97316','#eab308','#22c55e','#3b82f6',
  '#6366f1','#8b5cf6','#ec4899','#14b8a6','#f59e0b',
];

function CategoryForm({ category, parentId, parentColor, categories, onSuccess, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: '', description: '', color: '#6366f1',
    parent: '', isComponentCategory: false, defaultComponents: [],
  });
  const [loading, setLoading] = useState(false);
  const [newComp, setNewComp] = useState('');

  useEffect(() => {
    if (category && category._id) {
      // Edit mode — real category object with _id
      setForm({
        name: category.name || '',
        description: category.description || '',
        color: category.color || '#6366f1',
        parent: category.parent?._id || category.parent || '',
        isComponentCategory: category.isComponentCategory || false,
        defaultComponents: category.defaultComponents || [],
      });
    } else if (parentId) {
      // Quick-add subcategory — pre-fill parent and color only
      setForm(f => ({
        ...f,
        parent: parentId,
        color: parentColor || '#6366f1',
      }));
    }
  }, [category, parentId, parentColor]);

  const addComp = () => {
    const t = newComp.trim();
    if (!t) return;
    if (form.defaultComponents.some(c => c.name.toLowerCase() === t.toLowerCase())) {
      toast.error('Composant déjà présent'); return;
    }
    setForm(f => ({ ...f, defaultComponents: [...f.defaultComponents, { name: t }] }));
    setNewComp('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { ...form, parent: form.parent || null };
    try {
      if (category && category._id) {
        await api.put(`/categories/${category._id}`, payload);
        toast.success('Catégorie mise à jour');
      } else {
        await api.post('/categories', payload);
        toast.success('Catégorie créée');
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur serveur');
    } finally { setLoading(false); }
  };

  // Only top-level categories can be parents
  const parentOptions = (categories || []).filter(c => !c.parent && (!category?._id || c._id !== category._id));

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">{t('categories.name')} *</label>
        <input type="text" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="input-field" required />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">Catégorie parente</label>
        <select value={form.parent}
          onChange={e => setForm(f => ({ ...f, parent: e.target.value }))}
          className="input-field">
          <option value="">— Aucune (catégorie principale) —</option>
          {parentOptions.map(c => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
        {form.parent && (
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input type="checkbox" checked={form.isComponentCategory}
              onChange={e => setForm(f => ({ ...f, isComponentCategory: e.target.checked }))}
              className="w-4 h-4 rounded accent-primary-500" />
            <span className="text-sm text-slate-400">
              Sous-catégorie de composants
              <span className="text-xs text-slate-600 ms-1">(les produits ici seront liés aux composants de la catégorie parente)</span>
            </span>
          </label>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">{t('categories.description')}</label>
        <textarea value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          className="input-field resize-none" rows={2} />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-400 mb-2">{t('categories.color')}</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {PRESET_COLORS.map(c => (
            <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
              className={`w-8 h-8 rounded-lg transition-transform hover:scale-110
                ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110' : ''}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="color" value={form.color}
            onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
            className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-white/10" />
          <input type="text" value={form.color}
            onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
            className="input-field w-32 font-mono text-sm" />
          <div className="w-8 h-8 rounded-lg border border-white/10" style={{ backgroundColor: form.color }} />
        </div>
      </div>

      {/* Default components */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-slate-400" />
          <label className="text-sm font-medium text-slate-400">Composants par défaut</label>
        </div>
        {form.defaultComponents.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {form.defaultComponents.map((comp, idx) => (
              <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border"
                style={{ backgroundColor: `${form.color}18`, borderColor: `${form.color}40`, color: form.color }}>
                {comp.name}
                <button type="button" onClick={() => setForm(f => ({ ...f, defaultComponents: f.defaultComponents.filter((_,i) => i !== idx) }))}
                  className="opacity-60 hover:opacity-100"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input type="text" value={newComp}
            onChange={e => setNewComp(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addComp())}
            placeholder="Ex: Dynamo, Démarreur, Alternateur..."
            className="input-field text-sm" />
          <button type="button" onClick={addComp} className="btn-secondary px-3 flex-shrink-0">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-2 border-t border-white/5">
        <button type="button" onClick={onCancel} className="btn-secondary">{t('common.cancel')}</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? t('common.loading') : t('common.save')}
        </button>
      </div>
    </form>
  );
}

export default function CategoriesPage() {
  const { t } = useTranslation();
  const [categories, setCategories]     = useState([]);
  const [productCounts, setProductCounts] = useState({});
  const [loading, setLoading]           = useState(true);
  const [modal, setModal]               = useState({ type: null, data: null });
  const [deleting, setDeleting]         = useState(false);
  const [expandedParent, setExpandedParent] = useState(null); // show subcats of this id

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, prodRes] = await Promise.all([
        api.get('/categories'),
        api.get('/products?limit=2000'),
      ]);
      setCategories(catRes.data.data || []);
      const counts = {};
      (prodRes.data.data || []).forEach(p => {
        const cid = p.category?._id || p.category;
        counts[cid] = (counts[cid] || 0) + 1;
      });
      setProductCounts(counts);
    } catch { toast.error(t('errors.serverError')); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/categories/${modal.data._id}`);
      toast.success('Catégorie supprimée');
      setModal({ type: null, data: null });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || t('errors.serverError'));
    } finally { setDeleting(false); }
  };

  const topLevel = (categories || []).filter(c => !c.parent);
  const subOf = (parentId) => (categories || []).filter(c => (c.parent?._id || c.parent) === parentId);

  const CategoryCard = ({ cat, isSubcat = false }) => {
    const subs = subOf(cat._id);
    const isExpanded = expandedParent === cat._id;
    return (
      <div className={`${isSubcat ? 'ms-4 border-l-2 pl-4' : ''}`}
        style={isSubcat ? { borderColor: cat.color } : {}}>
        <div className={`card group hover:border-white/10 transition-all duration-200 hover:-translate-y-0.5 flex flex-col
          ${isSubcat ? 'border-white/5' : ''}`}>
          <div className="h-1 rounded-t-xl -mt-5 -mx-5 mb-4" style={{ backgroundColor: cat.color }} />

          <div className="flex items-start justify-between mb-3 gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${cat.color}25`, border: `1px solid ${cat.color}40` }}>
                {cat.isComponentCategory
                  ? <Layers className="w-4 h-4" style={{ color: cat.color }} />
                  : cat.parent
                    ? <GitBranch className="w-4 h-4" style={{ color: cat.color }} />
                    : <Tag className="w-4 h-4" style={{ color: cat.color }} />}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-white truncate">{cat.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {productCounts[cat._id] || 0} produit{productCounts[cat._id] !== 1 ? 's' : ''}
                  {cat.isComponentCategory && <span className="ms-1 text-primary-500">· composants</span>}
                </p>
              </div>
            </div>
            {cat.parent && (
              <span className="text-xs px-1.5 py-0.5 rounded-md bg-white/5 text-slate-500 flex-shrink-0">
                sous-cat.
              </span>
            )}
          </div>

          {cat.description && <p className="text-sm text-slate-500 mb-3 line-clamp-2">{cat.description}</p>}

          {cat.defaultComponents?.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Layers className="w-3 h-3 text-slate-600" />
                <span className="text-xs text-slate-600">{cat.defaultComponents.length} composant{cat.defaultComponents.length > 1 ? 's' : ''} par défaut</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {cat.defaultComponents.slice(0, 4).map((c, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-md font-medium"
                    style={{ backgroundColor: `${cat.color}18`, color: cat.color }}>{c.name}</span>
                ))}
                {cat.defaultComponents.length > 4 && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-slate-500">+{cat.defaultComponents.length - 4}</span>
                )}
              </div>
            </div>
          )}

          {/* Subcategory count button */}
          {!isSubcat && subs.length > 0 && (
            <button onClick={() => setExpandedParent(isExpanded ? null : cat._id)}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-white transition-colors mb-3 py-1.5 px-2 rounded-lg bg-white/3 border border-white/5 hover:border-white/15">
              {isExpanded ? <FolderOpen className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5" />}
              {subs.length} sous-catégorie{subs.length > 1 ? 's' : ''}
              <ChevronRight className={`w-3 h-3 ms-auto transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </button>
          )}

          <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: cat.color }} />
              <span className="text-xs text-slate-600 font-mono">{cat.color}</span>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => setModal({ type: 'sub', data: cat })}
                className="btn-secondary py-1 px-2 text-xs" title="Ajouter une sous-catégorie">
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setModal({ type: 'form', data: cat })}
                className="btn-secondary py-1 px-2 text-xs">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setModal({ type: 'delete', data: cat })}
                className="btn-secondary py-1 px-2 text-xs text-red-400 hover:bg-red-500/10 hover:border-red-500/20">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Subcategories expanded */}
        {!isSubcat && isExpanded && subs.length > 0 && (
          <div className="mt-3 space-y-3">
            {subs.map(sub => <CategoryCard key={sub._id} cat={sub} isSubcat />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white">{t('categories.title')}</h1>
          <p className="text-slate-500 text-sm">{topLevel.length} catégories · {categories.length - topLevel.length} sous-catégories</p>
        </div>
        <button onClick={() => setModal({ type: 'form', data: null })} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{t('categories.add')}</span>
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="card h-40 animate-pulse bg-slate-800/50" />)}
        </div>
      ) : topLevel.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-slate-600">
          <Tag className="w-16 h-16 mb-4" /><p>{t('categories.noCategories')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {topLevel.map(cat => <CategoryCard key={cat._id} cat={cat} />)}
        </div>
      )}

      {/* Create/Edit category */}
      <Modal isOpen={modal.type === 'form'} onClose={() => setModal({ type: null, data: null })}
        title={modal.data ? t('categories.edit') : t('categories.add')} size="md">
        <CategoryForm category={modal.data} categories={categories}
          onSuccess={() => { setModal({ type: null, data: null }); fetchData(); }}
          onCancel={() => setModal({ type: null, data: null })} />
      </Modal>

      {/* Quick-add subcategory */}
      <Modal isOpen={modal.type === 'sub'} onClose={() => setModal({ type: null, data: null })}
        title={`Sous-catégorie de "${modal.data?.name}"`} size="md">
        <CategoryForm
          parentId={modal.data?._id}
          parentColor={modal.data?.color}
          categories={categories}
          onSuccess={() => { setModal({ type: null, data: null }); fetchData(); }}
          onCancel={() => setModal({ type: null, data: null })} />
      </Modal>

      <ConfirmDialog isOpen={modal.type === 'delete'}
        onClose={() => setModal({ type: null, data: null })}
        onConfirm={handleDelete}
        message={`Supprimer "${modal.data?.name}" ?`}
        loading={deleting} />
    </div>
  );
}