import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('área autenticada oferece os quatro destinos da cliente', () => {
  for (const label of ['Perfil', 'Agendamentos', 'Indicação', 'Lista de espera']) assert.match(source, new RegExp(label));
  assert.match(source, /clientAccountSection/);
});

test('histórico carrega todos os status e prioriza compromisso futuro ativo', () => {
  assert.doesNotMatch(source, /appointment\.status === "pending" \|\| appointment\.status === "confirmed"\)\n\s*\)\n\s*\.sort/);
  assert.match(source, /aActive = \(a\.status === "pending" \|\| a\.status === "confirmed"\)/);
  assert.match(source, /status === "completed"\) return "Realizado"/);
  assert.match(source, /status === "no-show"\) return "Não compareceu"/);
});

test('perfil, logout e indicação reutilizam os fluxos existentes', () => {
  assert.match(source, /get_my_client_profile/);
  assert.match(source, /update_my_client_profile/);
  assert.match(source, /logoutClient/);
  assert.match(source, /get_my_referral_summary/);
  assert.match(source, /register_my_referral/);
});

test('lista de espera compartilhada usa RPCs autenticadas e preserva o legado', () => {
  assert.match(source, /create_my_waitlist_request/);
  assert.match(source, /get_my_waitlist_requests/);
  assert.match(source, /waiting_list_requests/);
  assert.match(source, /Lista antiga \(legado\)/);
});
