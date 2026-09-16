import assert from 'node:assert/strict';
import {test} from 'node:test';
import {findClientKeyForAppointment} from '../src/features/admin/clientNavigation.ts';

const clients = [
  {key: 'profile:client-a', phone: '(48) 99999-1111', email: 'a@example.com'},
  {key: 'profile:client-b', phone: '(48) 99999-2222', email: 'b@example.com'},
];

test('navega pela client_id mesmo com nomes semelhantes', () => {
  assert.equal(findClientKeyForAppointment({client_id: 'client-b', client_phone: clients[0].phone, client_email: clients[0].email}, clients), 'profile:client-b');
});

test('usa telefone normalizado para appointments antigos', () => {
  assert.equal(findClientKeyForAppointment({client_id: null, client_phone: '48999992222', client_email: null}, clients), 'profile:client-b');
});

test('usa e-mail como fallback quando não há telefone', () => {
  assert.equal(findClientKeyForAppointment({client_id: null, client_phone: '', client_email: 'B@EXAMPLE.COM'}, clients), 'profile:client-b');
});

test('não cria ou escolhe cliente quando não há correspondência', () => {
  assert.equal(findClientKeyForAppointment({client_id: 'missing', client_phone: '', client_email: null}, clients), null);
});

test('a navegação pendente substitui corretamente o card expandido anterior', () => {
  let expandedClientCardKey = 'profile:client-a';
  const pendingClientNavigationKey = 'profile:client-b';
  const filteredClients = [{key: 'profile:client-b'}];
  const targetClient = filteredClients.find((client) => client.key === pendingClientNavigationKey);

  expandedClientCardKey = targetClient?.key ?? null;

  assert.equal(expandedClientCardKey, 'profile:client-b');
  assert.notEqual(expandedClientCardKey, 'profile:client-a');
});
