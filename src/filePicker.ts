// 画像を選ぶ方法（ボタンで選ぶ・ドラッグ＆ドロップ）を準備する。選ばれたファイルは onFiles に渡す
import { byId } from './util.ts';

export function initFilePicker(onFiles: (files: File[]) => void): void {
  const input = byId('file-input', HTMLInputElement);
  const dropZone = byId('drop-zone', HTMLLabelElement);

  input.addEventListener('change', () => {
    const files = Array.from(input.files ?? []);
    // 同じファイルをもう一度選んだときも change が起きるように、選んだ内容を空にしておく
    input.value = '';
    if (files.length > 0) {
      onFiles(files);
    }
  });

  // ページのどこにファイルを落としても受け取る
  // （受け取らないと、ブラウザがその画像を開いてしまい、作業中の画面が消えるため）
  document.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) {
      return;
    }
    // 初期の動き（落とせない）を止めると、ここに落とせるようになる
    event.preventDefault();
    dropZone.classList.add('is-dragging');
  });

  document.addEventListener('dragleave', (event) => {
    // ページの外に出たとき（行き先 relatedTarget が null）だけ、目印を消す
    if (event.relatedTarget === null) {
      dropZone.classList.remove('is-dragging');
    }
  });

  document.addEventListener('drop', (event) => {
    if (!hasFiles(event)) {
      return;
    }
    event.preventDefault();
    dropZone.classList.remove('is-dragging');
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length > 0) {
      onFiles(files);
    }
  });
}

// ドラッグしているものにファイルが含まれるか（ページ内の文字などをドラッグしたときは何もしない）
function hasFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false;
}
