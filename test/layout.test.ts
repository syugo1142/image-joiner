// 配置の計算（src/layout.ts）のテスト。npm test で動かす
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateLayout, isTooLarge, MAX_AREA, MAX_SIDE, type LayoutOptions } from '../src/layout.ts';

const verticalFit: LayoutOptions = { direction: 'vertical', sizeMode: 'fit', gap: 0 };

test('画像がないときは、大きさ 0 で何も置かない', () => {
  assert.deepEqual(calculateLayout([], verticalFit), { width: 0, height: 0, placements: [] });
});

test('縦・そろえる: いちばん狭い幅に合わせて縮め、上から順に積む', () => {
  const layout = calculateLayout(
    [
      { width: 400, height: 200 },
      { width: 200, height: 300 },
    ],
    verticalFit,
  );
  assert.deepEqual(layout, {
    width: 200,
    height: 400,
    placements: [
      { x: 0, y: 0, width: 200, height: 100 },
      { x: 0, y: 100, width: 200, height: 300 },
    ],
  });
});

test('縦・元のまま: いちばん広い幅にし、狭い画像は左右の真ん中に置く', () => {
  const layout = calculateLayout(
    [
      { width: 400, height: 200 },
      { width: 201, height: 300 },
    ],
    { direction: 'vertical', sizeMode: 'original', gap: 0 },
  );
  assert.deepEqual(layout, {
    width: 400,
    height: 500,
    placements: [
      { x: 0, y: 0, width: 400, height: 200 },
      // (400 - 201) / 2 = 99.5 は切り捨てて 99
      { x: 99, y: 200, width: 201, height: 300 },
    ],
  });
});

test('横・そろえる: いちばん低い高さに合わせて縮め、左から順に並べる', () => {
  const layout = calculateLayout(
    [
      { width: 400, height: 200 },
      { width: 300, height: 600 },
    ],
    { direction: 'horizontal', sizeMode: 'fit', gap: 0 },
  );
  assert.deepEqual(layout, {
    width: 500,
    height: 200,
    placements: [
      { x: 0, y: 0, width: 400, height: 200 },
      { x: 400, y: 0, width: 100, height: 200 },
    ],
  });
});

test('横・元のまま: いちばん高い高さにし、低い画像は上下の真ん中に置く', () => {
  const layout = calculateLayout(
    [
      { width: 100, height: 300 },
      { width: 100, height: 100 },
    ],
    { direction: 'horizontal', sizeMode: 'original', gap: 0 },
  );
  assert.deepEqual(layout, {
    width: 200,
    height: 300,
    placements: [
      { x: 0, y: 0, width: 100, height: 300 },
      { x: 100, y: 100, width: 100, height: 100 },
    ],
  });
});

test('すき間は画像と画像の間にだけ入り、端には入らない', () => {
  const square = { width: 100, height: 100 };
  const vertical = calculateLayout([square, square, square], { ...verticalFit, gap: 10 });
  assert.equal(vertical.height, 320);
  assert.deepEqual(
    vertical.placements.map((p) => p.y),
    [0, 110, 220],
  );

  const horizontal = calculateLayout([square, square], { direction: 'horizontal', sizeMode: 'fit', gap: 10 });
  assert.equal(horizontal.width, 210);
  assert.deepEqual(
    horizontal.placements.map((p) => p.x),
    [0, 110],
  );
});

test('1枚だけのときは、すき間を入れずにそのままの大きさ', () => {
  const layout = calculateLayout([{ width: 640, height: 480 }], { ...verticalFit, gap: 50 });
  assert.deepEqual(layout, { width: 640, height: 480, placements: [{ x: 0, y: 0, width: 640, height: 480 }] });
});

test('縮めた大きさは四捨五入し、1px より小さくしない', () => {
  const layout = calculateLayout(
    [
      { width: 200, height: 50 },
      { width: 300, height: 100 }, // 100 × 200/300 = 66.66… → 67
      { width: 100000, height: 10 }, // 10 × 200/100000 = 0.02 → 0 だが、1 にする
    ],
    verticalFit,
  );
  assert.deepEqual(
    layout.placements.map((p) => p.height),
    [50, 67, 1],
  );
});

test('大きすぎるかどうか: 縦・横それぞれの上限と、面積の上限', () => {
  assert.equal(isTooLarge(MAX_SIDE, 1), false);
  assert.equal(isTooLarge(MAX_SIDE + 1, 1), true);
  assert.equal(isTooLarge(1, MAX_SIDE + 1), true);
  assert.equal(isTooLarge(16384, 16384), false);
  assert.equal(isTooLarge(16384, 16385), true);
  assert.equal(16384 * 16384, MAX_AREA);
});
