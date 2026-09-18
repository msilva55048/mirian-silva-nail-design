import test from 'node:test';
import assert from 'node:assert/strict';

const next = (appointments, now = '2026-09-18T12:00:00') => appointments
  .filter((a) => ['pending', 'confirmed'].includes(a.status) && new Date(`${a.appointment_date}T${a.start_time}:00`) > new Date(now))
  .sort((a, b) => `${a.appointment_date}${a.start_time}`.localeCompare(`${b.appointment_date}${b.start_time}`))[0] ?? null;
const format = (date, time) => {
  const weekdays = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  const d = new Date(`${date}T12:00:00`);
  return `${weekdays[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} às ${time}`;
};

test('seleciona o próximo agendado', () => {
  assert.equal(next([{id: 'a', appointment_date: '2026-09-24', start_time: '09:00', status: 'pending'}]).id, 'a');
});

test('usa confirmation_sent_at como fonte canônica de confirmado', () => {
  const appointment = {id: 'a', appointment_date: '2026-09-24', start_time: '09:00', status: 'pending', confirmation_sent_at: '2026-09-18T10:00:00Z'};
  assert.ok(appointment.confirmation_sent_at);
});

test('ignora cancelados, concluídos e escolhe apenas o mais próximo', () => {
  const appointment = next([
    {id: 'cancelled', appointment_date: '2026-09-19', start_time: '09:00', status: 'cancelled'},
    {id: 'later', appointment_date: '2026-09-25', start_time: '09:00', status: 'pending'},
    {id: 'first', appointment_date: '2026-09-20', start_time: '09:00', status: 'confirmed'},
  ]);
  assert.equal(appointment.id, 'first');
});

test('sem futuro ativo retorna lembrete', () => {
  assert.equal(next([{id: 'done', appointment_date: '2026-09-17', start_time: '09:00', status: 'completed'}]), null);
});

test('formata dia abreviado, data e horário', () => {
  assert.equal(format('2026-09-24', '09:00'), 'qui, 24/09 às 09:00');
});
