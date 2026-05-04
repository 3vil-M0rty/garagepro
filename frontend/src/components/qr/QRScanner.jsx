import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, CameraOff, Loader } from 'lucide-react';

export default function QRScanner({ onResult }) {
  const { t } = useTranslation();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);

  const startScan = async () => {
    setError(null);
    try {
      const { Html5QrcodeScanner } = await import('html5-qrcode');
      setScanning(true);
      html5QrRef.current = new Html5QrcodeScanner(
        'qr-reader',
        { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
        false
      );
      html5QrRef.current.render(
        (text) => {
          try {
            const parsed = JSON.parse(text);
            onResult(parsed.qrCodeId || parsed.id || text);
          } catch {
            onResult(text);
          }
          stopScan();
        },
        (err) => { /* ignore scan errors */ }
      );
    } catch (err) {
      setError('Camera access denied or not available.');
      setScanning(false);
    }
  };

  const stopScan = () => {
    if (html5QrRef.current) {
      html5QrRef.current.clear().catch(() => {});
      html5QrRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => { stopScan(); };
  }, []);

  return (
    <div className="space-y-4">
      {!scanning ? (
        <button onClick={startScan} className="btn-primary w-full justify-center py-3">
          <Camera className="w-5 h-5" />
          {t('qr.startScan')}
        </button>
      ) : (
        <button onClick={stopScan} className="btn-secondary w-full justify-center py-3 border-red-500/30 text-red-400">
          <CameraOff className="w-5 h-5" />
          {t('qr.stopScan')}
        </button>
      )}

      {scanning && (
        <div className="text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader className="w-3 h-3 animate-spin" />
          {t('qr.scanInstructions')}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div id="qr-reader" ref={scannerRef} className={scanning ? '' : 'hidden'} />
    </div>
  );
}
