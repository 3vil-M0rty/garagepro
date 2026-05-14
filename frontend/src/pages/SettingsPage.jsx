import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Globe, Building2, Phone, MapPin, Image, Upload, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية', flag: '🇲🇦' },
];

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState({
    garage_name: '',
    garage_address: '',
    garage_phone: '',
    garage_logo_url: '',
    garage_ice: '',
    garage_rc: '',
    default_language: 'fr',
    quote_validity_days: '30',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      if (data.success) setForm(prev => ({ ...prev, ...data.data }));
    }).catch(() => toast.error(t('errors.serverError'))).finally(() => setLoading(false));
  }, []);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings', form);
      toast.success(t('settings.saved'));
      // Apply language if changed
      if (form.default_language !== i18n.language) {
        i18n.changeLanguage(form.default_language);
      }
    } catch {
      toast.error(t('errors.serverError'));
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('settings.title')}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{t('app.tagline')}</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          <Save className="w-4 h-4" />
          {saving ? t('common.loading') : t('settings.save')}
        </button>
      </div>

      {/* Garage Info */}
      <section className="card space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-white/5">
          <Building2 className="w-5 h-5 text-primary-400" />
          <h2 className="text-white font-semibold">{t('settings.garageInfo')}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">{t('settings.garageName')}</label>
            <input className="input-field" value={form.garage_name} onChange={e => set('garage_name', e.target.value)} placeholder="GaragePro" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">{t('settings.garagePhone')}</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input className="input-field pl-9" value={form.garage_phone} onChange={e => set('garage_phone', e.target.value)} placeholder="+212 6XX XXX XXX" />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-slate-400 mb-1.5">{t('settings.garageAddress')}</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              <textarea className="input-field pl-9 resize-none" rows={2} value={form.garage_address} onChange={e => set('garage_address', e.target.value)} placeholder="Rue, Ville, Maroc" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">{t('settings.garageIce')}</label>
            <input className="input-field" value={form.garage_ice} onChange={e => set('garage_ice', e.target.value)} placeholder="ICE 000000000000000" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">{t('settings.garageRc')}</label>
            <input className="input-field" value={form.garage_rc} onChange={e => set('garage_rc', e.target.value)} placeholder="RC 12345" />
          </div>
        </div>
      </section>

      {/* Logo */}
      <section className="card space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-white/5">
          <Image className="w-5 h-5 text-primary-400" />
          <h2 className="text-white font-semibold">{t('settings.garageLogo')}</h2>
        </div>

        {/* Logo preview */}
        {form.garage_logo_url && (
          <div className="flex justify-center">
            <img
              src={form.garage_logo_url}
              alt="Logo preview"
              className="h-20 object-contain rounded-lg border border-white/10 bg-white/5 p-2"
              onError={e => { e.target.style.display = 'none'; }}
            />
          </div>
        )}

        <div>
          <label className="block text-sm text-slate-400 mb-1.5">{t('settings.logoUrl')}</label>
          <input
            className="input-field"
            value={form.garage_logo_url}
            onChange={e => set('garage_logo_url', e.target.value)}
            placeholder={t('settings.logoUrlPlaceholder')}
            type="url"
          />
        </div>

        {/* Upload button — disabled as requested */}
        <div>
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-slate-600 bg-slate-800/50 cursor-not-allowed text-sm select-none"
            title={t('settings.uploadDisabled')}
          >
            <Upload className="w-4 h-4" />
            {t('settings.uploadLogo')}
            <span className="text-xs text-slate-600 ml-1">({t('settings.uploadDisabled')})</span>
          </button>
          <p className="text-xs text-slate-600 mt-1">{t('products.uploadDisabled')}</p>
        </div>
      </section>

      {/* Quote settings */}
      <section className="card space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-white/5">
          <FileText className="w-5 h-5 text-primary-400" />
          <h2 className="text-white font-semibold">{t('sales.devis')}</h2>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">{t('settings.quoteValidity')}</label>
          <input
            type="number" min="1" max="365"
            className="input-field w-32"
            value={form.quote_validity_days}
            onChange={e => set('quote_validity_days', e.target.value)}
          />
        </div>
      </section>

      {/* Language */}
      <section className="card space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-white/5">
          <Globe className="w-5 h-5 text-primary-400" />
          <h2 className="text-white font-semibold">{t('settings.language')}</h2>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-2">{t('settings.defaultLanguage')}</label>
          <div className="flex gap-2 flex-wrap">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => set('default_language', lang.code)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all text-sm font-medium
                  ${form.default_language === lang.code
                    ? 'border-primary-500 bg-primary-600/20 text-primary-300'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Save button bottom */}
      <div className="flex justify-end pb-4">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          <Save className="w-4 h-4" />
          {saving ? t('common.loading') : t('settings.save')}
        </button>
      </div>
    </div>
  );
}
