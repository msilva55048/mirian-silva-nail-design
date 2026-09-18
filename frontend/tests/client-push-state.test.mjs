import test from 'node:test';
import assert from 'node:assert/strict';

const classify = ({ios, standalone, supported}) =>
  ios && !standalone ? 'ios-home-screen' : supported ? 'normal' : 'unsupported';

test('iOS fora do modo standalone orienta instalação na Tela de Início', () => {
  assert.equal(classify({ios: true, standalone: false, supported: false}), 'ios-home-screen');
});

test('iOS standalone com APIs disponíveis segue o fluxo normal', () => {
  assert.equal(classify({ios: true, standalone: true, supported: true}), 'normal');
});

test('Android e desktop não recebem orientação de iPhone', () => {
  assert.equal(classify({ios: false, standalone: false, supported: true}), 'normal');
  assert.equal(classify({ios: false, standalone: false, supported: false}), 'unsupported');
});
