// 計算した配置（layout.ts）のとおりに画像を Canvas に描き、画像ファイルにして保存させる
import type { JoinImage } from './images.ts';
import type { Layout } from './layout.ts';
import type { OutputFormat } from './settings.ts';
import { el } from './util.ts';

// 形式ごとの、ファイルの種類（MIME タイプ）と拡張子
const FILE_TYPES: Record<OutputFormat, { mimeType: string; extension: string }> = {
  png: { mimeType: 'image/png', extension: 'png' },
  jpeg: { mimeType: 'image/jpeg', extension: 'jpg' },
};

// JPEG の画質（0〜1）。ブラウザの初期値と同じ
const JPEG_QUALITY = 0.92;

// 画像を Canvas に描く。描けたら true、Canvas が大きすぎて描けなかったら false
export function drawJoinedImage(
  canvas: HTMLCanvasElement,
  images: JoinImage[],
  layout: Layout,
  background: string,
): boolean {
  canvas.width = layout.width;
  canvas.height = layout.height;
  // willReadFrequently: 下で点を読み取るので、読み取りが速い作り（メモリの上）にしてもらう
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return false;
  }

  // 先に全体を背景の色で塗る。すき間や、大きさが違う画像のまわりがこの色になる
  // （JPEG は透明にできないので、透明な部分のある画像もこの色の上に描く）
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, layout.width, layout.height);
  // 縮めるときに、なるべくきれいに縮める
  ctx.imageSmoothingQuality = 'high';
  images.forEach((image, index) => {
    const place = layout.placements[index];
    ctx.drawImage(image.element, place.x, place.y, place.width, place.height);
  });

  return isPainted(ctx, layout);
}

// 本当に描けたかを確かめる。右下の1点が背景の色で塗られていれば（透明でなければ）描けている
// （iPhone の Safari などは、端末の上限を超える大きさの Canvas を、エラーにせず何も描かないまま残すため）
function isPainted(ctx: CanvasRenderingContext2D, layout: Layout): boolean {
  try {
    const alpha = ctx.getImageData(layout.width - 1, layout.height - 1, 1, 1).data[3];
    return alpha === 255;
  } catch {
    // 読み取れないときも、描けていないものとして扱う
    return false;
  }
}

// Canvas の絵を、画像ファイル（Blob）にする
export function canvasToBlob(canvas: HTMLCanvasElement, format: OutputFormat): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('画像ファイルを作れませんでした'));
        }
      },
      FILE_TYPES[format].mimeType,
      JPEG_QUALITY,
    );
  });
}

// ファイルを保存させる（ダウンロードのリンクを作って押す）
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = el('a', { href: url, download: fileName });
  document.body.append(link);
  link.click();
  link.remove();
  // すぐに URL を手放すと、ブラウザによっては保存が始まる前に使えなくなるので、少し待ってから手放す
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// 保存するファイルの名前。例: joined-20261124-153012.png（日時は端末の時刻）
export function outputFileName(format: OutputFormat, now: Date): string {
  const date = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
  const time = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  return `joined-${date}-${time}.${FILE_TYPES[format].extension}`;
}

// 1桁の数の前に 0 を付けて、2桁にする（3 → "03"）
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
