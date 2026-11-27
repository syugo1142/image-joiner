// 画像を1枚に結合するときの、結合後のサイズと、それぞれの画像を置く位置・大きさを計算する
// 画面（DOM）や Canvas を使わない計算だけのファイルなので、Node.js のテスト（test/layout.test.ts）でそのまま確かめられる
//
// 画像は「まとまり」に分けて並べる。縦に結合なら、まとまりは左から右へ並べた1つの段で、段を上から順に積む。
// 横に結合なら、まとまりは上から下へ積んだ1つの列で、列を左から順に並べる。
// 「前の画像の隣に並べる」（besidePrevious）を選んでいない画像は、1枚で1つのまとまりになる

// 縦に結合するか、横に結合するか
export type Direction = 'vertical' | 'horizontal';
// fit: 端がそろうように大きい画像を縮める（拡大はしない） / original: 元の大きさのまま
export type SizeMode = 'fit' | 'original';

export type Size = { width: number; height: number };
// 配置を計算する画像。besidePrevious が true なら、前の画像と同じまとまり（縦に結合なら段、横に結合なら列）に並べる。
// 省略したときと、先頭の画像は、新しいまとまりを始める
export type LayoutItem = Size & { besidePrevious?: boolean };
// 1枚の画像を、結合後の画像のどこに（x, y）、どの大きさで（width, height）描くか
export type Placement = { x: number; y: number; width: number; height: number };
// 結合後のサイズと、画像ごとの置き方（画像と同じ順番）
export type Layout = { width: number; height: number; placements: Placement[] };

export type LayoutOptions = {
  direction: Direction;
  sizeMode: SizeMode;
  gap: number; // 画像と画像の間の余白（px）。段の中の画像の間にも、段と段の間にも入れる
};

// Canvas で作れる大きさの上限。ブラウザごとに違うので、パソコンの主なブラウザ（Chrome・Edge・Firefox・Safari）の
// どれでも作れる大きさにしている。縦・横それぞれ 32,767px まで、面積は 16,384 × 16,384 まで
export const MAX_SIDE = 32767;
export const MAX_AREA = 16384 * 16384;

export function calculateLayout(items: LayoutItem[], options: LayoutOptions): Layout {
  if (items.length === 0) {
    return { width: 0, height: 0, placements: [] };
  }
  const groups = splitIntoGroups(items);
  if (options.direction === 'vertical') {
    return layoutVertical(groups, options);
  }
  return layoutHorizontal(groups, options);
}

// 結合後の画像が大きすぎて、Canvas で作れないかどうか
export function isTooLarge(width: number, height: number): boolean {
  return width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_AREA;
}

// 画像を、まとまりごとに分ける。先頭の画像と、besidePrevious でない画像が、新しいまとまりを始める
function splitIntoGroups(items: LayoutItem[]): Size[][] {
  const groups: Size[][] = [];
  items.forEach((item, index) => {
    const size = { width: item.width, height: item.height };
    if (index > 0 && item.besidePrevious) {
      groups[groups.length - 1].push(size);
    } else {
      groups.push([size]);
    }
  });
  return groups;
}

// ---------- 縦に結合: 段を上から順に積む ----------

function layoutVertical(rows: Size[][], options: LayoutOptions): Layout {
  const { gap } = options;
  let sizedRows = rows;
  if (options.sizeMode === 'fit') {
    // 同じ段の画像は、いちばん低い画像に高さをそろえる
    sizedRows = rows.map(fitHeights);
    // 段どうしは、いちばん幅の狭い段に合わせて、ほかの段を縮める
    const narrowest = Math.min(...sizedRows.map((row) => rowWidth(row, gap)));
    sizedRows = sizedRows.map((row) => shrinkRowToWidth(row, narrowest, gap));
  }

  // 結合後の幅は、いちばん広い段の幅（そろえるときは、どの段も同じ幅になる）
  const width = Math.max(...sizedRows.map((row) => rowWidth(row, gap)));
  const placements: Placement[] = [];
  let y = 0;
  for (const row of sizedRows) {
    const rowHeight = Math.max(...row.map((size) => size.height));
    // 幅が足りない段（元のままのとき）は、左右の真ん中に置く
    const x = Math.floor((width - rowWidth(row, gap)) / 2);
    placements.push(...placeRow(row, x, y, rowHeight, gap));
    y += rowHeight + gap;
  }
  // 最後の段のあとには、余白を入れない
  return { width, height: y - gap, placements };
}

// 段の幅（画像の幅の合計と、画像の間の余白）
function rowWidth(row: Size[], gap: number): number {
  return sum(row.map((size) => size.width)) + gap * (row.length - 1);
}

// 同じ段の画像の高さを、いちばん低い画像に合わせて縮める
function fitHeights(row: Size[]): Size[] {
  const height = Math.min(...row.map((size) => size.height));
  return row.map((size) => scaleToHeight(size, height));
}

// 段を、幅が width になるまで縮める。画像の間の余白の幅は変えずに、画像だけを同じ割合で縮める
function shrinkRowToWidth(row: Size[], width: number, gap: number): Size[] {
  const gaps = gap * (row.length - 1);
  const imagesWidth = rowWidth(row, gap) - gaps; // 今の、画像の幅の合計
  // 縮めたあとの、画像の幅の合計。余白が広すぎて足りないときも、画像は 1 枚 1px 以上残す
  const targetWidth = Math.max(width - gaps, row.length);
  if (imagesWidth <= targetWidth) {
    return row;
  }
  const widths = shrinkLengths(
    row.map((size) => size.width),
    targetWidth,
  );
  return row.map((size, index) => ({
    width: widths[index],
    height: Math.max(1, Math.round((size.height * targetWidth) / imagesWidth)),
  }));
}

// 1つの段の画像を、(x, y) から右へ並べる。高さが足りない画像（元のままのとき）は、段の中で上下の真ん中に置く
function placeRow(row: Size[], x: number, y: number, rowHeight: number, gap: number): Placement[] {
  let left = x;
  return row.map((size) => {
    const top = y + Math.floor((rowHeight - size.height) / 2);
    const placement = { x: left, y: top, width: size.width, height: size.height };
    left += size.width + gap;
    return placement;
  });
}

// ---------- 横に結合: 列を左から順に並べる（縦に結合の、縦と横を入れ替えたもの） ----------

function layoutHorizontal(columns: Size[][], options: LayoutOptions): Layout {
  const { gap } = options;
  let sizedColumns = columns;
  if (options.sizeMode === 'fit') {
    // 同じ列の画像は、いちばん狭い画像に幅をそろえる
    sizedColumns = columns.map(fitWidths);
    // 列どうしは、いちばん高さの低い列に合わせて、ほかの列を縮める
    const shortest = Math.min(...sizedColumns.map((column) => columnHeight(column, gap)));
    sizedColumns = sizedColumns.map((column) => shrinkColumnToHeight(column, shortest, gap));
  }

  // 結合後の高さは、いちばん高い列の高さ（そろえるときは、どの列も同じ高さになる）
  const height = Math.max(...sizedColumns.map((column) => columnHeight(column, gap)));
  const placements: Placement[] = [];
  let x = 0;
  for (const column of sizedColumns) {
    const columnWidth = Math.max(...column.map((size) => size.width));
    // 高さが足りない列（元のままのとき）は、上下の真ん中に置く
    const y = Math.floor((height - columnHeight(column, gap)) / 2);
    placements.push(...placeColumn(column, x, y, columnWidth, gap));
    x += columnWidth + gap;
  }
  // 最後の列のあとには、余白を入れない
  return { width: x - gap, height, placements };
}

// 列の高さ（画像の高さの合計と、画像の間の余白）
function columnHeight(column: Size[], gap: number): number {
  return sum(column.map((size) => size.height)) + gap * (column.length - 1);
}

// 同じ列の画像の幅を、いちばん狭い画像に合わせて縮める
function fitWidths(column: Size[]): Size[] {
  const width = Math.min(...column.map((size) => size.width));
  return column.map((size) => scaleToWidth(size, width));
}

// 列を、高さが height になるまで縮める。画像の間の余白の高さは変えずに、画像だけを同じ割合で縮める
function shrinkColumnToHeight(column: Size[], height: number, gap: number): Size[] {
  const gaps = gap * (column.length - 1);
  const imagesHeight = columnHeight(column, gap) - gaps; // 今の、画像の高さの合計
  // 縮めたあとの、画像の高さの合計。余白が広すぎて足りないときも、画像は 1 枚 1px 以上残す
  const targetHeight = Math.max(height - gaps, column.length);
  if (imagesHeight <= targetHeight) {
    return column;
  }
  const heights = shrinkLengths(
    column.map((size) => size.height),
    targetHeight,
  );
  return column.map((size, index) => ({
    width: Math.max(1, Math.round((size.width * targetHeight) / imagesHeight)),
    height: heights[index],
  }));
}

// 1つの列の画像を、(x, y) から下へ積む。幅が足りない画像（元のままのとき）は、列の中で左右の真ん中に置く
function placeColumn(column: Size[], x: number, y: number, columnWidth: number, gap: number): Placement[] {
  let top = y;
  return column.map((size) => {
    const left = x + Math.floor((columnWidth - size.width) / 2);
    const placement = { x: left, y: top, width: size.width, height: size.height };
    top += size.height + gap;
    return placement;
  });
}

// ---------- 共通 ----------

// 長さの並びを、比を保ったまま、合計が total になるように縮める。
// 1つずつ四捨五入すると、合計が total から数 px ずれて段の端がそろわないので、
// 先頭からの長さの合計（画像と画像の境目の位置）を四捨五入し、となりの境目との差をそれぞれの長さにする
function shrinkLengths(lengths: number[], total: number): number[] {
  const current = sum(lengths);
  let before = 0; // ここまでの長さの合計（縮める前）
  return lengths.map((length) => {
    const start = Math.round((before * total) / current);
    before += length;
    const end = Math.round((before * total) / current);
    return Math.max(1, end - start);
  });
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

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
