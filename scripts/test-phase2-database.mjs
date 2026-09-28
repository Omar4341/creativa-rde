import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('.env');

const url = process.env['SUPABASE_URL'];
const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const anonKey = process.env['SUPABASE_ANON_KEY'];

if (process.env['PHASE2_DATABASE_TESTS'] !== '1') {
  throw new Error('Set PHASE2_DATABASE_TESTS=1 to run destructive local database integration tests.');
}
if (!url || !serviceRoleKey || !anonKey) {
  throw new Error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY.');
}
const parsedUrl = new URL(url);
const linkedRefPath = resolve('supabase', '.temp', 'project-ref');
const linkedProjectRef = existsSync(linkedRefPath)
  ? readFileSync(linkedRefPath, 'utf8').trim()
  : null;
const isLocalUrl = ['localhost', '127.0.0.1', '::1'].includes(parsedUrl.hostname);
if (!isLocalUrl && (!linkedProjectRef || parsedUrl.hostname !== `${linkedProjectRef}.supabase.co`)) {
  throw new Error('Remote Phase 2 tests require this repository to be linked and SUPABASE_URL to match its project ref.');
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const suffix = randomUUID();
const users = [];
const events = [];
const password = `phase2-${randomUUID()}-A9!`;

async function createProfile(role) {
  const email = `phase2-${role.toLowerCase()}-${randomUUID()}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(error);
  users.push(data.user.id);
  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id,
    full_name: `Phase 2 ${role}`,
    email,
    role,
  });
  assert.ifError(profileError);
  return { id: data.user.id, email };
}

async function createEvent(createdBy, capacity) {
  const { data, error } = await admin.from('events').insert({
    title: `Phase 2 ${suffix.slice(0, 8)}`,
    starts_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    ends_at: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
    capacity,
    status: 'PUBLISHED',
    created_by: createdBy,
  }).select('id').single();
  assert.ifError(error);
  events.push(data.id);
  return data.id;
}

async function run() {
  const requiredTables = [
    'profiles', 'events', 'registrations', 'attendance', 'questions',
    'question_votes', 'qna_sessions', 'presenter_assignments', 'audit_logs',
  ];
  for (const table of requiredTables) {
    const { error } = await admin.from(table).select('*').limit(0);
    assert.ifError(error, `Missing or inaccessible required table: ${table}`);
  }
  console.log(`PASS: all ${requiredTables.length} required tables exist`);

  const owner = await createProfile('ADMIN');
  const attendee = await createProfile('USER');
  const presenter = await createProfile('PRESENTER');
  const otherPresenter = await createProfile('PRESENTER');
  const capacityEventId = await createEvent(owner.id, 1);
  const attempts = await Promise.all(Array.from({ length: 32 }, (_, index) =>
    admin.rpc('register_with_capacity', {
      p_event_id: capacityEventId,
      p_user_id: null,
      p_type: 'WALK_IN',
      p_guest_name: `Concurrent guest ${index}`,
      p_guest_email: `phase2-${suffix}-${index}@example.test`,
      p_guest_phone: null,
      p_registered_by: owner.id,
    }),
  ));
  const capacitySuccesses = attempts.filter((attempt) => !attempt.error).length;
  assert.equal(capacitySuccesses, 1, 'Capacity=1 must allow exactly one concurrent registration');
  const fullCount = attempts.filter((attempt) => attempt.error?.message.includes('REGISTRATION_EVENT_FULL')).length;
  assert.equal(fullCount, 31, 'All other concurrent calls must be rejected as full');
  console.log('PASS: capacity=1 concurrency (32 concurrent RPC calls, exactly 1 success)');

  const uniquenessEventId = await createEvent(owner.id, 10);
  const registrationArgs = {
    p_event_id: uniquenessEventId,
    p_user_id: attendee.id,
    p_type: 'PRE_REGISTERED',
    p_guest_name: null,
    p_guest_email: null,
    p_guest_phone: null,
    p_registered_by: null,
  };
  const firstRegistration = await admin.rpc('register_with_capacity', registrationArgs);
  assert.ifError(firstRegistration.error);
  const { data: automaticAttendance, error: attendanceError } = await admin
    .from('attendance').select('id').eq('registration_id', firstRegistration.data.id).maybeSingle();
  assert.ifError(attendanceError);
  assert.ok(automaticAttendance, 'Confirmed registration must create its attendance row');
  console.log('PASS: confirmed registration automatically creates attendance');
  const duplicateRegistration = await admin.rpc('register_with_capacity', registrationArgs);
  assert.equal(duplicateRegistration.error?.code, '23505', 'Duplicate event/user registration must violate UNIQUE');
  console.log('PASS: duplicate event/user registration rejected');

  const questionEventId = await createEvent(owner.id, 10);
  const otherEventId = await createEvent(owner.id, 10);
  const { data: question, error: questionError } = await admin.from('questions').insert({
    event_id: questionEventId,
    asked_by: attendee.id,
    content: 'Phase 2 vote constraint question?',
  }).select('id').single();
  assert.ifError(questionError);
  const vote = { question_id: question.id, user_id: attendee.id };
  const firstVote = await admin.from('question_votes').insert(vote);
  assert.ifError(firstVote.error);
  const duplicateVote = await admin.from('question_votes').insert(vote);
  assert.equal(duplicateVote.error?.code, '23505', 'Duplicate user/question vote must violate UNIQUE');
  const { data: countedQuestion, error: countError } = await admin
    .from('questions').select('vote_count').eq('id', question.id).single();
  assert.ifError(countError);
  assert.equal(countedQuestion.vote_count, 1, 'Vote trigger must keep the stored vote count atomic');
  console.log('PASS: duplicate vote rejected and vote_count trigger incremented');

  const { data: otherQuestion, error: otherQuestionError } = await admin.from('questions').insert({
    event_id: otherEventId,
    asked_by: attendee.id,
    content: 'Question from another event?',
  }).select('id').single();
  assert.ifError(otherQuestionError);
  const { data: session, error: sessionError } = await admin.from('qna_sessions').insert({
    event_id: questionEventId,
  }).select('id').single();
  assert.ifError(sessionError);
  const crossEvent = await admin.from('qna_sessions')
    .update({ current_question_id: otherQuestion.id })
    .eq('id', session.id);
  assert.equal(crossEvent.error?.code, '23503', 'Cross-event current_question_id must violate its composite FK');
  console.log('PASS: qna_sessions rejects a current question from another event');

  const assignment = await admin.from('presenter_assignments').insert({
    event_id: questionEventId,
    presenter_id: presenter.id,
    assigned_by: owner.id,
  });
  assert.ifError(assignment.error);
  const createSession = await admin.from('qna_sessions').insert({ event_id: otherEventId });
  assert.ifError(createSession.error);

  for (const [profile, expectedRows, label] of [
    [presenter, 1, 'assigned presenter'],
    [otherPresenter, 0, 'unassigned presenter'],
    [attendee, 0, 'regular user'],
  ]) {
    const client = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInError } = await client.auth.signInWithPassword({
      email: profile.email,
      password,
    });
    assert.ifError(signInError);
    const { data, error } = await client.from('qna_sessions')
      .select('event_id').eq('event_id', questionEventId);
    assert.ifError(error);
    assert.equal(data.length, expectedRows, `${label} qna_sessions visibility mismatch`);
    const { data: assignmentRows, error: assignmentError } = await client
      .from('presenter_assignments').select('event_id').eq('event_id', questionEventId);
    assert.ifError(assignmentError);
    assert.equal(assignmentRows.length, expectedRows, `${label} presenter assignment visibility mismatch`);
    await client.auth.signOut();
  }
  console.log('PASS: qna_sessions and presenter_assignments RLS is assignment-scoped');
}

try {
  await run();
} finally {
  for (const id of events) {
    await admin.from('events').delete().eq('id', id);
  }
  for (const id of users) {
    await admin.auth.admin.deleteUser(id);
  }
}
