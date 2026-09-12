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

test('cards do Admin seguem o layout legível da lista da cliente', () => {
  assert.match(admin, /shared-waitlist-request-card/);
  assert.match(admin, /shared-waitlist-request-card__client/);
  assert.match(admin, /Serviço: \{request\.service_name_snapshot\}/);
  assert.match(admin, /Data: \{new Date\(\`\$\{request\.selected_date\}T12:00:00\`\)/);
  assert.match(admin, /Semana:/);
  assert.match(admin, /Na lista de espera/);
  assert.match(admin, /shared-waitlist-request-card__actions/);
  assert.doesNotMatch(admin, /<strong>\{profile\?\.full_name[^<]*<span>\{profile\?\.phone/);
  assert.match(admin, /background:linear-gradient\(135deg,#7c4356,#a95470\)/);
  assert.match(admin, /min-height:44px/);
  assert.match(admin, /align-items:center;justify-content:center/);
  assert.match(admin, /border-radius:10px/);
});

test('seção antiga foi removida e nenhum push/claim é criado', () => {
  assert.doesNotMatch(admin, /Registros antigos|legacyEntries|shared-waitlist-legacy/);
  assert.doesNotMatch(app + admin, /claim_waitlist_opportunity|client-web-push|notificationclick/);
  assert.match(admin, /selectedClient/);
  assert.match(admin, /CLIENTE SELECIONADA/);
  assert.match(admin, /clearSelectedClient/);
  assert.match(admin, /!selectedClient \?/);
  assert.match(admin, /p_client_id: selectedClient\.id/);
  assert.match(admin, /onPointerDown/);
  assert.match(admin, /shared-waitlist-submit/);
});
