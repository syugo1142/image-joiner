// 画面全体をまとめる。状態（選んだ画像と設定）を持ち、操作があったら状態を変えて、一覧とプレビューを描き直す
import { initFilePicker } from './filePicker.ts';
import { focusMoveButton, focusRemoveButton, renderImageList } from './imageList.ts';
import { loadImageFile, releaseImage, type JoinImage } from './images.ts';
import { calculateLayout, isTooLarge } from './layout.ts';
import { canvasToBlob, downloadBlob, drawJoinedImage, outputFileName } from './render.ts';
import { isSameSettings, loadSettings, saveSettings, type Settings } from './settings.ts';
import { initSettingsForm } from './settingsForm.ts';
import { byId, formatNumber } from './util.ts';

type App = {
  images: JoinImage[]; // 選んだ画像（並べた順）
  settings: Settings; // 結合方法の設定
  previewReady: boolean; // プレビューが描けていて、保存できる状態か
  dom: AppElements;
};

// index.html の要素（findElements が返すものの型）
type AppElements = ReturnType<typeof findElements>;

// 大きすぎて作れないときに、どうすればよいかを添える文
const TOO_LARGE_HINT = '画像の数を減らすか、画像のサイズを「そろえる」にしてみてください。';

export function initApp(): void {
  const app: App = {
    images: [],
    settings: loadSettings(),
    previewReady: false,
    dom: findElements(),
  };

  initFilePicker((files) => addFiles(app, files));
  initSettingsForm(app.settings, (settings) => changeSettings(app, settings));
  app.dom.clearButton.addEventListener('click', () => clearImages(app));
  app.dom.downloadButton.addEventListener('click', () => download(app));
  update(app);
}

function findElements() {
  return {
    fileInput: byId('file-input', HTMLInputElement),
    message: byId('message', HTMLParagraphElement),
    list: byId('image-list', HTMLOListElement),
    clearButton: byId('clear-button', HTMLButtonElement),
    previewNote: byId('preview-note', HTMLParagraphElement),
    previewFrame: byId('preview-frame', HTMLDivElement),
    canvas: byId('preview', HTMLCanvasElement),
    outputSize: byId('output-size', HTMLParagraphElement),
    downloadButton: byId('download-button', HTMLButtonElement),
    saveMessage: byId('save-message', HTMLParagraphElement),
  };
}

// ---------- 画像の追加・並べ替え・外す ----------

async function addFiles(app: App, files: File[]): Promise<void> {
  app.dom.message.textContent = `${files.length}件のファイルを読み込んでいます…`;
  // すべて同時に読み込む。allSettled は成功も失敗も全部待つので、1つが失敗しても、ほかは追加できる
  const results = await Promise.allSettled(files.map(loadImageFile));
  const failedNames: string[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      app.images.push(result.value);
    } else {
      failedNames.push(files[index].name);
    }
  });
  update(app);
  app.dom.message.textContent = addResultMessage(results.length - failedNames.length, failedNames);
}

function addResultMessage(addedCount: number, failedNames: string[]): string {
  const added = addedCount > 0 ? `${addedCount}枚を追加しました。` : '';
  if (failedNames.length === 0) {
    return added;
  }
  return `${added}読み込めなかったファイルがあります（画像でないか、このブラウザが対応していない形式です）: ${failedNames.join('、')}`;
}

function moveImage(app: App, id: number, step: -1 | 1): void {
  const from = app.images.findIndex((image) => image.id === id);
  const to = from + step;
  if (from === -1 || to < 0 || to >= app.images.length) {
    return;
  }
  // 隣の画像と入れ替える
  const moving = app.images[from];
  app.images[from] = app.images[to];
  app.images[to] = moving;
  update(app);
  focusMoveButton(app.dom.list, id, step === -1 ? 'up' : 'down');
}

function removeImage(app: App, id: number): void {
  const index = app.images.findIndex((image) => image.id === id);
  if (index === -1) {
    return;
  }
  releaseImage(app.images[index]);
  app.images.splice(index, 1);
  update(app);
  // 外した行の次（なければ前）の「外す」ボタンへフォーカスを移す。画像がなくなったら、画像を選ぶ欄へ
  if (!focusRemoveButton(app.dom.list, index)) {
    app.dom.fileInput.focus();
  }
}

function clearImages(app: App): void {
  app.images.forEach(releaseImage);
  app.images = [];
  update(app);
  app.dom.message.textContent = 'すべての画像を外しました。';
  app.dom.fileInput.focus();
}

// ---------- 設定 ----------

function changeSettings(app: App, settings: Settings): void {
  // フォームの input と change の両方から呼ばれるので、変わっていなければ描き直さない
  if (isSameSettings(app.settings, settings)) {
    return;
  }
  app.settings = settings;
  saveSettings(settings);
  renderPreview(app);
}

// ---------- 描き直す ----------

// 状態が変わったら、一覧とプレビューを描き直す
function update(app: App): void {
  renderImageList(app.dom.list, app.images, {
    move: (id, step) => moveImage(app, id, step),
    remove: (id) => removeImage(app, id),
  });
  app.dom.clearButton.hidden = app.images.length === 0;
  renderPreview(app);
}

function renderPreview(app: App): void {
  if (app.images.length === 0) {
    showPreviewNote(app, '画像を選ぶと、ここにプレビューが表示されます。');
    return;
  }

  const layout = calculateLayout(app.images, app.settings);
  const sizeText = `${formatNumber(layout.width)} × ${formatNumber(layout.height)} px`;
  if (isTooLarge(layout.width, layout.height)) {
    showPreviewNote(app, `結合後のサイズが ${sizeText} になり、大きすぎて作れません。${TOO_LARGE_HINT}`);
    return;
  }
  if (!drawJoinedImage(app.dom.canvas, app.images, layout, app.settings.background)) {
    showPreviewNote(app, `結合後のサイズが ${sizeText} になり、この端末では大きすぎて作れません。${TOO_LARGE_HINT}`);
    return;
  }

  app.dom.previewNote.hidden = true;
  app.dom.previewFrame.hidden = false;
  app.dom.outputSize.textContent = `結合後のサイズ: ${sizeText}`;
  app.dom.downloadButton.disabled = false;
  app.previewReady = true;
}

// プレビューの代わりに、説明の文を出す（画像がないときや、大きすぎて作れないとき）
function showPreviewNote(app: App, text: string): void {
  const { previewNote, previewFrame, canvas, outputSize, downloadButton } = app.dom;
  previewNote.textContent = text;
  previewNote.hidden = false;
  previewFrame.hidden = true;
  // Canvas の大きさを 0 にして、絵に使っていたメモリを手放す
  canvas.width = 0;
  canvas.height = 0;
  outputSize.textContent = '';
  downloadButton.disabled = true;
  app.previewReady = false;
}

// ---------- 保存 ----------

async function download(app: App): Promise<void> {
  const { canvas, downloadButton, saveMessage } = app.dom;
  const label = downloadButton.textContent;
  // 大きな画像はファイルにするのに時間がかかるので、その間はボタンを押せなくする
  downloadButton.disabled = true;
  downloadButton.textContent = '画像を作っています…';
  try {
    const blob = await canvasToBlob(canvas, app.settings.format);
    const fileName = outputFileName(app.settings.format, new Date());
    downloadBlob(blob, fileName);
    saveMessage.textContent = `${fileName} を作りました。`;
  } catch {
    saveMessage.textContent = '画像ファイルを作れませんでした。画像の数を減らして、もう一度試してください。';
  } finally {
    downloadButton.textContent = label;
    downloadButton.disabled = !app.previewReady;
  }
}
