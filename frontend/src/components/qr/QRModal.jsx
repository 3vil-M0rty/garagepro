import { useTranslation } from 'react-i18next';
import { Download, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function QRModal({ product }) {
  const { t } = useTranslation();

  if (!product) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = product.qrCode;
    link.download = `QR-${product.sku}.png`;
    link.click();
  };

  const handleRegenerate = async () => {
    try {
      const { data } = await api.post(`/products/${product._id}/regenerate-qr`);
      product.qrCode = data.data.qrCode;
      toast.success('QR Code régénéré');
    } catch {
      toast.error(t('errors.serverError'));
    }
  };

  return (
    <div className="p-6 flex flex-col items-center">
      <div className="bg-white p-4 rounded-2xl shadow-xl mb-4">
        {product.qrCode ? (
          <img src={product.qrCode} alt="QR Code" className="w-48 h-48" />
        ) : (
          <div className="w-48 h-48 flex items-center justify-center text-gray-400">No QR</div>
        )}
      </div>
      <p className="text-white font-semibold text-center">{product.name}</p>
      <p className="text-slate-500 text-sm font-mono mt-1">{product.sku}</p>
      <p className="text-xs text-slate-600 mt-1">ID: {product.qrCodeId}</p>
      <div className="flex gap-3 mt-5">
        <button onClick={handleDownload} className="btn-primary">
          <Download className="w-4 h-4" /> {t('common.download')}
        </button>
        <button onClick={handleRegenerate} className="btn-secondary">
          <RefreshCw className="w-4 h-4" /> {t('common.generate')}
        </button>
      </div>
    </div>
  );
}
