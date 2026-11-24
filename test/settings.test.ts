// 設定を整える処理（src/settings.ts の normalizeSettings）のテスト。npm test で動かす
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SETTINGS, MAX_GAP, normalizeSettings } from '../src/settings.ts';

test('正しい値は、そのまま使う', () => {
  const settings = { direction: 'horizontal', sizeMode: 'original', gap: 12, background: '#123abc', format: 'jpeg' };
  assert.deepEqual(normalizeSettings(settings), settings);
});

test('オブジェクトでないもの（壊れた保存データなど）は、すべて初期値にする', () => {
  for (const raw of [null, undefined, 'abc', 123, []]) {
    assert.deepEqual(normalizeSettings(raw), DEFAULT_SETTINGS);
  }
});

test('知らない値は、その項目だけ初期値にする', () => {
  const settings = normalizeSettings({ direction: 'diagonal', sizeMode: 'fit', gap: 'abc', background: 'red', format: 'gif' });
  assert.deepEqual(settings, { ...DEFAULT_SETTINGS, sizeMode: 'fit' });
});

test('すき間は 0 から上限までの整数にする（フォームからは文字で来る）', () => {
  const gapOf = (gap: unknown) => normalizeSettings({ gap }).gap;
  assert.equal(gapOf('12'), 12);
  assert.equal(gapOf(12.6), 13);
  assert.equal(gapOf(-5), 0);
  assert.equal(gapOf(99999), MAX_GAP);
  assert.equal(gapOf(''), 0);
  assert.equal(gapOf(Infinity), DEFAULT_SETTINGS.gap);
});

test('背景の色は #rrggbb の小文字にそろえる', () => {
  assert.equal(normalizeSettings({ background: '#FFAA00' }).background, '#ffaa00');
  assert.equal(normalizeSettings({ background: '#fff' }).background, DEFAULT_SETTINGS.background);
});
