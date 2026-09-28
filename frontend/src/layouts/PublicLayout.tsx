import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import type { Profile } from '../lib/types';

export function PublicLayout() {
  const { profile, loading, logout } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="bg-navy text-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <NavLink to="/" className="text-xl font-bold">
            كرياتيفا <span className="text-accent-orange">RDE</span>
          </NavLink>
          <div className="flex items-center gap-2 text-sm">
            <NavLink to="/events" className={({ isActive }) => `rounded-lg px-3 py-1.5 ${isActive ? 'bg-white/15' : 'hover:bg-white/10'}`}>
              الفعاليات
            </NavLink>
            {loading ? null : profile ? <AuthedLinks profile={profile} onLogout={logout} /> : <GuestLinks />}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="py-8 text-center text-sm text-navy/40">كرياتيفا RDE — نظام إدارة التسجيل والحضور</footer>
    </div>
  );
}

function GuestLinks() {
  return (
    <>
      <NavLink to="/login" className="rounded-lg px-3 py-1.5 hover:bg-white/10">تسجيل الدخول</NavLink>
      <NavLink to="/register" className="rounded-lg bg-accent-orange px-3 py-1.5 font-semibold text-navy hover:bg-accent-orange/90">
        حساب جديد
      </NavLink>
    </>
  );
}

function AuthedLinks({ profile, onLogout }: { profile: Profile; onLogout: () => void }) {
  const home = profile.role === 'ADMIN' ? '/admin' : '/dashboard';
  return (
    <>
      <NavLink to={home} className="rounded-lg px-3 py-1.5 hover:bg-white/10">
        {profile.role === 'ADMIN' ? 'لوحة الإدارة' : 'لوحتي'}
      </NavLink>
      <button onClick={onLogout} className="rounded-lg px-3 py-1.5 hover:bg-white/10">خروج</button>
    </>
  );
}
