import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, Tag, X, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6',
  '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b',
];

function CategoryForm({ category, onSuccess, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: '',
    description: '',
    color: '#6366f1',
    defaultComponents: [],
  });
  const [loading, setLoading] = useState(false);
  const [newComp, setNewComp] = useState('');

  useEffect(() => {
    if (category) {
      setForm({
        name: category.name,
        description: category.description || '',
        color: category.color || '#6366f1',
        defaultComponents: category.defaultComponents || [],
      });
    }
  }, [category]);

  const addComp = () => {
    const trimmed = newComp.trim();
    if (!trimmed) return;
    if (form.defaultComponents.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Ce composant existe déjà');
      return;
    }
    setForm(f => ({ ...f, defaultComponents: [...f.defaultComponents, { name: trimmed }] }));
    setNewComp('');
  };

  const removeComp = (idx) => {
    setForm(f => ({ ...f, defaultComponents: f.defaultComponents.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (category) {
        await api.put(`/categories/${category._id}`, form);
        toast.success('Catégorie mise à jour');
      } else {
        await api.post('/categories', form);
        toast.success('Catégorie créée');
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">{t('categories.name')} *</label>
        <input type="text" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="input-field" required />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">{t('categories.description')}</label>
        <textarea value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          className="input-field resize-none" rows={2} />
      </div>

      {/* Color */}
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-2">{t('categories.color')}</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {PRESET_COLORS.map(c => (
            <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
              className={`w-8 h-8 rounded-lg transition-transform hover:scale-110 ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110' : ''}`}
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
          <div className="w-8 h-8 rounded-lg flex-shrink-0 border border-white/10" style={{ backgroundColor: form.color }} />
        </div>
      </div>

      {/* Default Components */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-slate-400" />
          <label className="text-sm font-medium text-slate-400">
            Composants par défaut
            <span className="ms-2 text-xs text-slate-600 font-normal">
              (pré-remplis à la création d'un produit)
            </span>
          </label>
        </div>

        {/* Existing default components */}
        {form.defaultComponents.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {form.defaultComponents.map((comp, idx) => (
              <span key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all group"
                style={{
                  backgroundColor: `${form.color}18`,
                  borderColor: `${form.color}40`,
                  color: form.color,
                }}>
                {comp.name}
                <button type="button" onClick={() => removeComp(idx)}
                  className="opacity-50 hover:opacity-100 transition-opacity ms-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {form.defaultComponents.length === 0 && (
          <p className="text-xs text-slate-600 italic mb-3">Aucun composant par défaut défini</p>
        )}

        {/* Add new */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newComp}
            onChange={e => setNewComp(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addComp())}
            placeholder="Ex: Piston, Soupape, Vilebrequin..."
            className="input-field text-sm"
          />
          <button type="button" onClick={addComp}
            className="btn-secondary px-3 flex-shrink-0 text-sm">
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
  const [categories, setCategories] = useState([]);
  const [productCounts, setProductCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ type: null, data: null });
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, prodRes] = await Promise.all([
        api.get('/categories'),
        api.get('/products?limit=1000'),
      ]);
      setCategories(catRes.data.data);
      const counts = {};
      prodRes.data.data.forEach(p => {
        const cid = p.category?._id || p.category;
        counts[cid] = (counts[cid] || 0) + 1;
      });
      setProductCounts(counts);
    } catch {
      toast.error(t('errors.serverError'));
    } finally {
      setLoading(false);
    }
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
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white">{t('categories.title')}</h1>
          <p className="text-slate-500 text-sm">{categories.length} catégories</p>
        </div>
        <button onClick={() => setModal({ type: 'form', data: null })} className="btn-primary">
          <Plus className="w-4 h-4" /> {t('categories.add')}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="card h-40 animate-pulse bg-slate-800/50" />)}
        </div>
      ) : categories.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-slate-600">
          <Tag className="w-16 h-16 mb-4" />
          <p className="text-lg">{t('categories.noCategories')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(cat => (
            <div key={cat._id}
              className="card group hover:border-white/10 transition-all duration-200 hover:-translate-y-0.5 flex flex-col">
              {/* Color accent bar */}
              <div className="h-1 rounded-t-xl -mt-5 -mx-5 mb-4"
                style={{ backgroundColor: cat.color }} />

              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${cat.color}25`, border: `1px solid ${cat.color}40` }}>
                    <Tag className="w-4 h-4" style={{ color: cat.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{cat.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {productCounts[cat._id] || 0} {t('categories.productCount')}
                    </p>
                  </div>
                </div>
              </div>

              {cat.description && (
                <p className="text-sm text-slate-500 mb-3 line-clamp-2">{cat.description}</p>
              )}

              {/* Default components preview */}
              {cat.defaultComponents?.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Layers className="w-3 h-3 text-slate-600" />
                    <span className="text-xs text-slate-600">
                      {cat.defaultComponents.length} composant{cat.defaultComponents.length > 1 ? 's' : ''} par défaut
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {cat.defaultComponents.slice(0, 4).map((c, i) => (
                      <span key={i}
                        className="text-xs px-2 py-0.5 rounded-md font-medium"
                        style={{ backgroundColor: `${cat.color}18`, color: cat.color }}>
                        {c.name}
                      </span>
                    ))}
                    {cat.defaultComponents.length > 4 && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-slate-500">
                        +{cat.defaultComponents.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5">
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded-full border border-white/20"
                    style={{ backgroundColor: cat.color }} />
                  <span className="text-xs text-slate-600 font-mono">{cat.color}</span>
                </div>
                <div className="flex gap-1.5">
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
          ))}
        </div>
      )}

      <Modal isOpen={modal.type === 'form'} onClose={() => setModal({ type: null, data: null })}
        title={modal.data ? t('categories.edit') : t('categories.add')} size="sm">
        <CategoryForm category={modal.data}
          onSuccess={() => { setModal({ type: null, data: null }); fetchData(); }}
          onCancel={() => setModal({ type: null, data: null })} />
      </Modal>

      <ConfirmDialog isOpen={modal.type === 'delete'}
        onClose={() => setModal({ type: null, data: null })}
        onConfirm={handleDelete}
        message={`${t('categories.confirmDelete')} "${modal.data?.name}" ?`}
        loading={deleting} />
    </div>
  );
}
