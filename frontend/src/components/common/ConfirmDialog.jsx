import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

export default function ConfirmDialog({ isOpen, onClose, onConfirm, message, loading = false }) {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('common.confirm')} size="sm">
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-red-900/30 border border-red-800/50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-slate-300 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose} className="btn-secondary" disabled={loading}>
            {t('common.cancel')}
          </button>
          <button onClick={onConfirm} className="btn-danger" disabled={loading}>
            {loading ? t('common.loading') : t('common.confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
