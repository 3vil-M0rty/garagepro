import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Package, Tag, ShoppingCart, History,
  Users, QrCode, Menu, X, LogOut, ChevronDown, Wrench, Globe, ArrowLeftRight,
  Settings, BookOpen,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import toast from 'react-hot-toast';

const LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية', flag: '🇲🇦' },
];

export default function Layout() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, logout, refreshToken, isAdmin } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch {}
    logout();
    navigate('/login');
    toast.success(t('auth.logout'));
  };

  const changeLanguage = (code) => {
    i18n.changeLanguage(code);
    setLangOpen(false);
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: t('nav.dashboard'), exact: true },
    { to: '/products', icon: Package, label: t('nav.products') },
    ...(isAdmin() ? [{ to: '/categories', icon: Tag, label: t('nav.categories') }] : []),
    { to: '/sales/new', icon: ShoppingCart, label: t('nav.newSale') },
    { to: '/sales/history', icon: History, label: t('nav.history') },
    { to: '/loans', icon: BookOpen, label: t('nav.loans') },
    { to: '/qr-scanner', icon: QrCode, label: 'QR Scanner' },
    ...(isAdmin() ? [{ to: '/stock/movements', icon: ArrowLeftRight, label: t('nav.stockMovements') }] : []),
    ...(isAdmin() ? [{ to: '/users', icon: Users, label: t('nav.users') }] : []),
    ...(isAdmin() ? [{ to: '/settings', icon: Settings, label: t('nav.settings') }] : []),
  ];

  const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];
  const isRTL = i18n.language === 'ar';

  return (
    <div className={`flex h-screen bg-slate-950 overflow-hidden ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed ${isRTL ? 'right-0' : 'left-0'} top-0 h-full w-64 bg-slate-900 border-${isRTL ? 'l' : 'r'} border-white/5 z-30 transform transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : isRTL ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
          <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/30">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-display font-bold text-white text-lg leading-none">{t('app.name')}</div>
            <div className="text-xs text-slate-500 mt-0.5">v1.0.0</div>
          </div>
          <button className="lg:hidden ms-auto text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/3 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary-600/30 border border-primary-500/30 flex items-center justify-center text-primary-400 font-bold text-sm flex-shrink-0">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-medium text-white truncate">{user?.username}</div>
              <div className="text-xs text-slate-500 truncate">{user?.role === 'admin' ? t('users.admin') : t('users.staff')}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="sidebar-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10">
            <LogOut className="w-4 h-4" />
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 flex flex-col ${isRTL ? 'lg:mr-64' : 'lg:ml-64'} overflow-hidden`}>
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-white/5 flex-shrink-0 relative z-40 overflow-visible">
          <button
            className="lg:hidden text-slate-400 hover:text-white p-1"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex-1 lg:flex-none" />

          {/* Language switcher */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm text-slate-300 border border-white/5"
            >
              <Globe className="w-4 h-4" />
              <span>{currentLang.flag} {currentLang.code.toUpperCase()}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
            </button>
            {langOpen && (
              <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} top-full mt-2 w-44 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-[200] py-1 animate-in`}>
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center gap-2
                      ${i18n.language === lang.code ? 'text-primary-400 font-medium' : 'text-slate-300'}`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

