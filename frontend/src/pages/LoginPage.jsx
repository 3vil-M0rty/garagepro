import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HeartHandshake, Plus, X, Search, Printer, CheckCircle,
  AlertTriangle, Clock, Package,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, differenceInDays } from 'date-fns';
import api from '../services/api';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { printDevis } from '../utils/printDevis';

const TABS = ['active', 'overdue', 'returned'];

const STATUS_CFG = {
  active:   { color: 'badge-blue',   icon: Clock },
  overdue:  { color: 'badge-red',    icon: AlertTriangle },
  returned: { color: 'badge-green',  icon: CheckCircle },
};

const BORROWER_TYPES = ['client', 'garage', 'mechanic', 'employee'];

export default function LoansPage() {
  const { t } = useTranslation();
  const [tab, setTab]           = useState('active');
  const [loans, setLoans]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showNew, setShowNew]   = useState(false);
  const [confirmReturn, setConfirmReturn] = useState(null);
  const [settings, setSettings] = useState({});

  // New loan form
  const [unitSearch, setUnitSearch] = useState('');
  const [unitResults, setUnitResults] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [form, setForm] = useState({
    borrowerName: '', borrowerPhone: '', borrowerType: 'client',
    expectedReturnAt: '', depositAmount: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/settings').then(({ data }) => { if (data.success) setSettings(data.data); }).catch(() => {});
  }, []);

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/loans?status=${tab}&limit=50`);
      setLoans(data.data || []);
    } catch { toast.error(t('errors.serverError')); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  // Search available units
  useEffect(() => {
    if (!unitSearch.trim()) { setUnitResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`/units?status=available&search=${encodeURIComponent(unitSearch)}&limit=8`);
        setUnitResults(data.data || []);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [unitSearch]);

  const handleSubmitLoan = async () => {
    if (!selectedUnit) { toast.error(t('errors.required')); return; }
    if (!form.borrowerName.trim()) { toast.error(t('errors.required')); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post('/loans', {
        unitId: selectedUnit._id,
        ...form,
        depositAmount: parseFloat(form.depositAmount) || 0,
      });
      toast.success(t('common.success'));
      setShowNew(false);
      resetForm();
      // Print loan slip immediately after creation
      printDevis({ loan: data.data, type: 'loan', settings }, 'print');
      fetchLoans();
    } catch (err) {
      toast.error(err.response?.data?.message || t('errors.serverError'));
    } finally { setSubmitting(false); }
  };

  const handleReturn = async () => {
    if (!confirmReturn) return;
    try {
      await api.put(`/loans/${confirmReturn._id}/return`);
      toast.success(t('common.success'));
      setConfirmReturn(null);
      fetchLoans();
    } catch (err) {
      toast.error(err.response?.data?.message || t('errors.serverError'));
    }
  };

  const resetForm = () => {
    setSelectedUnit(null); setUnitSearch(''); setUnitResults([]);
    setForm({ borrowerName: '', borrowerPhone: '', borrowerType: 'client', expectedReturnAt: '', depositAmount: '', notes: '' });
  };

  const fmt = (n) => (n || 0).toLocaleString('fr-MA', { minimumFractionDigits: 2 }) + ' MAD';
  const fmtDate = (d) => { try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return '—'; } };

  const daysInfo = (loan) => {
    if (loan.status === 'returned') return null;
    if (!loan.expectedReturnAt) return null;
    const days = differenceInDays(new Date(loan.expectedReturnAt), new Date());
    if (days < 0) return { label: `${Math.abs(days)} ${t('loans.daysOverdue')}`, color: 'text-red-400' };
    return { label: `${days} ${t('loans.daysLeft')}`, color: 'text-green-400' };
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center">
            <HeartHandshake className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{t('loans.title')}</h1>
          </div>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          {t('loans.new')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 rounded-lg p-1 w-fit">
        {TABS.map(tab_ => (
          <button
            key={tab_}
            onClick={() => setTab(tab_)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all
              ${tab === tab_ ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {t(`loans.${tab_}`)}
          </button>
        ))}
      </div>

      {/* Loans list */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
        </div>
      ) : loans.length === 0 ? (
        <div className="card text-center py-12 text-slate-400">
          <HeartHandshake className="w-10 h-10 mx-auto mb-3 opacity-30" />
          {t('loans.noLoans')}
        </div>
      ) : (
        <div className="space-y-3">
          {loans.map(loan => {
            const info = daysInfo(loan);
            const cfg = STATUS_CFG[loan.status] || STATUS_CFG.active;
            return (
              <div key={loan._id} className={`card flex flex-col sm:flex-row gap-4 items-start sm:items-center ${loan.status === 'overdue' ? 'border-red-800/40 bg-red-950/20' : ''}`}>
                {/* Left: unit info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`badge ${cfg.color}`}>
                      {t(`loans.${loan.status}`)}
                    </span>
                    <span className="font-mono text-xs text-slate-400">{loan.unitSerial || loan.unit?.serialNumber}</span>
                    {info && <span className={`text-xs font-medium ${info.color}`}>{info.label}</span>}
                  </div>
                  <div className="font-semibold text-white">{loan.productName || loan.unit?.product?.name}</div>
                  <div className="text-sm text-slate-400 mt-0.5">
                    <span className="font-medium text-slate-300">{loan.borrowerName}</span>
                    {loan.borrowerPhone && <span className="text-slate-500"> · {loan.borrowerPhone}</span>}
                    <span className="text-slate-600"> · {t(`loans.${loan.borrowerType}`)}</span>
                  </div>
                </div>

                {/* Middle: dates */}
                <div className="text-sm text-slate-400 space-y-0.5 flex-shrink-0">
                  <div>{t('loans.lentAt')}: <span className="text-white">{fmtDate(loan.lentAt)}</span></div>
                  {loan.expectedReturnAt && <div>{t('loans.expectedReturn')}: <span className="text-white">{fmtDate(loan.expectedReturnAt)}</span></div>}
                  {loan.returnedAt && <div>{t('loans.returnedAt')}: <span className="text-green-400">{fmtDate(loan.returnedAt)}</span></div>}
                  {loan.depositAmount > 0 && <div>{t('loans.deposit')}: <span className="text-yellow-400">{fmt(loan.depositAmount)}</span></div>}
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => printDevis({ loan, type: 'loan', settings }, 'print')}
                    className="btn-secondary py-1.5 px-3 text-xs"
                    title={t('loans.printSlip')}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    {t('loans.printSlip')}
                  </button>
                  {loan.status !== 'returned' && (
                    <button
                      onClick={() => setConfirmReturn(loan)}
                      className="btn-primary py-1.5 px-3 text-xs bg-green-600 hover:bg-green-500"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      {t('loans.markReturned')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Loan Modal */}
      <Modal isOpen={showNew} onClose={() => { setShowNew(false); resetForm(); }} title={t('loans.new')} size="lg">
        <div className="p-6 space-y-5">
          {/* Unit search */}
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">{t('loans.unit')} *</label>
            {selectedUnit ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary-900/20 border border-primary-700/30">
                <Package className="w-5 h-5 text-primary-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white">{selectedUnit.product?.name}</div>
                  <div className="text-xs text-slate-400 font-mono">{selectedUnit.serialNumber}</div>
                </div>
                <button onClick={() => { setSelectedUnit(null); setUnitSearch(''); }} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  className="input-field pl-9"
                  value={unitSearch}
                  onChange={e => setUnitSearch(e.target.value)}
                  placeholder={t('units.serial') + '...'}
                />
                {unitResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto">
                    {unitResults.map(u => (
                      <button key={u._id} onClick={() => { setSelectedUnit(u); setUnitSearch(''); setUnitResults([]); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors">
                        <div className="font-medium text-white text-sm">{u.product?.name}</div>
                        <div className="text-xs text-slate-400 font-mono">{u.serialNumber}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Borrower info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">{t('loans.borrowerName')} *</label>
              <input className="input-field" value={form.borrowerName} onChange={e => setForm(p => ({ ...p, borrowerName: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">{t('loans.borrowerPhone')}</label>
              <input className="input-field" value={form.borrowerPhone} onChange={e => setForm(p => ({ ...p, borrowerPhone: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">{t('loans.borrowerType')}</label>
              <select className="input-field" value={form.borrowerType} onChange={e => setForm(p => ({ ...p, borrowerType: e.target.value }))}>
                {BORROWER_TYPES.map(bt => <option key={bt} value={bt}>{t(`loans.${bt}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">{t('loans.deposit')}</label>
              <input type="number" min="0" step="0.01" className="input-field" value={form.depositAmount} onChange={e => setForm(p => ({ ...p, depositAmount: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">{t('loans.expectedReturn')}</label>
              <input type="date" className="input-field" value={form.expectedReturnAt} onChange={e => setForm(p => ({ ...p, expectedReturnAt: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">{t('loans.notes')}</label>
              <input className="input-field" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => { setShowNew(false); resetForm(); }} className="btn-secondary">{t('common.cancel')}</button>
            <button onClick={handleSubmitLoan} disabled={submitting} className="btn-primary">
              {submitting ? t('common.loading') : t('loans.new')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm return */}
      <ConfirmDialog
        isOpen={!!confirmReturn}
        onClose={() => setConfirmReturn(null)}
        onConfirm={handleReturn}
        message={t('loans.confirmReturn')}
      />
    </div>
  );
}