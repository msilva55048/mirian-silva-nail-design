import test from 'node:test';
import assert from 'node:assert/strict';

const formatClientAppointmentDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {
  weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
});

test('formata quinta-feira sem deslocamento de timezone', () => {
  assert.equal(formatClientAppointmentDate('2026-10-01'), 'quinta-feira, 01/10/2026');
});

test('formata segunda-feira preservando a data', () => {
  assert.equal(formatClientAppointmentDate('2026-10-05'), 'segunda-feira, 05/10/2026');
});

test('formata sábado e domingo em português', () => {
  assert.equal(formatClientAppointmentDate('2026-10-03'), 'sábado, 03/10/2026');
  assert.equal(formatClientAppointmentDate('2026-10-04'), 'domingo, 04/10/2026');
});

test('o horário continua sendo exibido separadamente', () => {
  const time = '07:00';
  assert.equal(`${formatClientAppointmentDate('2026-10-01')} às ${time}`, 'quinta-feira, 01/10/2026 às 07:00');
});
