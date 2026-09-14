import React, { ReactNode, useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Settings, LogOut, UserPlus,
  Menu, X, ChevronLeft, BarChart3
} from 'lucide-react';
import { logoutAdmin } from '../api/adminApi';
import { ThemeToggle } from './ThemeToggle';

interface AdminLayoutProps {
  children: ReactNode;
  onLogout: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, onLogout }) => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogoutClick = async () => {
    await logoutAdmin();
    onLogout();
    navigate('/login');
  };

  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) => (
    <NavLink
      to={to}
      end={to === '/admin'}
      onClick={() => setIsMobileMenuOpen(false)}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-semibold text-sm ${
          isActive ? 'nav-item-active' : 'nav-item-idle'
        }`
      }
      style={({ isActive }) =>
        isActive
          ? {
              background: `linear-gradient(135deg, var(--admin-active-bg), transparent)`,
              color: 'var(--admin-active-text)',
              border: '1px solid var(--admin-active-border)',
            }
          : {
              color: 'var(--admin-text-secondary)',
              border: '1px solid transparent',
            }
      }
    >
      <Icon size={20} />
      {!isCollapsed && <span>{label}</span>}
    </NavLink>
  );

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {/* Logo */}
      <div
        className="p-5"
        style={{ borderBottom: '1px solid var(--admin-sidebar-border)' }}
      >
        <Link
          to="/admin"
          className="flex items-center gap-3"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-xl flex items-center justify-center text-slate-900 font-black text-base shadow-lg shadow-amber-400/30 flex-shrink-0">
            TX
          </div>
          {(!isCollapsed || mobile) && (
            <div>
              <span className="font-black text-xl block leading-none" style={{ color: 'var(--admin-text-primary)' }}>
                TaxiPro
              </span>
              <span className="text-xs font-medium" style={{ color: 'var(--admin-text-muted)' }}>
                מרכזיית מוניות
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        <NavItem to="/admin"          icon={LayoutDashboard} label="לוח בקרה" />
        <NavItem to="/analytics"      icon={BarChart3}        label="אנליטיקה וגרפים" />
        <NavItem to="/marketing"      icon={BarChart3}        label="שיווק" />
        <NavItem to="/publish"        icon={BarChart3}        label="פרסום (📣)" />
        <NavItem to="/settings"       icon={Settings}         label="הגדרות" />
        <NavItem to="/manual-add-driver" icon={UserPlus}      label="הוספת נהג" />
      </nav>

      {/* Bottom: Theme toggle + Logout */}
      <div
        className="p-4 space-y-2"
        style={{ borderTop: '1px solid var(--admin-sidebar-border)' }}
      >
        {/* Theme row */}
        {(!isCollapsed || mobile) ? (
          <div
            className="flex items-center justify-between px-4 py-3 rounded-xl"
            style={{ backgroundColor: 'var(--admin-hover)' }}
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--admin-text-secondary)' }}>
              מצב תצוגה
            </span>
            <ThemeToggle />
          </div>
        ) : (
          <div className="flex justify-center">
            <ThemeToggle />
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogoutClick}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all"
          style={{ color: '#F87171' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <LogOut size={18} />
          {(!isCollapsed || mobile) && <span>התנתק</span>}
        </button>
      </div>
    </>
  );

  return (
    <div
      className="flex min-h-screen admin-theme-transition"
      style={{ backgroundColor: 'var(--admin-bg)' }}
      dir="rtl"
    >
      {/* ── Desktop Sidebar ─────────────────── */}
      <aside
        className={`${isCollapsed ? 'w-20' : 'w-64'} hidden md:flex flex-col sticky top-0 h-screen transition-all duration-300`}
        style={{
          backgroundColor: 'var(--admin-sidebar)',
          borderLeft: '1px solid var(--admin-sidebar-border)',
        }}
      >
        <SidebarContent />

        {/* Collapse toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -left-3 top-20 w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{
            backgroundColor: 'var(--admin-panel)',
            border: '1px solid var(--admin-sidebar-border)',
            color: 'var(--admin-text-muted)',
          }}
        >
          <ChevronLeft size={14} className={`transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
        </button>
      </aside>

      {/* ── Mobile Top Header ───────────────── */}
      <div className="md:hidden fixed top-0 w-full z-50 safe-top">
        <div
          className="backdrop-blur-xl flex items-center justify-between px-4 py-3"
          style={{
            backgroundColor: 'var(--admin-mobile-header)',
            borderBottom: '1px solid var(--admin-sidebar-border)',
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-500 rounded-lg flex items-center justify-center text-slate-900 font-black text-sm shadow-md">
              TX
            </div>
            <span className="font-black text-lg" style={{ color: 'var(--admin-text-primary)' }}>
              TaxiPro
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 rounded-xl transition-colors"
              style={{ color: 'var(--admin-text-secondary)' }}
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Drawer ───────────────────── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* Drawer */}
          <aside
            className="absolute top-0 right-0 w-[86vw] max-w-[320px] h-full flex flex-col animate-slide-down shadow-2xl"
            style={{
              backgroundColor: 'var(--admin-sidebar)',
              borderLeft: '1px solid var(--admin-sidebar-border)',
            }}
          >
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-4 left-4 p-2 rounded-xl transition-colors"
              style={{ color: 'var(--admin-text-secondary)' }}
            >
              <X size={20} />
            </button>
            <SidebarContent mobile />
          </aside>
        </div>
      )}

      {/* ── Main Content ────────────────────── */}
      <main
        className="flex-1 overflow-y-auto min-h-screen pt-16 md:pt-0 safe-bottom"
        style={{ color: 'var(--admin-text-primary)' }}
      >
        <div className="container-responsive py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
};
