import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

const NAV = [
  { to: '/admin', label: 'الرئيسية', end: true },
  { to: '/admin/events', label: 'الفعاليات' },
  { to: '/admin/users', label: 'المستخدمون' },
];

export function AdminLayout() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col bg-navy text-white">
        <div className="border-b border-white/10 px-5 py-4">
          <p className="text-lg font-bold">كرياتيفا <span className="text-accent-orange">RDE</span></p>
          <p className="text-xs text-white/50">لوحة الإدارة</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-primary font-semibold' : 'hover:bg-white/10'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3 text-xs">
          <p className="mb-2 text-white/60">{profile?.full_name}</p>
          <button
            className="rounded-lg px-3 py-1.5 hover:bg-white/10"
            onClick={() => { logout(); navigate('/login'); }}
          >
            تسجيل الخروج
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-surface p-8">
        <Outlet />
      </main>
    </div>
  );
}
