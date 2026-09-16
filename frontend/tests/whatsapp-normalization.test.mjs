import test from 'node:test';
import assert from 'node:assert/strict';

const ddds = new Set([11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99]);
const normalize = (phone) => {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (![10, 11].includes(digits.length) || !ddds.has(Number(digits.slice(0, 2)))) return null;
  const local = digits.slice(2);
  if (local.length === 8) return /^[6-9]/.test(local) ? `55${digits.slice(0, 2)}9${local}` : `55${digits}`;
  return local.length === 9 && /^[6-9]/.test(local) ? `55${digits}` : null;
};

test('normaliza celular brasileiro com 9 dígitos', () => {
  assert.equal(normalize('(48) 99999-9999'), '5548999999999');
  assert.equal(normalize('48999999999'), '5548999999999');
  assert.equal(normalize('+55 (48) 99999-9999'), '5548999999999');
  assert.equal(normalize('5548999999999'), '5548999999999');
});

test('adiciona 9 somente a celular legado reconhecível', () => {
  assert.equal(normalize('(48) 8888-7777'), '5548988887777');
  assert.equal(normalize('4888887777'), '5548988887777');
  assert.equal(normalize('(48) 3333-2222'), '554833332222');
});

test('rejeita telefone sem DDD ou inválido', () => {
  assert.equal(normalize('99999-9999'), null);
  assert.equal(normalize('abc'), null);
  assert.equal(normalize(''), null);
});
