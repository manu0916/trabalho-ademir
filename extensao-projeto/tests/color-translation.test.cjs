const assert = require('node:assert/strict');
const test = require('node:test');
const {
  cleanSourceName,
  translateColorName,
  translateEnglishColorName,
} = require('../color-translation.js');

test('removes supplier color labels before translating', () => {
  assert.equal(cleanSourceName(' 颜色分类： 白蓝 '), '白蓝');
  assert.equal(translateColorName('颜色分类：白蓝'), 'Branco e Azul');
});

test('translates common single, compound and nuanced Chinese colors', () => {
  assert.equal(translateColorName('黑红'), 'Preto e Vermelho');
  assert.equal(translateColorName('米白色'), 'Off-white');
  assert.equal(translateColorName('荧光绿'), 'Verde neon');
  assert.equal(translateColorName('藏青色'), 'Azul-marinho');
  assert.equal(translateColorName('黑色/荧光绿'), 'Preto e Verde neon');
});

test('also normalizes English supplier color names to Portuguese', () => {
  assert.equal(translateEnglishColorName('Navy Blue'), 'Azul-marinho');
  assert.equal(translateColorName('black / white'), 'Preto e Branco');
});

test('uses a stable Portuguese fallback instead of leaking unknown Chinese text', () => {
  assert.equal(translateColorName('神秘款', 4), 'Cor 5');
});
