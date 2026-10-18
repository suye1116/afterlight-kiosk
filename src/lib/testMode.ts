/**
 * 점검용 빛을 함께 볼 것인가.
 *
 * 혼자서는 별자리를 볼 수 없다. 공동 우주는 여럿이 모여야 비로소
 * 별자리가 되는데, 혼자 시험하면서 백 번을 보낼 수는 없다.
 *
 * 다만 **전시 중에는 절대 켜지면 안 된다.** 점검용 빛이 관람객의 빛과
 * 섞여 벽에 뜨면 그건 그 사람의 시간이 아니다. 그래서 켜지는 자리를 좁힌다.
 *
 *   개발 중(`npm run dev`)        언제나 켜진다
 *   구운 결과                      주소에 `?test=1`이 붙었을 때만
 *
 * Vite가 프로덕션에서 `import.meta.env.DEV`를 false로 바꾸므로,
 * 전시 빌드의 평소 화면에서는 점검용 저장소를 열지도 않는다.
 */
export function isTestMode(): boolean {
  try {
    /*
     * `import.meta.env`는 Vite가 넣어 주는 것이라 node에는 없다.
     * 검증 스크립트는 node로 도니까 여기서 한 번 걸린다 — 그래서 try 안에 둔다.
     * (Vite는 이 글자 그대로를 빌드 때 true/false로 바꾼다.)
     */
    if (import.meta.env.DEV) return true
    return new URLSearchParams(globalThis.location?.search ?? '').get('test') === '1'
  } catch {
    return false
  }
}
