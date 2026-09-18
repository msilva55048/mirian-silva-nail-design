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

test('19:00 permanece último início e não gera dinâmica posterior', () => {
  const c = context([appointment('19:00', 90)]);
  assert.equal(c.generatedStarts.some((start) => start > 19 * 60), false);
  assert.equal(canServiceUseClientStart(20 * 60 + 30, 30, c), false);
});

test('override público posterior ao último início não entra na grade Cliente', () => {
  const weekday = getClientBookingStartContext(date, [], [
    {override_date: date, start_time: '19:30', is_available: true},
    {override_date: date, start_time: '20:00', is_available: true},
    {override_date: date, start_time: '21:00', is_available: true},
  ]);
  assert.deepEqual(weekday.fixedStarts, [420, 540, 660, 780, 1020, 1140]);
  const saturday = getClientBookingStartContext('2030-01-12', [], [
    {override_date: '2030-01-12', start_time: '13:30', is_available: true},
  ]);
  assert.deepEqual(saturday.fixedStarts, [420, 540, 660, 780]);
});
