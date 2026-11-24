// 設定のフォーム。最初に今の設定を欄に入れ、欄が変わるたびに、新しい設定を onChange に渡す
import { normalizeSettings, type Settings } from './settings.ts';
import { byId } from './util.ts';

export function initSettingsForm(initial: Settings, onChange: (settings: Settings) => void): void {
  const form = byId('settings-form', HTMLFormElement);
  writeForm(form, initial);

  // input は文字を打つたび・選ぶたびに起きる（プレビューをすぐ変えるため）
  form.addEventListener('input', () => onChange(readForm(form)));
  // change は入力が確定したとき（欄から出たときなど）に起きる。整えた値（範囲外の数を直したものなど）を欄に書き戻す
  form.addEventListener('change', () => {
    const settings = readForm(form);
    writeForm(form, settings);
    onChange(settings);
  });
  // 数の欄で Enter を押したときに、フォームが送信されてページが読み直されないようにする
  form.addEventListener('submit', (event) => event.preventDefault());
}

// フォームの欄の値を、設定として読み取る。FormData は、欄の name をキーにして値をまとめてくれる
function readForm(form: HTMLFormElement): Settings {
  const values = Object.fromEntries(new FormData(form));
  return normalizeSettings(values);
}

function writeForm(form: HTMLFormElement, settings: Settings): void {
  setField(form, 'direction', settings.direction);
  setField(form, 'sizeMode', settings.sizeMode);
  setField(form, 'gap', String(settings.gap));
  setField(form, 'background', settings.background);
  setField(form, 'format', settings.format);
}

// name の欄に値を入れる。ラジオボタンのまとまり（RadioNodeList）は、value を入れると、その値のボタンが選ばれる
function setField(form: HTMLFormElement, name: string, value: string): void {
  const field = form.elements.namedItem(name);
  if (!(field instanceof RadioNodeList || field instanceof HTMLInputElement)) {
    throw new Error(`入力欄 ${name} が見つからないか、種類が違います`);
  }
  field.value = value;
}
