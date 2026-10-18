import { play, type SoundName } from './catalogue'
import { wake } from './engine'

/**
 * 누르는 자리의 소리.
 *
 * ─── 버튼마다 달지 않는다 ──────────────────────────────
 *  화면이 아홉이고 버튼이 수십 개다. 하나하나에 `onClick`을 덧붙이면
 *  언젠가 빠뜨리고, 언젠가 두 번 달린다.
 *
 *  그래서 **문서에 귀 하나만 둔다.** 눌린 것이 버튼이면 소리가 난다 —
 *  새 버튼을 만들어도 저절로 소리가 붙고, 두 번 날 일이 없다.
 * ───────────────────────────────────────────────────────
 *
 * 어떤 소리를 낼지는 버튼에 `data-sound`로 적는다. 적지 않으면 `ui.tap`이다.
 * `data-sound="none"`이면 소리를 내지 않는다 — 그 버튼이 제 소리를
 * 따로 가지고 있을 때(별을 보내는 버튼처럼) 두 소리가 겹치지 않게.
 *
 * 자판으로 눌러도 똑같이 난다. 브라우저가 Enter/Space를 `click`으로 보내 준다.
 */

let listening: (() => void) | null = null

function soundOf(target: Element): SoundName | 'none' {
  const asked = target.getAttribute('data-sound')
  if (asked === 'none') return 'none'
  if (asked) return asked as SoundName
  return 'ui.tap'
}

export function listenToButtons(): () => void {
  if (listening) return listening
  const doc = globalThis.document
  if (!doc) return () => {}

  const onClick = (event: Event) => {
    const target = event.target as Element | null
    if (!target || typeof target.closest !== 'function') return

    const button = target.closest('button, [role="button"]')
    if (!button) return

    // 꺼져 있는 버튼은 소리를 내지 않는다
    if (button.hasAttribute('disabled')) return
    if (button.getAttribute('aria-disabled') === 'true') return

    /*
     * 사람의 첫 손짓이다. 여기서 소리를 깨운다 —
     * 브라우저는 그전까지 소리를 내지 못하게 막아 둔다.
     */
    wake()

    const name = soundOf(button)
    if (name === 'none') return
    play(name)
  }

  doc.addEventListener('click', onClick, true)

  listening = () => {
    doc.removeEventListener('click', onClick, true)
    listening = null
  }
  return listening
}
