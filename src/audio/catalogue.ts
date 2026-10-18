import { sfxAllowed } from './engine'
import { rustle, shimmer, swell, tap, tone } from './voices'

/**
 * 이름 붙은 소리들.
 *
 * 화면은 **이름만 부른다**(`play('ui.tap')`). 그 소리가 어떻게 만들어지는지,
 * 얼마나 큰지, 얼마나 자주 날 수 있는지는 전부 여기에 있다.
 * 전시장에서 "조금 작게"라는 말을 들었을 때 고칠 곳이 한 군데여야 한다.
 */

export type SoundName =
  /** 누르는 자리 — 짧고 부드럽게 */
  | 'ui.tap'
  /** 고르는 자리 — 마음, 간직/흘려보내기 */
  | 'ui.choose'
  /** 물러나는 자리 — 이전, 닫기, 취소 */
  | 'ui.back'
  /** 건너가는 자리 — 다음 걸음으로 */
  | 'ui.forward'
  /** 별 하나가 우리의 우주에 닿았다 */
  | 'star.born'
  /** 열 개가 흩어지며 펼쳐진다 */
  | 'view.open'
  /** 별 하나가 가운데로 온다 */
  | 'view.center'
  /** 그 사람의 시간이 떠오른다 */
  | 'view.tell'
  /** 화면이 바뀐다 */
  | 'scene'
  /** 영수증이 펼쳐진다 */
  | 'receipt.open'
  /** 글자 하나 */
  | 'type.key'
  /** 글자를 지운다 */
  | 'type.back'
  /** 붙여넣는다 — 글자 수와 상관없이 한 번 */
  | 'type.paste'

/**
 * 너무 자주 나지 않게.
 *
 * 소리마다 **최소 간격**이 있다. 빠르게 두드려도 그 간격 안에서는
 * 한 번만 난다 — 겹치면 시끄러워지고, 시끄러우면 이 하늘이 아니다.
 */
const GAP: Record<SoundName, number> = {
  'ui.tap': 60,
  'ui.choose': 60,
  'ui.back': 60,
  'ui.forward': 60,
  'star.born': 400,
  'view.open': 900,
  'view.center': 500,
  'view.tell': 500,
  scene: 260,
  // 펼쳐지는 데 0.9초가 걸린다. 그 안에 두 번 날 일이 없다.
  'receipt.open': 800,
  'type.key': 26,
  'type.back': 34,
  'type.paste': 220,
}

const lastAt = new Map<SoundName, number>()

/** 지금 울리고 있는 소리의 수. 한꺼번에 너무 많으면 뭉개진다. */
let voices = 0
const MAX_VOICES = 14

function allow(name: SoundName): boolean {
  if (!sfxAllowed()) return false

  const at = Date.now()
  const was = lastAt.get(name) ?? 0
  if (at - was < GAP[name]) return false
  lastAt.set(name, at)

  if (voices >= MAX_VOICES) return false
  voices += 1
  // 가장 긴 소리도 4초면 끝난다. 그 뒤에 자리를 돌려준다.
  globalThis.setTimeout(() => {
    voices = Math.max(0, voices - 1)
  }, 4000)

  return true
}

/**
 * 소리 하나를 낸다.
 *
 * 소리가 꺼져 있거나, 브라우저가 아직 허락하지 않았거나, 너무 빨리
 * 되풀이되면 **아무 일도 일어나지 않는다.** 부르는 쪽은 신경 쓰지 않아도 된다.
 */
export function play(name: SoundName): void {
  if (!allow(name)) return

  switch (name) {
    /*
     * 누르는 자리.
     *
     * 다 같은 큰 클릭음을 두지 않는다. 넷이 같은 결이되 조금씩 다르다 —
     * 고르는 일은 조금 맑게, 물러나는 일은 조금 낮게, 건너가는 일은 조금 위로.
     */
    case 'ui.tap':
      tone({ freq: 880, wave: 'sine', attack: 0.004, decay: 0.16, gain: 0.05, cutoff: 3200, send: 0.22 })
      break

    case 'ui.choose':
      tone({ freq: 1046.5, wave: 'sine', attack: 0.004, decay: 0.3, gain: 0.055, cutoff: 4200, send: 0.4 })
      tone({ freq: 1568, wave: 'sine', delay: 0.035, attack: 0.004, decay: 0.42, gain: 0.03, send: 0.5 })
      break

    case 'ui.back':
      tone({ freq: 587.33, wave: 'sine', attack: 0.006, decay: 0.2, gain: 0.045, cutoff: 1800, send: 0.25 })
      break

    case 'ui.forward':
      tone({ freq: 784, wave: 'triangle', attack: 0.005, decay: 0.26, gain: 0.05, cutoff: 3000, send: 0.34 })
      tone({ freq: 1174.7, wave: 'sine', delay: 0.05, attack: 0.004, decay: 0.3, gain: 0.025, send: 0.45 })
      break

    /*
     * 별 하나가 닿았다.
     * 아주 미세한 상승음 → 맑은 반짝임 → 짧고 은은한 잔향.
     */
    case 'star.born':
      swell({ from: 420, to: 1180, seconds: 0.42, gain: 0.04, send: 0.55 })
      shimmer({ base: 1046.5, count: 4, spread: 0.18, gain: 0.038, send: 0.6, delay: 0.3 })
      tone({ freq: 523.25, wave: 'sine', delay: 0.3, attack: 0.01, decay: 1.6, gain: 0.05, send: 0.7 })
      break

    /* 열 개가 펼쳐진다. 소리라기보다 공간이 열리는 느낌이다. */
    case 'view.open':
      tone({ freq: 196, wave: 'sine', attack: 1.1, decay: 2.6, gain: 0.07, cutoff: 900, send: 0.85 })
      shimmer({ base: 784, count: 4, spread: 1.1, gain: 0.025, send: 0.8, delay: 0.5 })
      break

    /*
     * 별 하나가 가운데로 온다. 다가오는 소리와 긴 꼬리.
     * 길이를 별이 오는 시간(1.6초)에 맞춘다 — 다 온 뒤에 소리가 도착하면
     * 눈과 귀가 어긋난다.
     */
    case 'view.center':
      swell({ from: 240, to: 620, seconds: 1.05, gain: 0.05, send: 0.75 })
      tone({ freq: 392, wave: 'sine', delay: 0.8, attack: 0.35, decay: 2, gain: 0.06, cutoff: 1600, send: 0.8 })
      break

    /* 그 시간이 떠오른다. 아주 작은 반짝임 하나. */
    case 'view.tell':
      shimmer({ base: 1318.5, count: 3, spread: 0.26, gain: 0.022, send: 0.7 })
      break

    /* 화면이 바뀐다. 있는 듯 없는 듯. */
    case 'scene':
      tone({ freq: 294, wave: 'sine', attack: 0.3, decay: 1.2, gain: 0.035, cutoff: 1100, send: 0.7 })
      break

    /*
     * 영수증이 펼쳐진다.
     *
     * **화면의 종이**가 펴지는 소리다 — 프린터가 종이를 내보내는 소리가 아니다.
     * 둘은 다른 일이고, 프린터는 아직 연결되지 않았다.
     *
     * 길이(0.82초)를 펼쳐지는 연출(0.9초)에 맞춰 두었다. 다 펴지면 조용해진다.
     */
    case 'receipt.open':
      rustle({ seconds: 0.82, gain: 0.052, send: 0.22, grains: 18 })
      // 아주 낮게 한 겹. 종이가 '놓이는' 느낌만.
      tone({ freq: 196, wave: 'sine', attack: 0.05, decay: 0.5, gain: 0.022, cutoff: 500, send: 0.3 })
      break

    /*
     * 타자기.
     *
     * 음이 아니라 두드리는 소리다. 글자마다 아주 조금씩 다르게 —
     * 똑같은 소리가 되풀이되면 그건 타자기가 아니라 메트로놈이다.
     */
    case 'type.key':
      tap({
        gain: 0.055 + Math.random() * 0.022,
        cutoff: 1900 + Math.random() * 900,
        seconds: 0.038 + Math.random() * 0.016,
      })
      break

    case 'type.back':
      // 지우는 소리는 더 작고 더 둔하다
      tap({ gain: 0.03, cutoff: 1100, seconds: 0.05, send: 0.05 })
      break

    case 'type.paste':
      // 붙여넣기는 글자 수와 상관없이 **한 번**. 종이를 한 장 내려놓는 소리.
      tap({ gain: 0.05, cutoff: 1400, seconds: 0.1, send: 0.14 })
      break

    default:
      break
  }
}

/** 검증에서 쓴다. 지금 몇 개가 울리고 있는가. */
export function voiceCount(): number {
  return voices
}

/** 검증에서 쓴다. 간격 기억을 지운다. */
export function forgetGaps(): void {
  lastAt.clear()
  voices = 0
}

export const SOUND_NAMES: readonly SoundName[] = Object.keys(GAP) as SoundName[]
