import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getAvailableClientStarts} from '../src/features/public/clientAvailability.ts';

const date = '2030-01-07';
const appointment = (startTime) => ({id: 'appointment-1', date, startTime, durationMinutes: 60, status: 'confirmed'});
const block = (startTime, endTime) => ({id: `${startTime}-${endTime}`, date, startTime, endTime});
const override = (startTime, is_available) => ({id: startTime, override_date: date, start_time: startTime, is_available});

function available({appointments = [], blocks = [], overrides = []} = {}) {
  return getAvailableClientStarts(date, 60, appointments, blocks, overrides).map((time) => `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`);
}

test('bloqueio existente remove o horário e sua remoção o devolve', () => {
  assert.equal(available({blocks: [block('09:00', '10:00')]}).includes('09:00'), false);
  assert.equal(available().includes('09:00'), true);
});

test('appointment ativo continua ocupando o horário liberado', () => {
  assert.equal(available({appointments: [appointment('09:00')]}).includes('09:00'), false);
});

test('override false continua removendo o horário', () => {
  assert.equal(available({overrides: [override('09:00', false)]}).includes('09:00'), false);
});

test('bloqueio sobreposto continua removendo o horário', () => {
  assert.equal(available({blocks: [block('08:30', '10:30')]}).includes('09:00'), false);
});

test('último bloqueio removido deixa o horário elegível novamente', () => {
  assert.equal(available({blocks: [block('09:00', '10:00')]}).includes('09:00'), false);
  assert.equal(available({blocks: []}).includes('09:00'), true);
});

test('bloqueios não alteram as âncoras válidas dos demais horários', () => {
  assert.deepEqual(available({blocks: [block('09:00', '10:00')]}).filter((time) => ['07:00', '11:00', '13:00', '17:00', '19:00'].includes(time)), ['07:00', '11:00', '13:00', '17:00', '19:00']);
});
