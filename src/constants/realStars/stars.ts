import type { RealStar } from './types'
import { WINTER_STARS } from './stars.winter'
import { SPRING_STARS } from './stars.spring'
import { SUMMER_STARS } from './stars.summer'
import { AUTUMN_STARS } from './stars.autumn'

/**
 * 실제 별 — 검증된 전체 목록 (90개).
 *
 * ─── 무엇이 들어 있는가 ─────────────────────────────────
 *  `constellations.ts`의 확정 별자리 12개가 가리키는 대표 별(`keyStarIds`)을
 *  전부 채웠다. 계절별로 `stars.winter.ts`·`stars.spring.ts`·
 *  `stars.summer.ts`·`stars.autumn.ts` 네 파일에 나눠 적어 두었고,
 *  이 파일이 그 넷을 하나로 합친다 — 90개 가까운 별을 한 파일에 두면
 *  찾기도 리뷰하기도 어려워지기 때문이다.
 *
 *  **전부 공식 고유명(IAU 승인) 또는 바이어/플램스티드 지정법으로
 *  식별되는, 실제 존재가 확인된 별이다.** 거리·겉보기 밝기·분광형·
 *  적경·적위는 Wikipedia를 비롯한 공개 자료(대개 SIMBAD 계열 수치를
 *  인용하는 문서)를 확인하며 적었다(`astronomy.sources`). 자료마다
 *  수치가 갈리는 항목(거리, 변광 폭)은 범위나 "약" 표기를 두었다.
 *
 *  **84개는 `verification: 'verified'`, 6개는 `'needs-verification'`이다.**
 *  후자는 플레이아데스성단의 다섯 자매(아틀라스·엘렉트라·타이게타·
 *  켈라이노·아스테로페 — 개별 정밀 좌표를 확인하지 못해 성단 중심
 *  근사값을 썼다)와 플레이오네(겉보기 밝기 수치를 확인하지 못했다) —
 *  **80개를 채우려고 숫자를 지어내지 않았다는 것을 그대로 남겨 둔
 *  표시다.** 검증되지 않은 항목도 숫자를 지우지 않고 남긴 이유는,
 *  "무엇을 모르는지"까지 데이터의 일부이기 때문이다.
 *
 *  시적인 이름(`poetry.poeticName`)과 위로 문장은 모두 이 작업에서
 *  **새로 지은 것**이다 — 실제 이름이 아니라는 점을 화면에 낼 때도
 *  분명히 해야 한다.
 * ───────────────────────────────────────────────────────
 *
 * 간직하기/흘려보내기(`poetry.comfortDirection`)는 기계적으로 나누지
 * 않았다. "흘려보내는 별 = 죽어가는 별"이 되지 않도록, 식변광·불규칙
 * 폭발·먼 거리·동반자 관계 등 **서로 다른 이유**로 양쪽에 별을 나눠
 * 두었다(`types.ts`의 `StarQuality` 설명 참고).
 *
 * 아직 어떤 화면도, 배정 로직도 이 배열을 참조하지 않는다.
 */
export const SAMPLE_STARS: readonly RealStar[] = [
  ...WINTER_STARS,
  ...SPRING_STARS,
  ...SUMMER_STARS,
  ...AUTUMN_STARS,
] as const

export { WINTER_STARS, SPRING_STARS, SUMMER_STARS, AUTUMN_STARS }
