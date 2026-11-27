// 選んだ画像の一覧（小さな画像・ファイル名・大きさと、並べ替え・外すボタン、前の画像の隣に並べるチェックボックス）を作る
// 一覧は、画像を足したり並べ替えたりするたびに、全部作り直す
import type { JoinImage } from './images.ts';
import type { Direction } from './layout.ts';
import { el, formatNumber } from './util.ts';

// ボタンなどが操作されたときに呼ぶ関数。何をするか（画像の並びを変えるなど）は app.ts が決める
export type ImageListActions = {
  move: (id: number, step: -1 | 1) => void; // step: -1 で1つ前へ、1 で1つ後ろへ
  remove: (id: number) => void;
  setBesidePrevious: (id: number, beside: boolean) => void; // 前の画像の隣に並べるかを変える
};

type ButtonAction = 'up' | 'down' | 'remove';

// direction は、チェックボックスの文（前の画像の「右に」か「下に」か）を決めるために使う
export function renderImageList(
  list: HTMLOListElement,
  images: JoinImage[],
  direction: Direction,
  actions: ImageListActions,
): void {
  const items = images.map((image, index) => imageItem(image, index, images.length, direction, actions));
  list.replaceChildren(...items);
}

// 一覧の1行
function imageItem(
  image: JoinImage,
  index: number,
  count: number,
  direction: Direction,
  actions: ImageListActions,
): HTMLLIElement {
  const size = `${formatNumber(image.width)} × ${formatNumber(image.height)}`;
  return el('li', { class: 'image-item', 'data-id': image.id }, [
    // ファイル名を横に書くので、画像の説明（alt）は空にする（読み上げで同じ名前を2回読ませないため）
    el('img', { class: 'thumb', src: image.url, alt: '', decoding: 'async' }),
    el('div', { class: 'image-body' }, [
      el('span', { class: 'image-name', text: image.name, title: image.name }),
      el('div', { class: 'image-controls' }, [
        el('span', { class: 'image-size', text: size }),
        el('div', { class: 'image-buttons' }, [
          el('button', {
            type: 'button',
            class: 'small-button',
            text: '↑',
            'aria-label': `${image.name} を1つ前へ`,
            'data-action': 'up',
            disabled: index === 0,
            onclick: () => actions.move(image.id, -1),
          }),
          el('button', {
            type: 'button',
            class: 'small-button',
            text: '↓',
            'aria-label': `${image.name} を1つ後ろへ`,
            'data-action': 'down',
            disabled: index === count - 1,
            onclick: () => actions.move(image.id, 1),
          }),
          el('button', {
            type: 'button',
            class: 'small-button',
            text: '外す',
            'aria-label': `${image.name} を外す`,
            'data-action': 'remove',
            onclick: () => actions.remove(image.id),
          }),
        ]),
      ]),
      // 先頭の画像には、隣に並べる「前の画像」がないので出さない
      index > 0 ? besideToggle(image, direction, actions) : null,
    ]),
  ]);
}

// 「前の画像の右に並べる」（横に結合のときは「下に」）のチェックボックス
function besideToggle(image: JoinImage, direction: Direction, actions: ImageListActions): HTMLLabelElement {
  const text = direction === 'vertical' ? '前の画像の右に並べる' : '前の画像の下に並べる';
  const checkbox = el('input', {
    type: 'checkbox',
    checked: image.besidePrevious,
    // 見える文はどの行も同じなので、読み上げではファイル名も読む（「外す」ボタンと同じ）
    'aria-label': `${image.name} を${text}`,
  });
  checkbox.addEventListener('change', () => actions.setBesidePrevious(image.id, checkbox.checked));
  return el('label', { class: 'beside-toggle' }, [checkbox, text]);
}

// 並べ替えたあと、動かした画像のボタンにフォーカスを戻す（一覧を作り直すとフォーカスが消えるため。
// キーボードで操作している人が、続けて動かせるようにする）。先頭や最後に着いて押せなくなったら、反対向きのボタンにする
export function focusMoveButton(list: HTMLOListElement, id: number, preferred: 'up' | 'down'): void {
  const item = list.querySelector(`[data-id="${id}"]`);
  if (!item) {
    return;
  }
  const opposite = preferred === 'up' ? 'down' : 'up';
  const button =
    findEnabledButton(item, preferred) ?? findEnabledButton(item, opposite) ?? findEnabledButton(item, 'remove');
  button?.focus();
}

// index 番目の行（なければ1つ前の行）の「外す」ボタンにフォーカスを移す。移せたら true
export function focusRemoveButton(list: HTMLOListElement, index: number): boolean {
  const item = list.children.item(index) ?? list.children.item(index - 1);
  if (!item) {
    return false;
  }
  const button = findEnabledButton(item, 'remove');
  button?.focus();
  return button !== null;
}

function findEnabledButton(item: Element, action: ButtonAction): HTMLButtonElement | null {
  const button = item.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`);
  if (button && !button.disabled) {
    return button;
  }
  return null;
}
