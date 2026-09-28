// Shared API types matching the backend contract.

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: 'USER' | 'ADMIN' | 'PRESENTER';
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  registration_deadline: string | null;
  capacity: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  banner_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Registration {
  id: string;
  event_id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  type: 'PRE_REGISTERED' | 'WALK_IN';
  status: 'CONFIRMED' | 'CANCELLED' | 'WAITLISTED';
  qr_token?: string | null;
  qr_expires_at?: string | null;
  registered_by: string | null;
  created_at: string;
  updated_at: string;
  events?: Pick<Event, 'title' | 'starts_at' | 'ends_at' | 'location' | 'status'>;
}

export interface Attendance {
  id: string;
  registration_id: string;
  status: 'PENDING' | 'PRESENT' | 'ABSENT' | 'NO_SHOW';
  checked_in_at: string | null;
  checked_in_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  registrations?: {
    id: string;
    event_id: string;
    type: string;
    user_id: string | null;
    guest_name: string | null;
    guest_email: string | null;
    events?: { title: string; starts_at: string } | null;
  };
}

export interface Question {
  id: string;
  event_id: string;
  content: string;
  status: 'QUEUED' | 'DISPLAYED' | 'ANSWERED' | 'ARCHIVED' | 'HIDDEN';
  vote_count: number;
  is_anonymous: boolean;
  created_at: string;
  user_has_voted?: boolean;
  asked_by?: string;
  profiles?: { full_name: string; email: string } | null;
}

export interface PresenterState {
  session: { is_active: boolean; updated_at: string | null };
  current_question: { id: string; content: string; created_at: string } | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export interface ApiError {
  success: false;
  error: { code: string; message: string; details?: unknown[] };
}
