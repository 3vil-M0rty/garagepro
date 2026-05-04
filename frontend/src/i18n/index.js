import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';
import ar from './locales/ar.json';

const savedLang = localStorage.getItem('garage_lang') || 'fr';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      ar: { translation: ar },
    },
    lng: savedLang,
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
  });

// Set document direction based on language
const setDocDirection = (lang) => {
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
};

setDocDirection(savedLang);

i18n.on('languageChanged', (lang) => {
  localStorage.setItem('garage_lang', lang);
  setDocDirection(lang);
});

export default i18n;
