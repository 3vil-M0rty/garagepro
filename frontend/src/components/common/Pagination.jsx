import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, pages, total, onPageChange }) {
  const { t } = useTranslation();
  if (pages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
      <div className="text-sm text-slate-500">
        {t('common.page')} {page} {t('common.of')} {pages} · {total} total
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{t('common.previous')}</span>
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === pages}
          className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-30"
        >
          <span className="hidden sm:inline">{t('common.next')}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
