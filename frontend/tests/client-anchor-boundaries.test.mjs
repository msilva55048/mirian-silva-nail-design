import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canServiceUseClientStart, getClientBookingStartContext} from '../src/shared/dynamicSchedule.ts';

const date = '2030-01-07';
const appointment = (startTime, durationMinutes, serviceName = 'Esmaltação') => ({id: startTime, date, startTime, durationMinutes, serviceName, status: 'confirmed'});
const context = (appointments) => getClientBookingStartContext(date, appointments);

test('dinâmico 08:30 aceita reparo e rejeita serviço que invade 09:00', () => {
  const c = context([appointment('07:00', 90)]);
  assert.equal(canServiceUseClientStart(8 * 60 + 30, 30, c), true);
  assert.equal(canServiceUseClientStart(8 * 60 + 30, 90, c), false);
});

test('13:00 é âncora isolada e 15:00-17:00 não gera horários', () => {
  const c = context([appointment('13:00', 90)]);
  assert.equal(canServiceUseClientStart(14 * 60 + 30, 30, c), false);
  assert.equal(c.allStarts.includes(15 * 60), false);
});

test('13:00 aceita apenas esmaltação e alongamento pelo nome normalizado', () => {
  const c = context([]);
  assert.equal(canServiceUseClientStart(780, 90, c, '  Esmaltação futura  '), true);
  assert.equal(canServiceUseClientStart(780, 90, c, 'Alongamento novo'), true);
  assert.equal(canServiceUseClientStart(780, 30, c, 'Reparo de unha'), false);
  assert.equal(canServiceUseClientStart(780, 60, c, 'Manicure'), false);
});

test('nenhum dinâmico é gerado após a âncora 13:00', () => {
  const c = context([appointment('13:00', 90)]);
  assert.deepEqual(c.generatedStarts.filter((start) => start > 780 && start < 1020), []);
  assert.equal(c.allStarts.includes(1020), true);
});

test('janela 19:00 termina em 21:00', () => {
  const c = context([appointment('19:00', 90)]);
  assert.equal(canServiceUseClientStart(20 * 60 + 30, 30, c), true);
  assert.equal(canServiceUseClientStart(20 * 60 + 30, 60, c), false);
});
