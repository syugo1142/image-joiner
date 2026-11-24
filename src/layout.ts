// 画像を1枚につなげるときの、仕上がりの大きさと、それぞれの画像を置く位置・大きさを計算する
// 画面（DOM）や Canvas を使わない計算だけのファイルなので、Node.js のテスト（test/layout.test.ts）でそのまま確かめられる

// 縦につなげるか、横につなげるか
export type Direction = 'vertical' | 'horizontal';
// fit: 縦なら幅を、横なら高さを、いちばん小さい画像に合わせて縮める / original: 元の大きさのまま
export type SizeMode = 'fit' | 'original';

export type Size = { width: number; height: number };
// 1枚の画像を、仕上がりのどこに（x, y）、どの大きさで（width, height）描くか
export type Placement = { x: number; y: number; width: number; height: number };
// 仕上がりの大きさと、画像ごとの置き方（画像と同じ順番）
export type Layout = { width: number; height: number; placements: Placement[] };

export type LayoutOptions = {
  direction: Direction;
  sizeMode: SizeMode;
  gap: number; // 画像と画像の間のすき間（px）
};

// Canvas で作れる大きさの上限。ブラウザごとに違うので、パソコンの主なブラウザ（Chrome・Edge・Firefox・Safari）の
// どれでも作れる大きさにしている。縦・横それぞれ 32,767px まで、面積は 16,384 × 16,384 まで
export const MAX_SIDE = 32767;
export const MAX_AREA = 16384 * 16384;

export function calculateLayout(sizes: Size[], options: LayoutOptions): Layout {
  if (sizes.length === 0) {
    return { width: 0, height: 0, placements: [] };
  }
  if (options.direction === 'vertical') {
    return layoutVertical(sizes, options);
  }
  return layoutHorizontal(sizes, options);
}

// 仕上がりが大きすぎて、Canvas で作れないかどうか
export function isTooLarge(width: number, height: number): boolean {
  return width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_AREA;
}

// 上から順に積む
function layoutVertical(sizes: Size[], options: LayoutOptions): Layout {
  const widths = sizes.map((size) => size.width);
  // そろえるなら、いちばん狭い画像の幅。元のままなら、いちばん広い画像が入る幅
  const width = options.sizeMode === 'fit' ? Math.min(...widths) : Math.max(...widths);

  let y = 0;
  const placements = sizes.map((size) => {
    const scaled = options.sizeMode === 'fit' ? scaleToWidth(size, width) : size;
    // 幅が足りない画像（元のままのとき）は、左右の真ん中に置く
    const x = Math.floor((width - scaled.width) / 2);
    const placement = { x, y, width: scaled.width, height: scaled.height };
    y += scaled.height + options.gap;
    return placement;
  });

  // 最後の画像のあとには、すき間を入れない
  return { width, height: y - options.gap, placements };
}

// 左から順に並べる（layoutVertical の縦と横を入れ替えたもの）
function layoutHorizontal(sizes: Size[], options: LayoutOptions): Layout {
  const heights = sizes.map((size) => size.height);
  // そろえるなら、いちばん低い画像の高さ。元のままなら、いちばん高い画像が入る高さ
  const height = options.sizeMode === 'fit' ? Math.min(...heights) : Math.max(...heights);

  let x = 0;
  const placements = sizes.map((size) => {
    const scaled = options.sizeMode === 'fit' ? scaleToHeight(size, height) : size;
    // 高さが足りない画像（元のままのとき）は、上下の真ん中に置く
    const y = Math.floor((height - scaled.height) / 2);
    const placement = { x, y, width: scaled.width, height: scaled.height };
    x += scaled.width + options.gap;
    return placement;
  });

  // 最後の画像のあとには、すき間を入れない
  return { width: x - options.gap, height, placements };
}

// 縦横の比を保ったまま、幅を width にする。高さは四捨五入し、1px より小さくしない
function scaleToWidth(size: Size, width: number): Size {
  const height = Math.max(1, Math.round((size.height * width) / size.width));
  return { width, height };
}

// 縦横の比を保ったまま、高さを height にする。幅は四捨五入し、1px より小さくしない
function scaleToHeight(size: Size, height: number): Size {
  const width = Math.max(1, Math.round((size.width * height) / size.height));
  return { width, height };
}
