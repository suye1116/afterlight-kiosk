import { makeRandom } from '@/lib/random'
import type { Emotion } from '@/types'

/**
 * 별의 생김새.
 *
 * 수치는 원작 `src/canvas/memoryForms.ts`에서 그대로 가져왔다.
 * 달라진 것은 **누가 생김새를 정하는가** 하나다 —
 * 원작에서는 씨앗이 넷 중 하나를 뽑았고, 여기서는 감정이 정한다.
 * 감정마다 별의 모양이 달라야 색을 크게 벌리지 않고도 서로 구분되기 때문이다.
 *
 * 다만 스타일은 하나여야 한다. 그래서 네 가지 모두
 *   · 같은 색(감정)을 쓰고
 *   · 같은 두 장의 스프라이트(핵 · 번짐)만 쓰고
 *   · 같은 크기 범위 안에 있다.
 * 달라지는 것은 그 비율뿐이다.
 */
export type StarFormName = 'ember' | 'cross' | 'halo' | 'soft'

export interface FormShape {
  form: StarFormName
  /** 핵 크기 배수 */
  core: number
  /** 번짐 크기 배수 */
  halo: number
  /** 번짐 세기 배수 */
  haloAlpha: number
  /** 갈래 세기. 0이면 갈래가 없다. */
  spike: number
  /** 갈래 길이 배수 */
  spikeReach: number
}

const SHAPES: Record<StarFormName, Omit<FormShape, 'form'>> = {
  ember: { core: 0.88, halo: 0.54, haloAlpha: 0.52, spike: 0, spikeReach: 1 },
  cross: { core: 0.78, halo: 0.68, haloAlpha: 0.46, spike: 0.5, spikeReach: 1.18 },
  halo: { core: 0.58, halo: 0.98, haloAlpha: 1, spike: 0, spikeReach: 1 },
  soft: { core: 0.7, halo: 1.52, haloAlpha: 0.82, spike: 0, spikeReach: 1 },
}

/**
 * 감정이 모양을, 씨앗이 그 안에서의 흔들림을 정한다.
 * 저장하지 않는다 — 같은 씨앗이면 언제 계산해도 같은 모습이다.
 */
export function formFor(emotion: Emotion, seed: number): FormShape {
  const random = makeRandom(seed ^ 0x7c19ab)
  const form = emotion.form
  const base = SHAPES[form]

  // 같은 생김새끼리도 완전히 같지는 않게. ±12% 안에서만 흔든다.
  const jitter = () => 0.88 + random() * 0.24

  /*
   * 별의 크기.
   *
   * 생김새와 별개로 이 별 자체가 조금 크거나 작다. 모든 별이 같은 크기면
   * 결국 네 종류의 도장을 찍은 것처럼 보인다. 밝기와 따로 노는 값이라,
   * 작지만 밝은 별과 크지만 흐린 별이 함께 생긴다.
   */
  const magnitude = 0.82 + random() * 0.48

  return {
    form,
    core: base.core * jitter() * magnitude,
    halo: base.halo * jitter() * magnitude,
    haloAlpha: base.haloAlpha * jitter(),
    spike: base.spike * (base.spike > 0 ? jitter() : 1),
    spikeReach: base.spikeReach * jitter() * magnitude,
  }
}
