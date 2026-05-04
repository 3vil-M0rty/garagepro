import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, Users, KeyRound, Shield, User as UserIcon } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../services/api';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useAuthStore } from '../store/authStore';

function UserForm({ user, onSuccess, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'staff' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) setForm({ username: user.username, email: user.email, password: '', role: user.role });
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (user) {
        await api.put(`/users/${user._id}`, { username: form.username, email: form.email, role: form.role });
        toast.success('Utilisateur mis à jour');
      } else {
        await api.post('/users', form);
        toast.success('Utilisateur créé');
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || t('errors.serverError'));
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">{t('users.username')} *</label>
        <input type="text" value={form.username}
          onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
          className="input-field" required minLength={3} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">{t('auth.email')} *</label>
        <input type="email" value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          className="input-field" required />
      </div>
      {!user && (
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">{t('auth.password')} *</label>
          <input type="password" value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            className="input-field" required minLength={6} />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-2">{t('users.role')}</label>
        <div className="grid grid-cols-2 gap-3">
          {['admin', 'staff'].map(role => (
            <button key={role} type="button"
              onClick={() => setForm(f => ({ ...f, role }))}
              className={`p-3 rounded-xl border transition-all flex items-center justify-center gap-2 text-sm
                ${form.role === role
                  ? 'border-primary-500/50 bg-primary-600/10 text-primary-400'
                  : 'border-white/10 bg-white/3 text-slate-400 hover:border-white/20'}`}>
              {role === 'admin' ? <Shield className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
              {t(`users.${role}`)}
            </button>
          ))}
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

function ResetPasswordForm({ user, onSuccess, onCancel }) {
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error('Minimum 6 caractères'); return; }
    setLoading(true);
    try {
      await api.put(`/users/${user._id}/reset-password`, { newPassword });
      toast.success('Mot de passe réinitialisé');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || t('errors.serverError'));
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
      <p className="text-slate-400 text-sm">
        Réinitialiser pour <strong className="text-white">{user?.username}</strong>
      </p>
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">{t('users.newPassword')}</label>
        <input type="password" value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          className="input-field" required minLength={6} placeholder="Min. 6 caractères" />
      </div>
      <div className="flex gap-3 justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary">{t('common.cancel')}</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? t('common.loading') : t('users.resetPassword')}
        </button>
      </div>
    </form>
  );
}

// Mobile user card
function UserCard({ u, currentUserId, t, onEdit, onReset, onDelete }) {
  return (
    <div className="p-4 border-b border-white/5 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary-600/20 border border-primary-500/30 flex items-center justify-center text-primary-400 font-bold flex-shrink-0">
            {u.username[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-white text-sm">{u.username}</p>
              {u._id === currentUserId && <span className="badge badge-blue text-xs">Vous</span>}
            </div>
            <p className="text-xs text-slate-500 truncate">{u.email}</p>
            <div className="flex gap-2 mt-1">
              <span className={`badge text-xs ${u.role === 'admin' ? 'badge-purple' : 'badge-blue'}`}>
                {t(`users.${u.role}`)}
              </span>
              <span className={`badge text-xs ${u.isActive ? 'badge-green' : 'badge-red'}`}>
                {u.isActive ? t('users.active') : t('users.inactive')}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={() => onReset(u)}
          className="flex-1 btn-secondary py-1.5 text-xs justify-center text-yellow-400">
          <KeyRound className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset MDP</span>
        </button>
        <button onClick={() => onEdit(u)}
          className="flex-1 btn-secondary py-1.5 text-xs justify-center">
          <Edit2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Modifier</span>
        </button>
        {u._id !== currentUserId && (
          <button onClick={() => onDelete(u)}
            className="flex-1 btn-secondary py-1.5 text-xs justify-center text-red-400 hover:bg-red-500/10">
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Supprimer</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ type: null, data: null });
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(data.data);
    } catch { toast.error(t('errors.serverError')); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/users/${modal.data._id}`);
      toast.success('Utilisateur supprimé');
      setModal({ type: null, data: null });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || t('errors.serverError'));
    } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-4 animate-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white">{t('users.title')}</h1>
          <p className="text-slate-500 text-sm">{users.length} utilisateurs</p>
        </div>
        <button onClick={() => setModal({ type: 'form', data: null })} className="btn-primary flex-shrink-0">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{t('users.add')}</span>
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('users.username')}</th>
                    <th>{t('users.email')}</th>
                    <th>{t('users.role')}</th>
                    <th>{t('users.status')}</th>
                    <th>{t('users.createdAt')}</th>
                    <th className="text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-600/20 border border-primary-500/30 flex items-center justify-center text-primary-400 font-bold text-sm flex-shrink-0">
                            {u.username[0]?.toUpperCase()}
                          </div>
                          <span className="font-medium text-white">
                            {u.username}
                            {u._id === currentUser?._id && (
                              <span className="ms-2 text-xs badge badge-blue">Vous</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="text-slate-400 text-sm">{u.email}</td>
                      <td>
                        <span className={`badge flex items-center gap-1 w-fit ${u.role === 'admin' ? 'badge-purple' : 'badge-blue'}`}>
                          {u.role === 'admin' ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                          {t(`users.${u.role}`)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${u.isActive ? 'badge-green' : 'badge-red'}`}>
                          {u.isActive ? t('users.active') : t('users.inactive')}
                        </span>
                      </td>
                      <td className="text-slate-500 text-sm whitespace-nowrap">
                        {format(new Date(u.createdAt), 'dd/MM/yyyy')}
                      </td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => setModal({ type: 'reset', data: u })}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-yellow-500/10 text-slate-400 hover:text-yellow-400 transition-colors"
                            title={t('users.resetPassword')}>
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setModal({ type: 'form', data: u })}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {u._id !== currentUser?._id && (
                            <button onClick={() => setModal({ type: 'delete', data: u })}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden">
              {users.map(u => (
                <UserCard
                  key={u._id}
                  u={u}
                  currentUserId={currentUser?._id}
                  t={t}
                  onEdit={(u) => setModal({ type: 'form', data: u })}
                  onReset={(u) => setModal({ type: 'reset', data: u })}
                  onDelete={(u) => setModal({ type: 'delete', data: u })}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <Modal isOpen={modal.type === 'form'} onClose={() => setModal({ type: null, data: null })}
        title={modal.data ? t('users.edit') : t('users.add')} size="sm">
        <UserForm user={modal.data}
          onSuccess={() => { setModal({ type: null, data: null }); fetchUsers(); }}
          onCancel={() => setModal({ type: null, data: null })} />
      </Modal>

      <Modal isOpen={modal.type === 'reset'} onClose={() => setModal({ type: null, data: null })}
        title={t('users.resetPassword')} size="sm">
        <ResetPasswordForm user={modal.data}
          onSuccess={() => setModal({ type: null, data: null })}
          onCancel={() => setModal({ type: null, data: null })} />
      </Modal>

      <ConfirmDialog isOpen={modal.type === 'delete'}
        onClose={() => setModal({ type: null, data: null })}
        onConfirm={handleDelete}
        message={`${t('users.confirmDelete')} "${modal.data?.username}" ?`}
        loading={deleting} />
    </div>
  );
}
