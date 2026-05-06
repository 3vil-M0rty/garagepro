import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, CameraOff, Loader, AlertCircle, RefreshCw, FlipHorizontal } from 'lucide-react';

export default function QRScanner({ onResult }) {
  const { t } = useTranslation();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [activeCameraIdx, setActiveCameraIdx] = useState(0);
  const [permissionState, setPermissionState] = useState('idle'); // idle | requesting | granted | denied
  const html5QrRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopScan();
    };
  }, []);

  const stopScan = useCallback(async () => {
    if (html5QrRef.current) {
      try {
        const state = html5QrRef.current.getState();
        // State 2 = SCANNING, State 3 = PAUSED
        if (state === 2 || state === 3) {
          await html5QrRef.current.stop();
        }
        html5QrRef.current.clear();
      } catch { /* ignore cleanup errors */ }
      html5QrRef.current = null;
    }
    if (mountedRef.current) setScanning(false);
  }, []);

  const startScan = useCallback(async (cameraId) => {
    setError(null);
    setPermissionState('requesting');

    try {
      // Dynamically import to avoid SSR issues
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');

      // First, enumerate cameras — this triggers the permission prompt
      let availableCameras = [];
      try {
        availableCameras = await Html5Qrcode.getCameras();
      } catch (camErr) {
        // Permission denied
        if (
          camErr.includes('Permission') ||
          camErr.includes('permission') ||
          camErr.includes('NotAllowed') ||
          camErr.includes('denied')
        ) {
          setPermissionState('denied');
          setError('permission_denied');
          return;
        }
        throw camErr;
      }

      if (!availableCameras || availableCameras.length === 0) {
        setError('no_camera');
        setPermissionState('idle');
        return;
      }

      if (mountedRef.current) {
        setCameras(availableCameras);
        setPermissionState('granted');
      }

      // Stop existing instance if any
      if (html5QrRef.current) {
        await stopScan();
        await new Promise(r => setTimeout(r, 300));
      }

      const targetCameraId = cameraId || availableCameras[activeCameraIdx]?.id || availableCameras[0]?.id;

      // Create new scanner instance
      const scanner = new Html5Qrcode('qr-reader-container', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      html5QrRef.current = scanner;

      if (mountedRef.current) setScanning(true);

      await scanner.start(
        targetCameraId,
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.floor(minEdge * 0.7);
            return { width: size, height: size };
          },
          aspectRatio: 1.0,
          disableFlip: false,
        },
        (decodedText) => {
          onResult(decodedText);
          stopScan();
        },
        () => { /* per-frame error — ignore */ }
      );
    } catch (err) {
      console.error('QR Scanner error:', err);
      if (mountedRef.current) {
        setScanning(false);
        setPermissionState('idle');
        const msg = String(err);
        if (msg.includes('NotAllowed') || msg.includes('Permission') || msg.includes('permission')) {
          setError('permission_denied');
        } else if (msg.includes('NotFound') || msg.includes('no camera')) {
          setError('no_camera');
        } else {
          setError('generic');
        }
      }
    }
  }, [activeCameraIdx, stopScan, onResult]);

  const switchCamera = async () => {
    if (cameras.length < 2) return;
    const nextIdx = (activeCameraIdx + 1) % cameras.length;
    setActiveCameraIdx(nextIdx);
    await stopScan();
    await new Promise(r => setTimeout(r, 300));
    startScan(cameras[nextIdx]?.id);
  };

  const errorMessages = {
    permission_denied: {
      title: 'Accès caméra refusé',
      body: 'Autorisez l\'accès à la caméra dans les paramètres de votre navigateur, puis rechargez la page.',
      icon: '🔒',
    },
    no_camera: {
      title: 'Aucune caméra détectée',
      body: 'Aucune caméra disponible sur cet appareil.',
      icon: '📷',
    },
    generic: {
      title: 'Erreur caméra',
      body: 'Impossible d\'accéder à la caméra. Vérifiez que vous utilisez HTTPS et que la caméra n\'est pas utilisée par une autre application.',
      icon: '⚠️',
    },
  };

  const errInfo = error ? errorMessages[error] || errorMessages.generic : null;

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex gap-2">
        {!scanning ? (
          <button
            onClick={() => startScan()}
            disabled={permissionState === 'requesting'}
            className="btn-primary flex-1 justify-center py-3 disabled:opacity-60"
          >
            {permissionState === 'requesting' ? (
              <><Loader className="w-4 h-4 animate-spin" /> Demande d'accès...</>
            ) : (
              <><Camera className="w-4 h-4" /> {t('qr.startScan')}</>
            )}
          </button>
        ) : (
          <>
            <button
              onClick={stopScan}
              className="btn-secondary flex-1 justify-center py-3 border-red-500/20 text-red-400 hover:bg-red-500/10"
            >
              <CameraOff className="w-4 h-4" /> {t('qr.stopScan')}
            </button>
            {cameras.length > 1 && (
              <button
                onClick={switchCamera}
                className="btn-secondary px-4 flex-shrink-0"
                title="Changer de caméra"
              >
                <FlipHorizontal className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Scanning hint */}
      {scanning && (
        <p className="text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <Loader className="w-3 h-3 animate-spin" />
          {t('qr.scanInstructions')}
          {cameras.length > 1 && (
            <span className="text-slate-600">· {cameras[activeCameraIdx]?.label?.split('(')[0] || 'Caméra'}</span>
          )}
        </p>
      )}

      {/* Camera viewfinder */}
      <div
        id="qr-reader-container"
        className={`rounded-xl overflow-hidden bg-slate-900 ${scanning ? 'min-h-[280px]' : 'hidden'}`}
        style={{ width: '100%' }}
      />

      {/* Error display */}
      {errInfo && (
        <div className="p-4 rounded-xl bg-red-900/20 border border-red-800/40 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm font-medium text-red-400">{errInfo.title}</p>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{errInfo.body}</p>
          {error !== 'no_camera' && (
            <button
              onClick={() => { setError(null); startScan(); }}
              className="btn-secondary text-xs py-1.5 mt-1"
            >
              <RefreshCw className="w-3 h-3" /> Réessayer
            </button>
          )}
        </div>
      )}

      {/* Browser permission instructions — shown after denial */}
      {error === 'permission_denied' && (
        <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5 text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-400">Comment autoriser la caméra :</p>
          <p>🔒 Chrome/Edge : cliquez sur le cadenas dans la barre d'adresse → Caméra → Autoriser</p>
          <p>🦊 Firefox : cliquez sur l'icône caméra barrée dans la barre d'adresse</p>
          <p>🍎 Safari iOS : Réglages → Safari → Caméra → Autoriser</p>
        </div>
      )}
    </div>
  );
}
