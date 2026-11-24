// つなげ方の設定（向き・大きさ・すき間・背景の色・保存する形式）の型と初期値、localStorage への保存
// 画像そのものは保存しない（localStorage は容量が小さく、画像を入れるのに向いていないため）
import type { Direction, SizeMode } from './layout.ts';

export type OutputFormat = 'png' | 'jpeg';

export type Settings = {
  direction: Direction;
  sizeMode: SizeMode;
  gap: number; // 画像と画像の間のすき間（px）
  background: string; // 背景の色（#rrggbb）。すき間や、大きさが違う画像のまわりがこの色になる
  format: OutputFormat;
};

// すき間の上限（px）
export const MAX_GAP = 500;

// キーの名前は、ほかのツールと重ならないようにアプリの名前で始め、保存する形を変えたときのために版（v1）を付ける
const STORAGE_KEY = 'image-joiner-settings-v1';

export const DEFAULT_SETTINGS: Settings = {
  direction: 'vertical',
  sizeMode: 'fit',
  gap: 0,
  background: '#ffffff',
  format: 'png',
};

const DIRECTIONS: readonly Direction[] = ['vertical', 'horizontal'];
const SIZE_MODES: readonly SizeMode[] = ['fit', 'original'];
const FORMATS: readonly OutputFormat[] = ['png', 'jpeg'];

// 外から来た値（保存してあったデータや、フォームの入力）を、正しい設定に整える
// 知らない値や壊れた値は、項目ごとに初期値にする
export function normalizeSettings(raw: unknown): Settings {
  const value = isRecord(raw) ? raw : {};
  return {
    direction: pickOne(value.direction, DIRECTIONS, DEFAULT_SETTINGS.direction),
    sizeMode: pickOne(value.sizeMode, SIZE_MODES, DEFAULT_SETTINGS.sizeMode),
    gap: toGap(value.gap),
    background: toColor(value.background),
    format: pickOne(value.format, FORMATS, DEFAULT_SETTINGS.format),
  };
}

export function isSameSettings(a: Settings, b: Settings): boolean {
  return (
    a.direction === b.direction &&
    a.sizeMode === b.sizeMode &&
    a.gap === b.gap &&
    a.background === b.background &&
    a.format === b.format
  );
}

export function loadSettings(): Settings {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (text === null) {
      return { ...DEFAULT_SETTINGS };
    }
    return normalizeSettings(JSON.parse(text));
  } catch {
    // 保存したデータが JSON として壊れていたり、localStorage が使えなかったりしたときは、初期値で始める
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 保存できなくても（localStorage が使えない設定のブラウザなど）、今開いている画面ではそのまま使えるので、何もしない
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// value が choices のどれかならそれを、違えば fallback を返す
function pickOne<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  const found = choices.find((choice) => choice === value);
  return found ?? fallback;
}

// すき間を 0〜MAX_GAP の整数にする。フォームからは文字（"12"）で、保存データからは数で来る
function toGap(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return DEFAULT_SETTINGS.gap;
  }
  return Math.min(MAX_GAP, Math.max(0, Math.round(n)));
}

// 色を #rrggbb の小文字にする。その形でなければ初期値にする
function toColor(value: unknown): string {
  if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) {
    return value.toLowerCase();
  }
  return DEFAULT_SETTINGS.background;
}
