import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import type { Event } from '../lib/types';
import { Badge, ErrorState, Loading, Modal, Toast, formatDateTime, STATUS_COLORS, STATUS_LABELS } from '../components/ui';

export function EventDetailsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [toast, setToast] = useState<{ msg: string; kind: 'success' | 'error' } | null>(null);
  const [confirm, setConfirm] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api<{ event: Event }>(`/events/${eventId}`),
  });

  const registerMutation = useMutation({
    mutationFn: () => api('/registrations/pre-register', { method: 'POST', body: { event_id: eventId } }),
    onSuccess: () => {
      setConfirm(false);
      setToast({ msg: 'تم التسجيل بنجاح! يمكنك الآن عرض QR من "تسجيلاتي".', kind: 'success' });
      setTimeout(() => setToast(null), 4000);
    },
    onError: (err) => {
      setConfirm(false);
      const msg = err instanceof ApiRequestError ? err.message : 'فشل التسجيل';
      setToast({ msg, kind: 'error' });
      setTimeout(() => setToast(null), 4000);
    },
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState message="الفعالية غير موجودة" onRetry={refetch} />;
  if (!data) return null;
  const event = data.event;

  const openForRegistration = event.status === 'PUBLISHED' || event.status === 'ONGOING';
  const deadlinePassed = event.registration_deadline && new Date(event.registration_deadline) < new Date();
  const isUser = profile?.role === 'USER';

  return (
    <div>
      {toast && <Toast message={toast.msg} kind={toast.kind} />}

      <div className="card overflow-hidden">
        <div className="bg-navy px-8 py-10 text-white">
          <Badge color={STATUS_COLORS[event.status] ?? 'gray'}>{STATUS_LABELS[event.status] ?? event.status}</Badge>
          <h1 className="mt-3 text-3xl font-bold">{event.title}</h1>
          {event.location && <p className="mt-2 text-white/70">📍 {event.location}</p>}
        </div>
        <div className="grid gap-6 p-8 md:grid-cols-3">
          <div className="md:col-span-2">
            <h2 className="mb-2 font-bold">الوصف</h2>
            <p className="text-navy/70">{event.description ?? 'لا يوجد وصف.'}</p>
          </div>
          <div className="space-y-3 rounded-xl bg-surface p-5">
            <div>
              <p className="text-xs text-navy/50">البداية</p>
              <p className="font-semibold">{formatDateTime(event.starts_at)}</p>
            </div>
            <div>
              <p className="text-xs text-navy/50">النهاية</p>
              <p className="font-semibold">{formatDateTime(event.ends_at)}</p>
            </div>
            <div>
              <p className="text-xs text-navy/50">آخر موعد للتسجيل</p>
              <p className="font-semibold">{formatDateTime(event.registration_deadline)}</p>
            </div>
            <div>
              <p className="text-xs text-navy/50">السعة</p>
              <p className="font-semibold">{event.capacity} مقعد</p>
            </div>

            {isUser && openForRegistration && !deadlinePassed && (
              <button className="btn-primary w-full" onClick={() => setConfirm(true)}>
                التسجيل في الفعالية
              </button>
            )}
            {isUser && deadlinePassed && (
              <p className="rounded-lg bg-red-50 p-2 text-center text-xs text-red-700">انتهى موعد التسجيل</p>
            )}
            {!profile && openForRegistration && !deadlinePassed && (
              <button className="btn-primary w-full" onClick={() => navigate('/login')}>
                سجّل الدخول للتسجيل
              </button>
            )}
            {profile && event.status === 'ONGOING' && (
              <button className="btn-outline w-full" onClick={() => navigate(`/events/${event.id}/qna`)}>
                جلسة الأسئلة والأجوبة
              </button>
            )}
          </div>
        </div>
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="تأكيد التسجيل">
        <p className="mb-5 text-sm text-navy/70">هل تريد التسجيل في «{event.title}»؟</p>
        <div className="flex gap-3">
          <button className="btn-primary flex-1" disabled={registerMutation.isPending} onClick={() => registerMutation.mutate()}>
            {registerMutation.isPending ? 'جارٍ التسجيل…' : 'تأكيد'}
          </button>
          <button className="btn-outline flex-1" onClick={() => setConfirm(false)}>إلغاء</button>
        </div>
      </Modal>
    </div>
  );
}
