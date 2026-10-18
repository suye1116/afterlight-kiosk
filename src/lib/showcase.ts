import type { Emotion, UniverseStar } from '@/types'
import { getEmotion } from '@/constants/emotions'
import { getTone } from '@/constants/tones'
import { makeRandom, hashString } from './random'

/**
 * 열 개의 별을 천천히 들여다보는 일.
 *
 * 목록이 아니다. 한꺼번에 늘어놓고 고르게 하면 그건 도감이고,
 * 하나씩 다가와 잠시 머물다 가면 그건 **남의 시간을 잠깐 들여다보는 일**이다.
 *
 * 캔버스와 무관한 순수한 셈만 여기 둔다 — 화면 없이도
 * "같은 별이 두 번 뽑히지 않는가", "없는 별을 지어내지 않는가"를 셀 수 있게.
 */

/** 한 번에 들여다보는 별의 수 */
export const SHOWCASE_SIZE = 10

/**
 * 한 별을 들여다보는 박자.
 *
 * ─── 고치는 곳은 여기 하나다 ───────────────────────────
 *  네 토막이 **겹치지 않고 차례로** 지나간다. 겹치면 무엇을 보아야 할지
 *  알 수 없게 된다 — 별이 움직이는데 글이 떠오르고 있으면 둘 다 놓친다.
 *
 *    ① 다가옴   별이 가운데로 온다
 *    ② 자리잡음 멈추고 한 숨 쉰다
 *    ③ 떠오름   그 사람의 시간이 배어 나온다
 *    ④ 읽음     읽을 만큼 머문다  ← 글의 길이에 따라 달라진다
 *
 *  **한 별에 8초**가 기준이다. 글이 길면 조금 더 머물되 9.2초를 넘지 않는다.
 *  열 개를 다 보는 데 1분 20초쯤.
 *
 *  (처음에는 한 별에 12.6~16.6초였다. 서서 보기에 너무 느렸다 —
 *   별이 넘어가기를 기다리게 되면 그건 감상이 아니라 대기다.)
 * ───────────────────────────────────────────────────────
 */
export const VIEWING = {
  /** 흩어진 하늘을 보여 주는 시간. 첫 별은 그 뒤에 움직인다. */
  scatterMs: 2000,
  /** ① 별이 가운데로 오는 시간 */
  travelMs: 1600,
  /** ② 자리를 잡고 한 숨 */
  settleMs: 300,
  /** ③ 글이 배어 나오는 시간 */
  tellFadeMs: 1100,
  /**
   * ④ 읽는 시간.
   *
   * 앞의 세 토막(3초)과 합쳐 **한 별에 8초**가 되도록 잡았다.
   * 글이 길면 1.2초까지 더 머문다 — 긴 문장이 읽히기 전에 넘어가면
   * 그 사람의 시간이 지나가 버린다.
   */
  readMinMs: 5000,
  readMaxMs: 6200,
  /** 이 길이의 글이면 읽는 시간이 가장 길어진다 (기록의 최대 길이) */
  longText: 80,
} as const

/** 한 별에 걸리기를 바라는 시간. 고칠 때 여기를 기준으로 잡는다. */
export const STEP_TARGET_MS = 8000

/**
 * 이 글을 읽는 데 얼마나 머물러야 하는가.
 *
 * 짧으면 8초, 가장 길면 12초. 그 사이는 글자 수에 따라 고르게 늘어난다.
 * 공개되지 않은 별(글이 없는 별)도 가장 짧은 시간만큼은 머문다.
 */
export function holdFor(text: string | null | undefined): number {
  const { readMinMs, readMaxMs, longText } = VIEWING
  if (!text) return readMinMs
  const ratio = Math.min(1, [...text].length / longText)
  return Math.round(readMinMs + (readMaxMs - readMinMs) * ratio)
}

/** 한 별을 들여다보는 데 걸리는 전체 시간 */
export function stepFor(text: string | null | undefined): number {
  return VIEWING.travelMs + VIEWING.settleMs + VIEWING.tellFadeMs + holdFor(text)
}

/** 글이 떠오르기 시작하는 때 (별이 움직이기 시작한 뒤로) */
export const TELL_AT = VIEWING.travelMs + VIEWING.settleMs

/**
 * 실제 우주에서 별을 고른다.
 *
 * **없는 것을 지어내지 않는다.** 열보다 적으면 있는 만큼만 돌려준다.
 * 가짜 별도, 가짜 이야기도 만들지 않는다 — 없는 사람의 시간을 꾸며 내는 것은
 * 이 작품이 하려는 일의 반대다.
 *
 * 아직 건너가는 중인 빛은 넣지 않는다. 닿은 것만 들여다본다.
 */
export function pickShowcase(
  stars: ReadonlyArray<UniverseStar>,
  { size = SHOWCASE_SIZE, seed = Date.now() }: { size?: number; seed?: number } = {},
): UniverseStar[] {
  const arrived = stars.filter((star) => star.status === 'arrived')
  if (arrived.length === 0) return []

  /*
   * 섞어서 앞에서부터 집는다 (Fisher–Yates).
   * 뽑은 것을 다시 뽑지 않으므로 **같은 별이 두 번 나올 수 없다.**
   */
  const random = makeRandom(seed >>> 0)
  const pool = [...arrived]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }

  return pool.slice(0, Math.min(size, pool.length))
}

/** 들여다보는 동안 그 별이 놓이는 자리 */
export interface ShowcaseSpot {
  /** 0~1 화면 비율 */
  x: number
  y: number
  /** 크기의 미세한 차이 */
  scale: number
  /** 떠 있는 듯한 움직임의 위상 */
  phase: number
  /** 그 움직임의 폭 (px) */
  sway: number
}

/**
 * 열 개를 화면에 흩어 놓는다.
 *
 * 별자리에서의 자리를 그대로 쓰지 않는다 — 같은 별자리의 별이 여럿 뽑히면
 * 한 구석에 뭉쳐 버리기 때문이다. 여기서는 **앞으로 걸어 나온 열 개**이고,
 * 그래서 화면 전체에 고르되 규칙적이지 않게 선다.
 *
 * 자리는 별의 이름에서 나온다 — 같은 별은 언제 보아도 같은 자리에 선다.
 */
/** 두 별이 이보다 가까우면 한 덩어리로 보인다 (0~1 화면 비율) */
const SHOWCASE_GAP = 0.12
/** 가운데는 비워 둔다 — 곧 별 하나가 와서 설 자리다 */
const CENTER = { x: 0.5, y: 0.46, clear: 0.14 }
/** 가장자리에 붙지 않게 */
const BOUNDS = { left: 0.08, right: 0.92, top: 0.12, bottom: 0.82 }

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value))

export function scatterShowcase(stars: ReadonlyArray<UniverseStar>): ShowcaseSpot[] {
  const total = stars.length

  const spots: ShowcaseSpot[] = stars.map((star, index) => {
    const random = makeRandom((hashString(star.id) ^ 0x5bd1e9) >>> 0)

    /*
     * 고르게 퍼뜨리되 격자가 되지 않게.
     *
     * 황금각으로 돌아가며 놓으면 어느 쪽으로도 줄이 서지 않는다.
     * 거기에 별마다 조금씩 흔들어 두면 '뿌려 놓은 것'처럼 보인다.
     */
    const angle = index * 2.399963 + random() * 0.9
    const reach = 0.42 + 0.58 * Math.sqrt((index + 0.7) / (total + 0.7))

    return {
      x: CENTER.x + Math.cos(angle) * reach * 0.44 + (random() - 0.5) * 0.05,
      y: CENTER.y + Math.sin(angle) * reach * 0.36 + (random() - 0.5) * 0.05,
      scale: 0.78 + random() * 0.5,
      phase: random() * Math.PI * 2,
      // 아주 느리게 떠 있다. 눈에 띄면 그건 움직임이 아니라 애니메이션이다.
      sway: 4 + random() * 7,
    }
  })

  /*
   * 서로 밀어낸다.
   *
   * 황금각만으로는 열 개 중 두엇이 바짝 붙는 일이 생긴다 — 붙으면 두 사람의
   * 시간이 한 덩어리로 보이고, 가운데로 부를 별을 손가락으로 가리킬 수도 없다.
   * 몇 번 밀어내 주면 '뿌려 놓은 것'은 그대로이면서 겹침만 풀린다.
   */
  /*
   * 넉넉히 되풀이한다.
   *
   * 가장자리에 붙은 둘이 서로 밀면 한두 번으로는 풀리지 않는다.
   * 셈이 가벼우므로(열 개의 쌍 45개) 횟수를 아끼지 않는다.
   */
  for (let round = 0; round < 120; round += 1) {
    let moved = false

    for (let i = 0; i < spots.length; i += 1) {
      for (let j = i + 1; j < spots.length; j += 1) {
        const a = spots[i]
        const b = spots[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        let away = Math.hypot(dx, dy)

        if (away >= SHOWCASE_GAP) continue
        if (away < 1e-6) {
          /*
           * 거의 같은 자리다. 그냥 밀면 방향이 없어 영영 안 풀린다.
           * 쌍마다 다른 쪽으로 한 걸음 떼어 준다 — 어느 쪽이든 상관없고,
           * 같은 쌍은 언제나 같은 쪽이어야 한다.
           */
          const away2 = (i * 7 + j * 13) % 360
          dx = Math.cos((away2 * Math.PI) / 180) * 0.01
          dy = Math.sin((away2 * Math.PI) / 180) * 0.01
          away = Math.hypot(dx, dy)
        }

        const push = (SHOWCASE_GAP - away) / 2
        const ux = (dx / away) * push
        const uy = (dy / away) * push
        a.x -= ux
        a.y -= uy
        b.x += ux
        b.y += uy
        moved = true
      }
    }

    // 가운데를 비우고, 가장자리 안으로 들인다
    for (const spot of spots) {
      const dx = spot.x - CENTER.x
      const dy = spot.y - CENTER.y
      const fromCenter = Math.hypot(dx, dy)
      if (fromCenter < CENTER.clear) {
        const out = fromCenter === 0 ? { x: 1, y: 0 } : { x: dx / fromCenter, y: dy / fromCenter }
        spot.x = CENTER.x + out.x * CENTER.clear
        spot.y = CENTER.y + out.y * CENTER.clear
        moved = true
      }
      spot.x = clamp(spot.x, BOUNDS.left, BOUNDS.right)
      spot.y = clamp(spot.y, BOUNDS.top, BOUNDS.bottom)
    }

    if (!moved) break
  }

  return spots
}

/**
 * 이 별에서 보여 줄 수 있는 것.
 *
 * ─── 개인정보 ──────────────────────────────────────────
 *  **남이 쓴 글의 원문은 공개에 동의했을 때만 보여 준다.**
 *  동의는 `shared === true`로 적혀 있을 때에만 있는 것으로 본다 —
 *  빠뜨렸거나, 옛 기록이거나, 깨진 값이면 보여 주지 않는다.
 *
 *  자기 별은 다르다. 방금 자기가 적은 글이므로 자기에게는 보인다.
 *
 *  동의가 없으면 **고른 항목만** 보여 준다 — 마음, 간직/흘려보내기,
 *  언제의 시간인지, 그리고 번호. 넷 다 그 사람이 적은 글이 아니라 고른 것이다.
 *  이름도 연락처도 애초에 이 작품이 묻지 않는다.
 * ───────────────────────────────────────────────────────
 */
export interface StarContent {
  seq: number
  emotion: Emotion
  /** '간직한 시간' · '흘려보낸 시간' */
  how: string
  /** '3년쯤 전' 같은, 고른 항목의 이름 */
  when: string
  /** 공개에 동의했거나 자기 별일 때만 */
  text: string | null
  /** 이 글이 왜 보이는가 — 화면이 그 까닭을 말할 수 있게 */
  reason: 'shared' | 'mine' | 'private'
}

export function contentOf(star: UniverseStar, sessionId: string): StarContent {
  const mine = star.sessionId === sessionId
  const open = star.shared === true

  return {
    seq: star.seq,
    emotion: getEmotion(star.emotion),
    how: getTone(star.type).cardLabel,
    when: star.timeRef?.label ?? '',
    text: open || mine ? star.text : null,
    reason: open ? 'shared' : mine ? 'mine' : 'private',
  }
}
