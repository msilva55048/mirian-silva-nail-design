import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const admin = fs.readFileSync(new URL('../src/features/admin/SharedWaitlist.tsx', import.meta.url), 'utf8');

test('cliente usa RPCs compartilhadas e calendário útil', () => {
  assert.match(app, /create_my_waitlist_request/);
  assert.match(app, /get_my_waitlist_requests/);
  assert.match(app, /cancel_my_waitlist_request/);
  assert.match(app, /ServicePicker/);
  assert.doesNotMatch(app, /clientWaitlistServices\.map\(\(waitlistService, index\)/);
  assert.match(app, /clientWaitlistServices/);
  assert.match(app, /client-month-calendar/);
  assert.match(app, /service-card__button/);
  assert.match(app, /admin-manual-booking__content[\s\S]*<ServicePicker/);
  assert.doesNotMatch(app, /className="admin-manual-booking__service"/);
});

test('Admin usa as mesmas solicitações e RPCs administrativas', () => {
  assert.match(admin, /admin_list_waitlist_requests/);
  assert.match(admin, /admin_create_waitlist_request/);
  assert.match(admin, /admin_cancel_waitlist_request/);
  assert.match(admin, /waiting_list_requests/);
  assert.match(admin, /admin-manual-form/);
  assert.match(admin, /admin-manual-month-calendar/);
});

test('lista antiga permanece somente como legado e nenhum push/claim é criado', () => {
  assert.match(admin, /Registros antigos/);
  assert.doesNotMatch(app + admin, /claim_waitlist_opportunity|client-web-push|notificationclick/);
  assert.match(admin, /selectedClient/);
  assert.match(admin, /CLIENTE SELECIONADA/);
  assert.match(admin, /clearSelectedClient/);
  assert.match(admin, /!selectedClient \?/);
  assert.match(admin, /p_client_id: selectedClient\.id/);
  assert.match(admin, /onPointerDown/);
  assert.match(admin, /shared-waitlist-submit/);
});
