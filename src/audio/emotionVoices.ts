import type { EmotionKey, MemoryType } from '@/types'
import { shimmer, swell, tone } from './voices'
import { sfxAllowed } from './engine'

/**
 * 마음마다 다른 소리.
 *
 * ─── 같은 소리의 음높이만 바꾸지 않는다 ────────────────
 *  일곱이 갈리는 것은 음높이 하나가 아니다. 여섯 가지가 함께 달라진다.
 *
 *    음색      어떤 파형인가, 얼마나 깎여 있는가
 *    음의 조합 어떤 음들이 함께 울리는가 (화음)
 *    길이      얼마나 머무는가
 *    어택·감쇠 어떻게 올라오고 어떻게 사그라드는가
 *    잔향      얼마나 멀리 퍼지는가
 *    입자      반짝이는 알갱이가 몇이고 얼마나 흩어지는가
 * ───────────────────────────────────────────────────────
 *
 * 이름과 뜻은 `constants/emotions.ts`의 일곱 그대로다. 여기서 바꾸는 것은
 * 소리뿐이고, 목록도 그 일곱과 **정확히 같아야 한다**(검증 스크립트가 센다).
 *
 * 색을 한곳(`emotions.ts`)에 둔 것처럼, 소리도 한곳에 둔다.
 */

export interface EmotionVoice {
  /** 어떤 파형인가 */
  wave: OscillatorType
  /** 바탕음 (Hz) */
  base: number
  /** 함께 울리는 음들 (바탕음에 대한 비율) */
  chord: readonly number[]
  /** 음들이 차례로 들어오는 간격(초). 0이면 한꺼번에 울린다. */
  stagger: number
  /** 올라오는 시간 */
  attack: number
  /** 사그라드는 시간 */
  decay: number
  /** 세기 */
  gain: number
  /** 높은 쪽을 어디서 깎는가 (Hz). 낮을수록 둔하고 먹먹하다. */
  cutoff: number
  /** 잔향으로 보내는 양 */
  send: number
  /** 반짝이는 알갱이의 수 */
  particles: number
  /** 알갱이가 흩어지는 폭(초) */
  spread: number
  /** 떨림. 불안한 소리에만 있다. */
  vibrato?: { rate: number; depth: number }
  /** 다가오는 상승음을 앞에 둘 것인가 */
  rise?: { from: number; to: number; seconds: number }
}

/**
 * 일곱의 소리.
 *
 * 전시장은 조용하고, 이 작품의 하늘은 어둡다. 어느 것도 크지 않다 —
 * 가장 센 것도 0.14를 넘지 않는다. 구분은 크기가 아니라 결에서 온다.
 */
export const EMOTION_VOICES: Record<EmotionKey, EmotionVoice> = {
  /*
   * 행복 — 따뜻하고 맑게 퍼진다.
   * 장3화음에 9도를 얹었다. 알갱이가 가장 많고 가장 넓게 흩어진다.
   */
  happy: {
    wave: 'triangle',
    base: 523.25, // C5
    chord: [1, 1.25, 1.5, 2.25],
    stagger: 0.045,
    attack: 0.012,
    decay: 1.9,
    gain: 0.1,
    cutoff: 5200,
    send: 0.62,
    particles: 7,
    spread: 0.34,
    rise: { from: 220, to: 520, seconds: 0.5 },
  },

  /*
   * 설렘 — 가볍게 튀어 오른다.
   * 음이 차례로 올라오고(stagger가 가장 크다) 어택이 가장 짧다.
   */
  flutter: {
    wave: 'sine',
    base: 659.25, // E5
    chord: [1, 1.5, 2, 2.5, 3],
    stagger: 0.085,
    attack: 0.004,
    decay: 1.1,
    gain: 0.085,
    cutoff: 6400,
    send: 0.5,
    particles: 6,
    spread: 0.2,
    rise: { from: 330, to: 700, seconds: 0.32 },
  },

  /*
   * 평온 — 부드럽고 안정적이다.
   * 5도 하나뿐이고, 가장 느리게 올라와 가장 길게 머문다. 알갱이는 거의 없다.
   */
  calm: {
    wave: 'sine',
    base: 392, // G4
    chord: [1, 1.5],
    stagger: 0,
    attack: 0.5,
    decay: 2.8,
    gain: 0.11,
    cutoff: 1900,
    send: 0.72,
    particles: 2,
    spread: 0.5,
  },

  /*
   * 불안 — 떨린다.
   * 단2도가 함께 울려 서로 비벼진다. 떨림(vibrato)이 있는 유일한 소리다.
   */
  anxious: {
    wave: 'triangle',
    base: 440, // A4
    chord: [1, 1.0595, 1.5],
    stagger: 0.02,
    attack: 0.08,
    decay: 1.6,
    gain: 0.075,
    cutoff: 2600,
    send: 0.58,
    particles: 4,
    spread: 0.14,
    vibrato: { rate: 6.2, depth: 14 },
  },

  /*
   * 무기력 — 색을 거의 잃은 소리.
   * 가장 많이 깎여 있고(cutoff가 가장 낮다), 가장 짧고, 알갱이가 없다.
   */
  numb: {
    wave: 'sine',
    base: 261.63, // C4
    chord: [1, 1.5],
    stagger: 0,
    attack: 0.22,
    decay: 1.1,
    gain: 0.08,
    cutoff: 700,
    send: 0.3,
    particles: 0,
    spread: 0,
  },

  /*
   * 슬픔 — 낮고 부드럽게, 천천히 사라진다.
   * 단3도가 아래로 떨어진다. 가장 길게 남는 소리다.
   */
  sad: {
    wave: 'sine',
    base: 329.63, // E4
    chord: [1, 1.1892, 1.5],
    stagger: 0.14,
    attack: 0.3,
    decay: 3.2,
    gain: 0.095,
    cutoff: 1400,
    send: 0.8,
    particles: 3,
    spread: 0.42,
  },

  /*
   * 기타 — 이름 붙이지 않은 마음.
   * 색을 주지 않았듯 소리도 꾸미지 않는다. 가장 단순한 한 음.
   */
  other: {
    wave: 'sine',
    base: 440, // A4
    chord: [1, 2],
    stagger: 0,
    attack: 0.06,
    decay: 1.5,
    gain: 0.085,
    cutoff: 2800,
    send: 0.5,
    particles: 2,
    spread: 0.24,
  },
}

/**
 * 간직하기 / 흘려보내기는 **감정의 소리를 덮어쓰지 않는다.**
 *
 * 마음이 어떤 소리인지 정하고, 이 선택은 그 소리가 **어떻게 끝나는지**만 바꾼다.
 *
 *   간직  — 끝에 바탕음 한 음을 낮게 더해 안정적으로 맺는다
 *   흘려보냄 — 꼬리가 길어지고 음이 아래로 흘러 멀어진다
 */
const KEEPING = { decay: 1, send: 1, glide: 1 }
const LETTING = { decay: 1.45, send: 1.25, glide: 0.94 }

export function voiceOf(emotion: EmotionKey): EmotionVoice {
  return EMOTION_VOICES[emotion] ?? EMOTION_VOICES.other
}

/**
 * 별 하나가 떠나는 소리.
 *
 * 다가오는 상승음 → 맑은 울림 → 흩어지는 알갱이 → 은은한 잔향.
 * 화면에서 빛이 멀어지는 2.6초와 같은 길이 안에 들어간다.
 */
export function playSend(emotion: EmotionKey, type: MemoryType): void {
  if (!sfxAllowed()) return

  const voice = voiceOf(emotion)
  const shape = type === 'keep' ? KEEPING : LETTING

  // 다가오는 소리. 맑은 울림보다 먼저 와서, 그 울림을 맞이한다.
  if (voice.rise) {
    swell({
      from: voice.rise.from,
      to: voice.rise.to,
      seconds: voice.rise.seconds,
      gain: 0.055,
      send: 0.5,
    })
  }

  const head = voice.rise ? voice.rise.seconds * 0.72 : 0

  voice.chord.forEach((step, index) => {
    tone({
      freq: voice.base * step,
      wave: voice.wave,
      delay: head + index * voice.stagger,
      attack: voice.attack,
      decay: voice.decay * shape.decay,
      gain: voice.gain / Math.sqrt(voice.chord.length),
      cutoff: voice.cutoff,
      send: Math.min(1, voice.send * shape.send),
      glide: shape.glide,
      vibrato: voice.vibrato,
      // 같은 음이 겹겹이 쌓이지 않게 아주 조금씩 어긋내 둔다
      detune: (index - voice.chord.length / 2) * 3,
    })
  })

  if (voice.particles > 0) {
    shimmer({
      base: voice.base * 2,
      count: voice.particles,
      spread: voice.spread,
      gain: 0.04,
      send: Math.min(1, voice.send * shape.send),
      delay: head + 0.12,
      wave: voice.wave === 'triangle' ? 'triangle' : 'sine',
    })
  }

  /*
   * 맺는 소리.
   *
   * 간직한 빛은 바탕음 한 옥타브 아래가 길게 받쳐 준다 — 머무는 소리다.
   * 흘려보낸 빛에는 두지 않는다. 받쳐 주는 것 없이 멀어져야 한다.
   */
  if (type === 'keep') {
    tone({
      freq: voice.base / 2,
      wave: 'sine',
      delay: head + 0.1,
      attack: 0.4,
      decay: voice.decay * 1.3,
      gain: 0.05,
      cutoff: 900,
      send: 0.5,
    })
  }
}
