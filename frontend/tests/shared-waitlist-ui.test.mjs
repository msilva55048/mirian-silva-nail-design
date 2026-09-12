import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const admin = fs.readFileSync(new URL('../src/features/admin/SharedWaitlist.tsx', import.meta.url), 'utf8');

test('cliente usa RPCs compartilhadas e calendário útil', () => {
  assert.match(app, /create_my_waitlist_request/);
  assert.match(app, /get_my_waitlist_requests/);
  assert.match(app, /cancel_my_waitlist_request/);
  assert.match(app, /day === 0 \|\| day === 6/);
  assert.match(app, /clientWaitlistServices/);
});

test('Admin usa as mesmas solicitações e RPCs administrativas', () => {
  assert.match(admin, /admin_list_waitlist_requests/);
  assert.match(admin, /admin_create_waitlist_request/);
  assert.match(admin, /admin_cancel_waitlist_request/);
  assert.match(admin, /waiting_list_requests/);
});

test('lista antiga permanece somente como legado e nenhum push/claim é criado', () => {
  assert.match(app, /Lista antiga \(legado\)/);
  assert.doesNotMatch(app + admin, /claim_waitlist_opportunity|client-web-push|notificationclick/);
});
