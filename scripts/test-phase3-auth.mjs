import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import request from 'supertest';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../dist/app.module.js';
import { HttpExceptionFilter } from '../dist/common/filters/http-exception.filter.js';

const url = process.env['SUPABASE_URL'];
const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const anonKey = process.env['SUPABASE_ANON_KEY'];
if (process.env['PHASE3_AUTH_TESTS'] !== '1' || !url || !serviceRoleKey || !anonKey) {
  throw new Error('Set PHASE3_AUTH_TESTS=1 and Supabase connection variables to run live authentication tests.');
}

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
app.useGlobalFilters(new HttpExceptionFilter());
await app.init();
const server = app.getHttpServer();
const createdUserIds = [];
const email = `phase3-${randomUUID()}@example.test`;
const password = `T9!-${randomUUID()}-Password`;

try {
  const invalid = await request(server).post('/auth/register').send({ full_name: '', email: 'bad', password: 'short' });
  assert.equal(invalid.status, 400);
  const clientRole = await request(server).post('/auth/register').send({ full_name: 'Role Test', email, password, role: 'ADMIN' });
  assert.equal(clientRole.status, 400, 'Registration must reject client-supplied role');
  console.log('PASS: invalid registration and client role rejected');

  const registered = await request(server).post('/auth/register').send({ full_name: 'Phase 3 Test', email, password });
  assert.equal(registered.status, 201, `registration status ${registered.status}`);
  const authData = registered.body.data;
  assert.ok(authData.access_token && authData.refresh_token);
  assert.equal(authData.profile.role, 'USER');
  const { data: authUserResult, error: usersError } = await admin.auth.admin.getUserById(authData.profile.id);
  assert.ifError(usersError);
  const authUser = authUserResult.user;
  assert.ok(authUser, 'Auth user should exist');
  createdUserIds.push(authUser.id);
  const { data: profiles, error: profileError } = await admin.from('profiles').select('id,role').eq('id', authUser.id);
  assert.ifError(profileError);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].role, 'USER');
  console.log('PASS: registration created Auth user and exactly one USER profile');

  const duplicate = await request(server).post('/auth/register').send({ full_name: 'Duplicate', email, password });
  assert.equal(duplicate.status, 409);
  const login = await request(server).post('/auth/login').send({ email, password });
  assert.equal(login.status, 200);
  assert.ok(login.body.data.access_token && login.body.data.refresh_token);
  assert.equal(login.body.data.profile.id, authUser.id);
  const badLogin = await request(server).post('/auth/login').send({ email, password: `wrong-${password}` });
  assert.equal(badLogin.status, 401);
  console.log('PASS: duplicate email conflict, valid login, invalid credentials');

  for (const token of [undefined, 'Bearer malformed', 'Bearer eyJhbGciOiJub25lIn0.eyJleHAiOjF9.']) {
    let call = request(server).get('/auth/me');
    if (token) call = call.set('Authorization', token);
    assert.equal((await call).status, 401);
  }
  const me = await request(server).get('/auth/me').set('Authorization', `Bearer ${login.body.data.access_token}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.data.profile.id, authUser.id);
  const logoutWithoutToken = await request(server).post('/auth/logout');
  assert.equal(logoutWithoutToken.status, 401);
  const logout = await request(server).post('/auth/logout').set('Authorization', `Bearer ${login.body.data.access_token}`);
  assert.equal(logout.status, 204);
  const refreshClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const revokedRefresh = await refreshClient.auth.refreshSession({ refresh_token: login.body.data.refresh_token });
  assert.ok(revokedRefresh.error, 'Logout should revoke the refresh token');
  console.log('PASS: /auth/me token validation and logout session revocation');
} finally {
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);
  await app.close();
}
