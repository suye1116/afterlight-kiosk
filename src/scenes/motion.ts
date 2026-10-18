/**
 * 장면이 드나드는 결.
 *
 * 잘리지 않고 겹쳐서 넘어간다. 빛이 도착하듯 흐릿한 데서 또렷해진다.
 * 수치는 원작 SceneCompose의 RISE와 같다.
 */

/**
 * 원작의 모든 전환이 쓰는 가속 곡선.
 * tokens.css의 `--ease-out-soft`와 같은 값이다.
 */
export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

/** 한 걸음이 떠오르고 물러나는 결 */
export const RISE = {
  initial: { opacity: 0, y: 12, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -10, filter: 'blur(6px)' },
  transition: { duration: 0.85, ease: EASE },
}

/** 장면 전체가 드나드는 결 */
export const SCENE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, filter: 'blur(8px)' },
  transition: { duration: 0.9, ease: EASE },
}
