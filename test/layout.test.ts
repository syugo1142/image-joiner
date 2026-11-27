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

// ---------- 前の画像の隣に並べる（縦に結合なら段、横に結合なら列） ----------

test('縦・そろえる: 隣に並べた画像は同じ段に入り、段どうしは幅がそろう', () => {
  // 1段目に1枚、2段目に2枚。2段目の2枚は高さが同じで、合わせた幅が1段目と同じ
  const layout = calculateLayout(
    [
      { width: 800, height: 400 },
      { width: 460, height: 370 },
      { width: 340, height: 370, besidePrevious: true },
    ],
    verticalFit,
  );
  assert.deepEqual(layout, {
    width: 800,
    height: 770,
    placements: [
      { x: 0, y: 0, width: 800, height: 400 },
      { x: 0, y: 400, width: 460, height: 370 },
      { x: 460, y: 400, width: 340, height: 370 },
    ],
  });
});

test('縦・そろえる: 同じ段の画像は、いちばん低い画像に高さをそろえる', () => {
  const layout = calculateLayout(
    [
      { width: 400, height: 400 },
      { width: 300, height: 200, besidePrevious: true },
    ],
    verticalFit,
  );
  assert.deepEqual(layout.placements, [
    { x: 0, y: 0, width: 200, height: 200 },
    { x: 200, y: 0, width: 300, height: 200 },
  ]);
});

test('縦・そろえる: 広い段は、余白の幅を変えずに、画像だけを縮める', () => {
  const layout = calculateLayout(
    [
      { width: 1000, height: 500 },
      { width: 600, height: 300 },
      { width: 600, height: 300, besidePrevious: true },
    ],
    { ...verticalFit, gap: 20 },
  );
  // 2段目は 600 + 20 + 600 = 1220 で広いので、画像の幅の合計を 1000 - 20 = 980 に縮める
  assert.deepEqual(layout, {
    width: 1000,
    height: 765,
    placements: [
      { x: 0, y: 0, width: 1000, height: 500 },
      { x: 0, y: 520, width: 490, height: 245 },
      { x: 510, y: 520, width: 490, height: 245 },
    ],
  });
});

test('縦・そろえる: 狭い段があれば、ほかの段をその幅まで縮める（拡大はしない）', () => {
  const layout = calculateLayout(
    [
      { width: 1000, height: 500 },
      { width: 400, height: 200 },
      { width: 200, height: 200, besidePrevious: true },
    ],
    verticalFit,
  );
  assert.deepEqual(layout, {
    width: 600,
    height: 500,
    placements: [
      { x: 0, y: 0, width: 600, height: 300 },
      { x: 0, y: 300, width: 400, height: 200 },
      { x: 400, y: 300, width: 200, height: 200 },
    ],
  });
});

test('段を縮めても、段の右端がそろう（1枚ずつ四捨五入して幅がずれることがない）', () => {
  const layout = calculateLayout(
    [
      { width: 500, height: 100 },
      { width: 333, height: 100 },
      { width: 333, height: 100, besidePrevious: true },
      { width: 334, height: 100, besidePrevious: true },
    ],
    verticalFit,
  );
  // 1枚ずつ半分にして四捨五入すると 167 + 167 + 167 = 501 になり、1px はみ出す
  assert.deepEqual(
    layout.placements.slice(1).map((p) => p.width),
    [167, 166, 167],
  );
  const last = layout.placements[3];
  assert.equal(layout.width, 500);
  assert.equal(last.x + last.width, layout.width);
});

test('縦・元のまま: 段の中では上下の真ん中、段どうしは左右の真ん中に置く', () => {
  const layout = calculateLayout(
    [
      { width: 500, height: 100 },
      { width: 200, height: 100 },
      { width: 100, height: 50, besidePrevious: true },
    ],
    { direction: 'vertical', sizeMode: 'original', gap: 10 },
  );
  assert.deepEqual(layout, {
    width: 500,
    height: 210,
    placements: [
      { x: 0, y: 0, width: 500, height: 100 },
      // 2段目の幅は 200 + 10 + 100 = 310。(500 - 310) / 2 = 95
      { x: 95, y: 110, width: 200, height: 100 },
      // 段の高さ 100 の中で、(100 - 50) / 2 = 25 下げる
      { x: 305, y: 135, width: 100, height: 50 },
    ],
  });
});

test('横・そろえる: 下に並べた画像は同じ列に入り、列どうしは高さがそろう', () => {
  const layout = calculateLayout(
    [
      { width: 400, height: 800 },
      { width: 300, height: 370 },
      { width: 300, height: 430, besidePrevious: true },
    ],
    { direction: 'horizontal', sizeMode: 'fit', gap: 0 },
  );
  assert.deepEqual(layout, {
    width: 700,
    height: 800,
    placements: [
      { x: 0, y: 0, width: 400, height: 800 },
      { x: 400, y: 0, width: 300, height: 370 },
      { x: 400, y: 370, width: 300, height: 430 },
    ],
  });
});

test('横・そろえる: 高い列は、余白の高さを変えずに、画像だけを縮める', () => {
  const layout = calculateLayout(
    [
      { width: 500, height: 1000 },
      { width: 300, height: 600 },
      { width: 300, height: 600, besidePrevious: true },
    ],
    { direction: 'horizontal', sizeMode: 'fit', gap: 20 },
  );
  // 2列目は 600 + 20 + 600 = 1220 で高いので、画像の高さの合計を 1000 - 20 = 980 に縮める
  assert.deepEqual(layout, {
    width: 765,
    height: 1000,
    placements: [
      { x: 0, y: 0, width: 500, height: 1000 },
      { x: 520, y: 0, width: 245, height: 490 },
      { x: 520, y: 510, width: 245, height: 490 },
    ],
  });
});

test('横・元のまま: 列の中では左右の真ん中、列どうしは上下の真ん中に置く', () => {
  const layout = calculateLayout(
    [
      { width: 100, height: 500 },
      { width: 100, height: 200 },
      { width: 50, height: 100, besidePrevious: true },
    ],
    { direction: 'horizontal', sizeMode: 'original', gap: 10 },
  );
  assert.deepEqual(layout, {
    width: 210,
    height: 500,
    placements: [
      { x: 0, y: 0, width: 100, height: 500 },
      // 2列目の高さは 200 + 10 + 100 = 310。(500 - 310) / 2 = 95
      { x: 110, y: 95, width: 100, height: 200 },
      // 列の幅 100 の中で、(100 - 50) / 2 = 25 右へずらす
      { x: 135, y: 305, width: 50, height: 100 },
    ],
  });
});

test('先頭の画像の「前の画像の隣に並べる」は使わない', () => {
  const square = { width: 100, height: 100 };
  const layout = calculateLayout([{ ...square, besidePrevious: true }, square], verticalFit);
  assert.deepEqual(layout, calculateLayout([square, square], verticalFit));
  assert.equal(layout.height, 200);
});

test('余白が広すぎて段を縮めきれなくても、画像は 1px 以上で、結合後の画像からはみ出さない', () => {
  const layout = calculateLayout(
    [
      { width: 10, height: 10 },
      { width: 10, height: 10 },
      { width: 10, height: 10, besidePrevious: true },
    ],
    { ...verticalFit, gap: 100 },
  );
  for (const p of layout.placements) {
    assert.ok(p.width >= 1 && p.height >= 1);
    assert.ok(p.x >= 0 && p.y >= 0);
    assert.ok(p.x + p.width <= layout.width && p.y + p.height <= layout.height);
  }
});

test('大きすぎるかどうか: 縦・横それぞれの上限と、面積の上限', () => {
  assert.equal(isTooLarge(MAX_SIDE, 1), false);
  assert.equal(isTooLarge(MAX_SIDE + 1, 1), true);
  assert.equal(isTooLarge(1, MAX_SIDE + 1), true);
  assert.equal(isTooLarge(16384, 16384), false);
  assert.equal(isTooLarge(16384, 16385), true);
  assert.equal(16384 * 16384, MAX_AREA);
});
