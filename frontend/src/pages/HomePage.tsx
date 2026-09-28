import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Event } from '../lib/types';
import { Badge, EmptyState, ErrorState, Loading, formatDate, STATUS_COLORS, STATUS_LABELS } from '../components/ui';

export function HomePage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['events', 'home'],
    queryFn: () => api<{ events: Event[] }>('/events', { query: { limit: 3 } }),
  });

  return (
    <div>
      {/* Hero */}
      <section className="mb-12 rounded-2xl bg-navy px-8 py-16 text-center text-white">
        <h1 className="mb-4 text-4xl font-bold">اكتشف الفعاليات وسجّل حضورك</h1>
        <p className="mx-auto mb-8 max-w-xl text-white/70">
          منصة كرياتيفا لإدارة الفعاليات — تصفح الفعاليات، سجّل بضغطة واحدة، واحضر بـ QR سريع
        </p>
        <div className="flex justify-center gap-3">
          <Link to="/events" className="btn bg-accent-orange font-bold text-navy hover:bg-accent-orange/90">
            تصفح الفعاليات
          </Link>
          <Link to="/register" className="btn border border-white/30 text-white hover:bg-white/10">
            إنشاء حساب
          </Link>
        </div>
      </section>

      {/* Featured events */}
      <h2 className="mb-4 text-2xl font-bold">أحدث الفعاليات</h2>
      {isLoading && <Loading />}
      {error && <ErrorState message="تعذر تحميل الفعاليات" onRetry={refetch} />}
      {data && (data.events.length === 0
        ? <EmptyState title="لا توجد فعاليات منشورة حاليًا" subtitle="عد لاحقًا للاطلاع على الجديد" />
        : (
          <div className="grid gap-4 md:grid-cols-3">
            {data.events.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        ))}
    </div>
  );
}

export function EventCard({ event }: { event: Event }) {
  return (
    <Link to={`/events/${event.id}`} className="card block p-5 transition hover:border-primary/40 hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <Badge color={STATUS_COLORS[event.status] ?? 'gray'}>{STATUS_LABELS[event.status] ?? event.status}</Badge>
        <span className="text-xs text-navy/50">{formatDate(event.starts_at)}</span>
      </div>
      <h3 className="mb-2 text-lg font-bold text-navy">{event.title}</h3>
      {event.location && <p className="mb-3 text-sm text-navy/60">📍 {event.location}</p>}
      {event.description && <p className="line-clamp-2 text-sm text-navy/70">{event.description}</p>}
    </Link>
  );
}
