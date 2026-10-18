import type { SoundName } from './catalogue'

/**
 * 글을 쓰는 소리.
 *
 * **무엇이 소리를 내는가**를 정하는 순수한 셈이다. 소리 없이도 확인할 수 있게
 * 떼어 두었다 — 한글 조합이나 붙여넣기는 눈으로 보고 고치기 어렵다.
 *
 * ─── 지키는 것 ─────────────────────────────────────────
 *  · 사람이 **실제로 자판을 누를 때만** 난다
 *  · 한글 조합 중에도 **한 번 누르면 한 번** (IME는 keydown을 229로 보낸다)
 *  · 지우는 소리는 따로, 더 약하게
 *  · 붙여넣기는 글자 수와 상관없이 **한 번**
 *  · Ctrl/Cmd가 눌린 조합키는 글자가 아니다
 *  · 화살표 · Shift · Tab 같은 것은 글자가 아니다
 *  · 비밀번호 칸에는 아예 달지 않는다
 * ───────────────────────────────────────────────────────
 */

/** 글자가 아닌 키들 */
const SILENT = new Set([
  'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Home', 'End', 'PageUp', 'PageDown', 'Insert',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
  'Dead', 'Unidentified',
])

export interface KeyLike {
  key: string
  /** IME가 조합 중일 때 브라우저가 보내는 값 */
  keyCode?: number
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  isComposing?: boolean
}

/**
 * 이 누름은 어떤 소리인가. 소리가 없으면 null.
 *
 * 한글 조합(IME)에서는 `key`가 `'Process'`이거나 `keyCode`가 229로 온다.
 * **그 한 번이 자판을 한 번 누른 것**이므로 소리도 한 번이다 —
 * `input` 이벤트를 듣고 있으면 조합이 바뀔 때마다 여러 번 울린다.
 */
export function soundForKey(event: KeyLike): SoundName | null {
  // 조합키는 글자가 아니다. Cmd+V는 붙여넣기이지 타자가 아니다.
  if (event.ctrlKey || event.metaKey || event.altKey) return null

  if (event.key === 'Backspace' || event.key === 'Delete') return 'type.back'

  /*
   * 한글을 조합하는 중.
   *
   * **글자가 아닌 키를 거르기 전에 본다.** 어떤 브라우저와 IME는 조합 중에
   * `key`를 `'Unidentified'`로 보낸다 — 그건 `SILENT`에 들어 있으므로,
   * 순서가 바뀌면 한글을 칠 때 소리가 나지 않는다. 실제로 그랬다.
   */
  if (event.key === 'Process' || event.keyCode === 229) return 'type.key'

  if (SILENT.has(event.key)) return null

  // 그 밖에는 글자 하나일 때만
  if (event.key === 'Enter' || event.key === ' ') return 'type.key'
  if ([...event.key].length === 1) return 'type.key'

  return null
}

/** 이 칸에 타자기 소리를 달아도 되는가 */
export function mayListen(element: { type?: string; autocomplete?: string } | null): boolean {
  if (!element) return false
  // 비밀번호 칸에는 절대 달지 않는다
  if (element.type === 'password') return false
  if (typeof element.autocomplete === 'string' && element.autocomplete.includes('password')) {
    return false
  }
  return true
}
