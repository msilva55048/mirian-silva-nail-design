import test from 'node:test';
import assert from 'node:assert/strict';

const shouldActivateReferral = ({status, previousStatus, firstAppointment}) =>
  status === 'completed' && previousStatus !== 'completed' && firstAppointment;

test('cadastro, agendamento e confirmação permanecem pendentes', () => {
  for (const status of ['registered', 'pending', 'confirmed', 'cancelled']) {
    assert.equal(shouldActivateReferral({status, previousStatus: null, firstAppointment: true}), false);
  }
});

test('primeiro atendimento concluído valida uma única vez', () => {
  assert.equal(shouldActivateReferral({status: 'completed', previousStatus: 'confirmed', firstAppointment: true}), true);
  assert.equal(shouldActivateReferral({status: 'completed', previousStatus: 'completed', firstAppointment: true}), false);
  assert.equal(shouldActivateReferral({status: 'completed', previousStatus: 'confirmed', firstAppointment: false}), false);
});

test('reagendamento não valida indicação', () => {
  assert.equal(shouldActivateReferral({status: 'confirmed', previousStatus: 'pending', firstAppointment: true}), false);
});
