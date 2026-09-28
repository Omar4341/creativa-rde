import type { ReactNode } from 'react';

// ── Status / feedback ──────────────────────────────────────────────────────

export function Loading({ text = 'جارٍ التحميل…' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-navy/50" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-navy/20 py-14 text-center">
      <p className="font-semibold text-navy">{title}</p>
      {subtitle && <p className="text-sm text-navy/60">{subtitle}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-red-50 py-12 text-center" role="alert">
      <p className="font-semibold text-red-700">{message}</p>
      {onRetry && (
        <button className="btn-outline" onClick={onRetry}>إعادة المحاولة</button>
      )}
    </div>
  );
}

export function Toast({ message, kind = 'info' }: { message: string; kind?: 'info' | 'error' | 'success' }) {
  const colors = {
    info: 'bg-navy text-white',
    error: 'bg-red-600 text-white',
    success: 'bg-green-600 text-white',
  } as const;
  return (
    <div className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-5 py-3 text-sm font-medium shadow-lg ${colors[kind]}`} role="status">
      {message}
    </div>
  );
}

// ── Primitives ─────────────────────────────────────────────────────────────

export function Badge({ children, color = 'gray' }: { children: ReactNode; color?: 'gray' | 'blue' | 'green' | 'orange' | 'purple' | 'red' }) {
  const colors = {
    gray: 'bg-navy/10 text-navy/70',
    blue: 'bg-primary/10 text-primary',
    green: 'bg-green-100 text-green-700',
    orange: 'bg-accent-orange/15 text-yellow-700',
    purple: 'bg-accent-purple/10 text-accent-purple',
    red: 'bg-red-100 text-red-700',
  } as const;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[color]}`}>{children}</span>;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button className="text-navy/40 hover:text-navy" onClick={onClose} aria-label="إغلاق">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'مسودة', PUBLISHED: 'منشور', ONGOING: 'جارٍ الآن', COMPLETED: 'منتهي', CANCELLED: 'ملغي',
  CONFIRMED: 'مؤكد', CANCELLED_REG: 'ملغي', WAITLISTED: 'قائمة انتظار',
  PRE_REGISTERED: 'تسجيل مسبق', WALK_IN: 'حضور مباشر',
  PENDING: 'بالانتظار', PRESENT: 'حاضر', ABSENT: 'غائب', NO_SHOW: 'لم يحضر',
  QUEUED: 'في الانتظار', DISPLAYED: 'معروض', ANSWERED: 'تمت الإجابة', ARCHIVED: 'مؤرشف', HIDDEN: 'مخفي',
  USER: 'مستخدم', ADMIN: 'مسؤول', PRESENTER: 'مقدم',
};

export const STATUS_COLORS: Record<string, 'gray' | 'blue' | 'green' | 'orange' | 'purple' | 'red'> = {
  DRAFT: 'gray', PUBLISHED: 'green', ONGOING: 'orange', COMPLETED: 'blue', CANCELLED: 'red',
  CONFIRMED: 'green', WAITLISTED: 'orange',
  PENDING: 'gray', PRESENT: 'green', ABSENT: 'red', NO_SHOW: 'red',
  QUEUED: 'blue', DISPLAYED: 'orange', ANSWERED: 'green', ARCHIVED: 'gray', HIDDEN: 'red',
  USER: 'gray', ADMIN: 'purple', PRESENTER: 'blue',
};

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ar-EG', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}
