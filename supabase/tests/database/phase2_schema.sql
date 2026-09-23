-- Read-only Phase 2 verification. Runs without pgTAP or other extensions.
DO $$
DECLARE
  expected_tables TEXT[] := ARRAY[
    'profiles', 'events', 'registrations', 'attendance', 'questions',
    'question_votes', 'qna_sessions', 'presenter_assignments', 'audit_logs'
  ];
  expected_types TEXT[] := ARRAY[
    'event_status', 'registration_type', 'registration_status',
    'attendance_status', 'question_status', 'audit_action'
  ];
  expected_indexes TEXT[] := ARRAY[
    'idx_profiles_email', 'idx_profiles_role',
    'idx_events_status', 'idx_events_starts_at', 'idx_events_created_by',
    'idx_reg_event_id', 'idx_reg_user_id', 'idx_reg_qr_token', 'idx_reg_status',
    'idx_reg_event_status', 'idx_reg_guest_email', 'idx_reg_guest_phone',
    'idx_attendance_registration_id', 'idx_attendance_status',
    'idx_questions_event_id', 'idx_questions_status', 'idx_questions_ranking',
    'idx_votes_question_id', 'idx_votes_user_id', 'idx_qna_event_id',
    'idx_presenter_assignments_event', 'idx_presenter_assignments_presenter',
    'idx_presenter_assignments_active', 'idx_audit_actor_id', 'idx_audit_event_id',
    'idx_audit_resource', 'idx_audit_action', 'idx_audit_created_at', 'idx_audit_actor_event'
  ];
  expected_primary_keys TEXT[] := ARRAY[
    'profiles_pkey', 'events_pkey', 'registrations_pkey', 'attendance_pkey',
    'questions_pkey', 'question_votes_pkey', 'qna_sessions_pkey',
    'presenter_assignments_pkey', 'audit_logs_pkey'
  ];
  expected_unique_constraints TEXT[] := ARRAY[
    'profiles_email_key', 'registrations_qr_token_key', 'unique_user_event',
    'attendance_registration_id_key', 'unique_question_event',
    'unique_user_question_vote', 'qna_sessions_event_id_key', 'unique_presenter_event'
  ];
  expected_check_constraints TEXT[] := ARRAY[
    'profiles_role_check', 'events_title_check', 'events_capacity_check',
    'ends_after_starts', 'deadline_before_start', 'guest_info_required',
    'pre_registered_has_user', 'checkin_time_required', 'questions_content_check',
    'questions_vote_count_check', 'assigned_profile_must_exist'
  ];
  expected_triggers TEXT[] := ARRAY[
    'trg_profiles_updated_at', 'trg_events_updated_at', 'trg_registrations_updated_at',
    'trg_attendance_updated_at', 'trg_questions_updated_at', 'trg_qna_sessions_updated_at',
    'trg_presenter_assignments_updated_at', 'trg_create_attendance_for_confirmed_registration',
    'trg_vote_count', 'trg_audit_logs_append_only'
  ];
  missing TEXT[];
  foreign_key_count INTEGER;
BEGIN
  SELECT array_agg(t) INTO missing
  FROM unnest(expected_tables) AS t
  WHERE to_regclass(format('public.%I', t)) IS NULL;
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing tables: %', missing; END IF;

  SELECT array_agg(t) INTO missing
  FROM unnest(expected_types) AS t
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_type pt JOIN pg_namespace pn ON pn.oid = pt.typnamespace
    WHERE pn.nspname = 'public' AND pt.typname = t AND pt.typtype = 'e'
  );
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing enum types: %', missing; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'event_status'
    GROUP BY t.typname
    HAVING array_agg(e.enumlabel::TEXT ORDER BY e.enumsortorder) =
      ARRAY['DRAFT','PUBLISHED','ONGOING','COMPLETED','CANCELLED']::TEXT[]
  ) THEN RAISE EXCEPTION 'event_status values differ from Phase 0'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'registration_type'
    GROUP BY t.typname
    HAVING array_agg(e.enumlabel::TEXT ORDER BY e.enumsortorder) = ARRAY['PRE_REGISTERED','WALK_IN']::TEXT[]
  ) THEN RAISE EXCEPTION 'registration_type values differ from Phase 0'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'registration_status'
    GROUP BY t.typname
    HAVING array_agg(e.enumlabel::TEXT ORDER BY e.enumsortorder) = ARRAY['CONFIRMED','CANCELLED','WAITLISTED']::TEXT[]
  ) THEN RAISE EXCEPTION 'registration_status values differ from Phase 0'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'attendance_status'
    GROUP BY t.typname
    HAVING array_agg(e.enumlabel::TEXT ORDER BY e.enumsortorder) = ARRAY['PENDING','PRESENT','ABSENT','NO_SHOW']::TEXT[]
  ) THEN RAISE EXCEPTION 'attendance_status values differ from Phase 0'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'question_status'
    GROUP BY t.typname
    HAVING array_agg(e.enumlabel::TEXT ORDER BY e.enumsortorder) = ARRAY['QUEUED','DISPLAYED','ANSWERED','ARCHIVED','HIDDEN']::TEXT[]
  ) THEN RAISE EXCEPTION 'question_status values differ from Phase 0'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'audit_action'
    GROUP BY t.typname
    HAVING array_agg(e.enumlabel::TEXT ORDER BY e.enumsortorder) = ARRAY[
      'USER_REGISTERED','USER_LOGGED_IN','USER_LOGGED_OUT','ROLE_ASSIGNED',
      'EVENT_CREATED','EVENT_UPDATED','EVENT_STATUS_CHANGED','EVENT_DELETED',
      'REGISTRATION_CREATED','REGISTRATION_CANCELLED','WALKIN_REGISTRATION_CREATED',
      'WALKIN_REGISTRATION_FORCED','ATTENDANCE_CHECKED_IN','ATTENDANCE_MANUALLY_UPDATED',
      'QUESTION_SUBMITTED','QUESTION_STATUS_CHANGED','QUESTION_PRESENTED','QUESTION_CLEARED',
      'QNA_SESSION_ACTIVATED','QNA_SESSION_DEACTIVATED','VOTE_CAST','VOTE_REMOVED',
      'PRESENTER_ASSIGNED','PRESENTER_ASSIGNMENT_REVOKED','QR_GENERATED','QR_VERIFIED','QR_REJECTED'
    ]::TEXT[]
  ) THEN RAISE EXCEPTION 'audit_action values differ from Phase 0'; END IF;

  SELECT array_agg(c) INTO missing
  FROM unnest(expected_primary_keys) AS c
  WHERE NOT EXISTS (SELECT 1 FROM pg_constraint pc WHERE pc.contype = 'p' AND pc.conname = c);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing primary keys: %', missing; END IF;
  SELECT array_agg(c) INTO missing
  FROM unnest(expected_unique_constraints) AS c
  WHERE NOT EXISTS (SELECT 1 FROM pg_constraint pc WHERE pc.contype = 'u' AND pc.conname = c);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing unique constraints: %', missing; END IF;
  SELECT array_agg(c) INTO missing
  FROM unnest(expected_check_constraints) AS c
  WHERE NOT EXISTS (SELECT 1 FROM pg_constraint pc WHERE pc.contype = 'c' AND pc.conname = c);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing check constraints: %', missing; END IF;

  SELECT array_agg(i) INTO missing
  FROM unnest(expected_indexes) AS i
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_indexes pi WHERE pi.schemaname = 'public' AND pi.indexname = i
  );
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing indexes: %', missing; END IF;

  SELECT count(*) INTO foreign_key_count
  FROM pg_constraint c
  JOIN pg_class local_table ON local_table.oid = c.conrelid
  JOIN pg_namespace local_schema ON local_schema.oid = local_table.relnamespace
  JOIN pg_class ref_table ON ref_table.oid = c.confrelid
  JOIN pg_namespace ref_schema ON ref_schema.oid = ref_table.relnamespace
  CROSS JOIN LATERAL (
    SELECT array_agg(a.attname::TEXT ORDER BY k.ordinality) AS names
    FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ordinality)
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
  ) local_columns
  CROSS JOIN LATERAL (
    SELECT array_agg(a.attname::TEXT ORDER BY k.ordinality) AS names
    FROM unnest(c.confkey) WITH ORDINALITY AS k(attnum, ordinality)
    JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum
  ) ref_columns
  WHERE c.contype = 'f'
    AND local_schema.nspname = 'public'
    AND (
      (local_table.relname = 'profiles' AND local_columns.names = ARRAY['id'] AND ref_schema.nspname = 'auth' AND ref_table.relname = 'users' AND ref_columns.names = ARRAY['id']) OR
      (local_table.relname = 'events' AND local_columns.names = ARRAY['created_by'] AND ref_schema.nspname = 'public' AND ref_table.relname = 'profiles' AND ref_columns.names = ARRAY['id']) OR
      (local_table.relname = 'registrations' AND local_columns.names = ARRAY['event_id'] AND ref_schema.nspname = 'public' AND ref_table.relname = 'events' AND ref_columns.names = ARRAY['id']) OR
      (local_table.relname = 'registrations' AND local_columns.names = ARRAY['user_id'] AND ref_schema.nspname = 'public' AND ref_table.relname = 'profiles' AND ref_columns.names = ARRAY['id']) OR
      (local_table.relname = 'registrations' AND local_columns.names = ARRAY['registered_by'] AND ref_schema.nspname = 'public' AND ref_table.relname = 'profiles' AND ref_columns.names = ARRAY['id']) OR
      (local_table.relname = 'attendance' AND local_columns.names = ARRAY['registration_id'] AND ref_schema.nspname = 'public' AND ref_table.relname = 'registrations' AND ref_columns.names = ARRAY['id']) OR
      (local_table.relname = 'attendance' AND local_columns.names = ARRAY['checked_in_by'] AND ref_schema.nspname = 'public' AND ref_table.relname = 'profiles' AND ref_columns.names = ARRAY['id']) OR
      (local_table.relname = 'questions' AND local_columns.names = ARRAY['event_id'] AND ref_schema.nspname = 'public' AND ref_table.relname = 'events' AND ref_columns.names = ARRAY['id']) OR
      (local_table.relname = 'questions' AND local_columns.names = ARRAY['asked_by'] AND ref_schema.nspname = 'public' AND ref_table.relname = 'profiles' AND ref_columns.names = ARRAY['id']) OR
      (local_table.relname = 'question_votes' AND local_columns.names = ARRAY['question_id'] AND ref_schema.nspname = 'public' AND ref_table.relname = 'questions' AND ref_columns.names = ARRAY['id']) OR
      (local_table.relname = 'question_votes' AND local_columns.names = ARRAY['user_id'] AND ref_schema.nspname = 'public' AND ref_table.relname = 'profiles' AND ref_columns.names = ARRAY['id']) OR
      (local_table.relname = 'qna_sessions' AND local_columns.names = ARRAY['event_id'] AND ref_schema.nspname = 'public' AND ref_table.relname = 'events' AND ref_columns.names = ARRAY['id']) OR
      (local_table.relname = 'qna_sessions' AND local_columns.names = ARRAY['event_id','current_question_id'] AND ref_schema.nspname = 'public' AND ref_table.relname = 'questions' AND ref_columns.names = ARRAY['event_id','id']) OR
      (local_table.relname = 'presenter_assignments' AND local_columns.names = ARRAY['event_id'] AND ref_schema.nspname = 'public' AND ref_table.relname = 'events' AND ref_columns.names = ARRAY['id']) OR
      (local_table.relname = 'presenter_assignments' AND local_columns.names = ARRAY['presenter_id'] AND ref_schema.nspname = 'public' AND ref_table.relname = 'profiles' AND ref_columns.names = ARRAY['id']) OR
      (local_table.relname = 'presenter_assignments' AND local_columns.names = ARRAY['assigned_by'] AND ref_schema.nspname = 'public' AND ref_table.relname = 'profiles' AND ref_columns.names = ARRAY['id']) OR
      (local_table.relname = 'audit_logs' AND local_columns.names = ARRAY['actor_id'] AND ref_schema.nspname = 'public' AND ref_table.relname = 'profiles' AND ref_columns.names = ARRAY['id']) OR
      (local_table.relname = 'audit_logs' AND local_columns.names = ARRAY['event_id'] AND ref_schema.nspname = 'public' AND ref_table.relname = 'events' AND ref_columns.names = ARRAY['id'])
    );
  IF foreign_key_count <> 18 THEN RAISE EXCEPTION 'Expected 18 approved foreign keys, found %', foreign_key_count; END IF;

  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY(expected_tables) AND c.relrowsecurity) <> 9
  THEN RAISE EXCEPTION 'RLS is not enabled on all nine Phase 2 tables'; END IF;

  SELECT array_agg(p) INTO missing
  FROM unnest(ARRAY[
    'profiles_select_self_or_admin', 'authorized_presenter_or_admin_can_read_qna_sessions',
    'presenter_can_read_active_own_assignments', 'admin_can_read_audit_logs',
    'service_role_can_insert_audit_logs'
  ]) AS p
  WHERE NOT EXISTS (SELECT 1 FROM pg_policies pp WHERE pp.schemaname = 'public' AND pp.policyname = p);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing RLS policies: %', missing; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = 'public.register_with_capacity(uuid,uuid,public.registration_type,text,text,text,uuid)'::regprocedure
      AND prosecdef
      AND proconfig @> ARRAY['search_path=public, pg_temp']
      AND pg_get_functiondef(oid) LIKE '%FOR UPDATE%'
  ) THEN RAISE EXCEPTION 'Capacity RPC missing SECURITY DEFINER, pinned search_path, or FOR UPDATE'; END IF;
  IF has_function_privilege('anon', 'public.register_with_capacity(uuid,uuid,public.registration_type,text,text,text,uuid)', 'EXECUTE')
  THEN RAISE EXCEPTION 'anon can execute register_with_capacity'; END IF;
  IF has_function_privilege('authenticated', 'public.register_with_capacity(uuid,uuid,public.registration_type,text,text,text,uuid)', 'EXECUTE')
  THEN RAISE EXCEPTION 'authenticated can execute register_with_capacity'; END IF;
  IF NOT has_function_privilege('service_role', 'public.register_with_capacity(uuid,uuid,public.registration_type,text,text,text,uuid)', 'EXECUTE')
  THEN RAISE EXCEPTION 'service_role cannot execute register_with_capacity'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
    WHERE p.oid = 'public.register_with_capacity(uuid,uuid,public.registration_type,text,text,text,uuid)'::regprocedure
      AND acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
  ) THEN RAISE EXCEPTION 'PUBLIC can execute register_with_capacity'; END IF;

  SELECT array_agg(t) INTO missing
  FROM unnest(expected_triggers) AS t
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_trigger tr
    JOIN pg_class c ON c.oid = tr.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND tr.tgname = t AND NOT tr.tgisinternal
  );
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing triggers: %', missing; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'qna_sessions'
  ) THEN RAISE EXCEPTION 'qna_sessions is not in the Supabase Realtime publication'; END IF;
END;
$$;

SELECT jsonb_build_object(
  'status', 'PASS',
  'tables', (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY(ARRAY[
    'profiles','events','registrations','attendance','questions','question_votes','qna_sessions','presenter_assignments','audit_logs'
  ])),
  'enums', (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype = 'e' AND t.typname = ANY(ARRAY[
    'event_status','registration_type','registration_status','attendance_status','question_status','audit_action'
  ])),
  'secondary_indexes', (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%'),
  'primary_keys', (SELECT count(*) FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public' AND c.contype = 'p' AND t.relname = ANY(ARRAY[
    'profiles','events','registrations','attendance','questions','question_votes','qna_sessions','presenter_assignments','audit_logs'
  ])),
  'unique_constraints', (SELECT count(*) FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public' AND c.contype = 'u' AND t.relname = ANY(ARRAY[
    'profiles','events','registrations','attendance','questions','question_votes','qna_sessions','presenter_assignments','audit_logs'
  ])),
  'check_constraints', (SELECT count(*) FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public' AND c.contype = 'c' AND t.relname = ANY(ARRAY[
    'profiles','events','registrations','attendance','questions','question_votes','qna_sessions','presenter_assignments','audit_logs'
  ])),
  'foreign_keys', (SELECT count(*) FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public' AND c.contype = 'f'),
  'rls_enabled_tables', (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ANY(ARRAY[
    'profiles','events','registrations','attendance','questions','question_votes','qna_sessions','presenter_assignments','audit_logs'
  ]) AND c.relrowsecurity),
  'rls_policies', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'),
  'realtime_qna_sessions', EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='qna_sessions')
) AS phase2_schema_verification;
