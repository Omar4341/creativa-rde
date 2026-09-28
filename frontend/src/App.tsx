import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './lib/auth-context';
import { PublicLayout } from './layouts/PublicLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { HomePage } from './pages/HomePage';
import { EventsPage } from './pages/EventsPage';
import { EventDetailsPage } from './pages/EventDetailsPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { MyRegistrationsPage } from './pages/MyRegistrationsPage';
import { QnaPage } from './pages/QnaPage';
import { AdminEventsPage } from './pages/admin/AdminEventsPage';
import { AdminEventPage } from './pages/admin/AdminEventPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { PresenterPage } from './pages/PresenterPage';

function RequireRole({ roles, children }: { roles: Array<'USER' | 'ADMIN' | 'PRESENTER'>; children: ReactNode }) {
  const { profile, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!profile) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!roles.includes(profile.role)) {
    return <Navigate to={profile.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/:eventId" element={<EventDetailsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* USER */}
        <Route element={<PublicLayout />}>
          <Route path="/dashboard" element={<RequireRole roles={['USER', 'ADMIN']}><DashboardPage /></RequireRole>} />
          <Route path="/my-registrations" element={<RequireRole roles={['USER', 'ADMIN']}><MyRegistrationsPage /></RequireRole>} />
          <Route path="/events/:eventId/qna" element={<RequireRole roles={['USER', 'ADMIN']}><QnaPage /></RequireRole>} />
        </Route>

        {/* ADMIN */}
        <Route element={<RequireRole roles={['ADMIN']}><AdminLayout /></RequireRole>}>
          <Route path="/admin" element={<AdminEventsPage />} />
          <Route path="/admin/events" element={<AdminEventsPage />} />
          <Route path="/admin/events/:eventId" element={<AdminEventPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
        </Route>

        {/* PRESENTER — standalone fullscreen */}
        <Route
          path="/presenter/:eventId"
          element={<RequireRole roles={['PRESENTER', 'ADMIN']}><PresenterPage /></RequireRole>}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
