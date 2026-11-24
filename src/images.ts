// 選ばれたファイルを、画像として読み込む

export type JoinImage = {
  id: number; // 並べ替えや外すときに、どの画像かを見分ける番号
  name: string; // ファイル名（一覧に表示する）
  url: string; // ファイルを指す一時的な URL（一覧の小さな画像と、Canvas に描く画像の読み込みに使う）
  element: HTMLImageElement; // 読み込んだ画像。Canvas に描くときに使う
  width: number; // 画像の幅（px）
  height: number; // 画像の高さ（px）
};

// 次に読み込む画像に付ける番号
let nextId = 1;

// ファイルを画像として読み込む。画像でないファイルや、ブラウザが対応していない形式なら失敗する
export async function loadImageFile(file: File): Promise<JoinImage> {
  // ファイルの中身をコピーせずに、そのファイルを指す URL（blob:...）を作る。画像はサーバーに送らない
  const url = URL.createObjectURL(file);
  try {
    const element = await loadImage(url);
    // スマホの写真に入っている向きの情報（EXIF）は、ブラウザが反映してから幅と高さを返す
    const width = element.naturalWidth;
    const height = element.naturalHeight;
    if (width === 0 || height === 0) {
      throw new Error('大きさが分からない画像です');
    }
    return { id: nextId++, name: file.name, url, element, width, height };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

// 外した画像の URL を手放す（手放さないと、ページを閉じるまでファイルの中身がメモリに残る）
export function releaseImage(image: JoinImage): void {
  URL.revokeObjectURL(image.url);
}

// <img> に URL を入れ、読み込みが終わるのを待つ
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像を読み込めませんでした'));
    img.src = url;
  });
}
