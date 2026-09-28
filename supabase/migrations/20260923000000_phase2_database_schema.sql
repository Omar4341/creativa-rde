-- Phase 2: Supabase/PostgreSQL schema and integrity rules.
-- Apply with `supabase db push` or the Supabase SQL editor.

CREATE TYPE public.event_status AS ENUM (
  'DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'CANCELLED'
);
CREATE TYPE public.registration_type AS ENUM ('PRE_REGISTERED', 'WALK_IN');
CREATE TYPE public.registration_status AS ENUM ('CONFIRMED', 'CANCELLED', 'WAITLISTED');
CREATE TYPE public.attendance_status AS ENUM ('PENDING', 'PRESENT', 'ABSENT', 'NO_SHOW');
CREATE TYPE public.question_status AS ENUM (
  'QUEUED', 'DISPLAYED', 'ANSWERED', 'ARCHIVED', 'HIDDEN'
);
CREATE TYPE public.audit_action AS ENUM (
  'USER_REGISTERED', 'USER_LOGGED_IN', 'USER_LOGGED_OUT', 'ROLE_ASSIGNED',
  'EVENT_CREATED', 'EVENT_UPDATED', 'EVENT_STATUS_CHANGED', 'EVENT_DELETED',
  'REGISTRATION_CREATED', 'REGISTRATION_CANCELLED', 'WALKIN_REGISTRATION_CREATED',
  'WALKIN_REGISTRATION_FORCED', 'ATTENDANCE_CHECKED_IN',
  'ATTENDANCE_MANUALLY_UPDATED', 'QUESTION_SUBMITTED', 'QUESTION_STATUS_CHANGED',
  'QUESTION_PRESENTED', 'QUESTION_CLEARED', 'QNA_SESSION_ACTIVATED',
  'QNA_SESSION_DEACTIVATED', 'VOTE_CAST', 'VOTE_REMOVED', 'PRESENTER_ASSIGNED',
  'PRESENTER_ASSIGNMENT_REVOKED', 'QR_GENERATED', 'QR_VERIFIED', 'QR_REJECTED'
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN', 'PRESENTER')),
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_role ON public.profiles(role);

CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  description TEXT,
  location TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  registration_deadline TIMESTAMPTZ,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  status public.event_status NOT NULL DEFAULT 'DRAFT',
  banner_url TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ends_after_starts CHECK (ends_at > starts_at),
  CONSTRAINT deadline_before_start CHECK (
    registration_deadline IS NULL OR registration_deadline <= starts_at
  )
);
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_events_starts_at ON public.events(starts_at);
CREATE INDEX idx_events_created_by ON public.events(created_by);

CREATE TABLE public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_email TEXT,
  guest_phone TEXT,
  type public.registration_type NOT NULL,
  status public.registration_status NOT NULL DEFAULT 'CONFIRMED',
  qr_token TEXT UNIQUE,
  qr_expires_at TIMESTAMPTZ,
  registered_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_event UNIQUE (event_id, user_id),
  CONSTRAINT guest_info_required CHECK (
    user_id IS NOT NULL OR (guest_name IS NOT NULL AND guest_email IS NOT NULL)
  ),
  CONSTRAINT pre_registered_has_user CHECK (type <> 'PRE_REGISTERED' OR user_id IS NOT NULL)
);
CREATE INDEX idx_reg_event_id ON public.registrations(event_id);
CREATE INDEX idx_reg_user_id ON public.registrations(user_id);
CREATE INDEX idx_reg_qr_token ON public.registrations(qr_token);
CREATE INDEX idx_reg_status ON public.registrations(status);
CREATE INDEX idx_reg_event_status ON public.registrations(event_id, status);
CREATE INDEX idx_reg_guest_email ON public.registrations(event_id, guest_email);
CREATE INDEX idx_reg_guest_phone ON public.registrations(event_id, guest_phone);

CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL UNIQUE REFERENCES public.registrations(id) ON DELETE CASCADE,
  status public.attendance_status NOT NULL DEFAULT 'PENDING',
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT checkin_time_required CHECK (status <> 'PRESENT' OR checked_in_at IS NOT NULL)
);
CREATE INDEX idx_attendance_registration_id ON public.attendance(registration_id);
CREATE INDEX idx_attendance_status ON public.attendance(status);

CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  asked_by UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 5 AND 500),
  status public.question_status NOT NULL DEFAULT 'QUEUED',
  vote_count INTEGER NOT NULL DEFAULT 0 CHECK (vote_count >= 0),
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_question_event UNIQUE (event_id, id)
);
CREATE INDEX idx_questions_event_id ON public.questions(event_id);
CREATE INDEX idx_questions_status ON public.questions(status);
CREATE INDEX idx_questions_ranking
  ON public.questions(event_id, status, vote_count DESC, created_at ASC);

CREATE TABLE public.question_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_question_vote UNIQUE (question_id, user_id)
);
CREATE INDEX idx_votes_question_id ON public.question_votes(question_id);
CREATE INDEX idx_votes_user_id ON public.question_votes(user_id);

CREATE TABLE public.qna_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  current_question_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_current_question_same_event
    FOREIGN KEY (event_id, current_question_id)
    REFERENCES public.questions(event_id, id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX idx_qna_event_id ON public.qna_sessions(event_id);

CREATE TABLE public.presenter_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  presenter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES public.profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_presenter_event UNIQUE (event_id, presenter_id),
  CONSTRAINT assigned_profile_must_exist CHECK (presenter_id IS NOT NULL)
);
CREATE INDEX idx_presenter_assignments_event ON public.presenter_assignments(event_id);
CREATE INDEX idx_presenter_assignments_presenter ON public.presenter_assignments(presenter_id);
CREATE INDEX idx_presenter_assignments_active
  ON public.presenter_assignments(event_id, presenter_id) WHERE is_active = TRUE;

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action public.audit_action NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_actor_id ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_event_id ON public.audit_logs(event_id);
CREATE INDEX idx_audit_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_action ON public.audit_logs(action);
CREATE INDEX idx_audit_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_actor_event ON public.audit_logs(actor_id, event_id, created_at DESC);

CREATE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profiles', 'events', 'registrations', 'attendance', 'questions',
    'qna_sessions', 'presenter_assignments'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      table_name, table_name
    );
  END LOOP;
END;
$$;

CREATE FUNCTION public.create_attendance_for_confirmed_registration()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status = 'CONFIRMED' THEN
    INSERT INTO public.attendance (registration_id)
    VALUES (NEW.id)
    ON CONFLICT (registration_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_create_attendance_for_confirmed_registration
AFTER INSERT OR UPDATE OF status ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.create_attendance_for_confirmed_registration();

CREATE FUNCTION public.fn_update_vote_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.questions
    SET vote_count = vote_count + 1, updated_at = NOW()
    WHERE id = NEW.question_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.questions
    SET vote_count = GREATEST(vote_count - 1, 0), updated_at = NOW()
    WHERE id = OLD.question_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_vote_count
AFTER INSERT OR DELETE ON public.question_votes
FOR EACH ROW EXECUTE FUNCTION public.fn_update_vote_count();

CREATE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'AUDIT_LOGS_APPEND_ONLY';
END;
$$;
CREATE TRIGGER trg_audit_logs_append_only
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

CREATE FUNCTION public.register_with_capacity(
  p_event_id UUID,
  p_user_id UUID,
  p_type public.registration_type,
  p_guest_name TEXT DEFAULT NULL,
  p_guest_email TEXT DEFAULT NULL,
  p_guest_phone TEXT DEFAULT NULL,
  p_registered_by UUID DEFAULT NULL
)
RETURNS public.registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_count INTEGER;
  v_reg public.registrations%ROWTYPE;
BEGIN
  SELECT * INTO v_event
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND';
  END IF;
  IF v_event.status NOT IN ('PUBLISHED', 'ONGOING') THEN
    RAISE EXCEPTION 'REGISTRATION_EVENT_NOT_AVAILABLE';
  END IF;
  IF p_type = 'PRE_REGISTERED'
     AND v_event.registration_deadline IS NOT NULL
     AND NOW() > v_event.registration_deadline THEN
    RAISE EXCEPTION 'REGISTRATION_DEADLINE_PASSED';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.registrations
  WHERE event_id = p_event_id AND status = 'CONFIRMED';
  IF v_count >= v_event.capacity THEN
    RAISE EXCEPTION 'REGISTRATION_EVENT_FULL';
  END IF;

  INSERT INTO public.registrations (
    event_id, user_id, type, status, guest_name, guest_email, guest_phone, registered_by
  ) VALUES (
    p_event_id, p_user_id, p_type, 'CONFIRMED',
    p_guest_name, p_guest_email, p_guest_phone, p_registered_by
  ) RETURNING * INTO v_reg;
  RETURN v_reg;
END;
$$;
REVOKE ALL ON FUNCTION public.register_with_capacity(
  UUID, UUID, public.registration_type, TEXT, TEXT, TEXT, UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_with_capacity(
  UUID, UUID, public.registration_type, TEXT, TEXT, TEXT, UUID
) TO service_role;

-- RLS is deliberately closed by default. Backend SERVICE_ROLE access bypasses RLS.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qna_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presenter_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.current_profile_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT p.role FROM public.profiles AS p
  WHERE p.id = auth.uid() AND p.is_active = TRUE
$$;
REVOKE ALL ON FUNCTION public.current_profile_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated;

CREATE FUNCTION public.has_active_presenter_assignment(p_event_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    JOIN public.presenter_assignments AS pa ON pa.presenter_id = p.id
    WHERE p.id = auth.uid()
      AND p.role = 'PRESENTER'
      AND p.is_active = TRUE
      AND pa.event_id = p_event_id
      AND pa.is_active = TRUE
  )
$$;
REVOKE ALL ON FUNCTION public.has_active_presenter_assignment(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_active_presenter_assignment(UUID) TO authenticated;

CREATE POLICY profiles_select_self_or_admin ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.current_profile_role() = 'ADMIN');

CREATE POLICY authorized_presenter_or_admin_can_read_qna_sessions ON public.qna_sessions
FOR SELECT TO authenticated
USING (
  public.current_profile_role() = 'ADMIN'
  OR (
    public.current_profile_role() = 'PRESENTER'
    AND public.has_active_presenter_assignment(event_id)
  )
);
GRANT SELECT ON public.qna_sessions TO authenticated;

CREATE POLICY presenter_can_read_active_own_assignments ON public.presenter_assignments
FOR SELECT TO authenticated
USING (
  public.current_profile_role() = 'ADMIN'
  OR (
    presenter_id = auth.uid()
    AND public.current_profile_role() = 'PRESENTER'
    AND is_active = TRUE
  )
);
GRANT SELECT ON public.presenter_assignments TO authenticated;

CREATE POLICY admin_can_read_audit_logs ON public.audit_logs
FOR SELECT TO authenticated
USING (public.current_profile_role() = 'ADMIN');
CREATE POLICY service_role_can_insert_audit_logs ON public.audit_logs
FOR INSERT TO service_role WITH CHECK (TRUE);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT INSERT ON public.audit_logs TO service_role;
REVOKE UPDATE, DELETE ON public.audit_logs FROM anon, authenticated, service_role;

-- qna_sessions is the only Realtime source; its row visibility is enforced by RLS.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'qna_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.qna_sessions;
  END IF;
END;
$$;
