import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Event } from '../lib/types';
import { EmptyState, ErrorState, Loading } from '../components/ui';
import { EventCard } from './HomePage';

export function EventsPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['events', search],
    queryFn: () => api<{ events: Event[] }>('/events', { query: { search, limit: 50 } }),
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">الفعاليات</h1>
        <input
          className="input max-w-xs"
          placeholder="ابحث عن فعالية…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="بحث"
        />
      </div>
      {isLoading && <Loading />}
      {error && <ErrorState message="تعذر تحميل الفعاليات" onRetry={refetch} />}
      {data && (data.events.length === 0
        ? <EmptyState title="لا توجد فعاليات مطابقة" subtitle="جرّب كلمة بحث مختلفة" />
        : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.events.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        ))}
    </div>
  );
}
