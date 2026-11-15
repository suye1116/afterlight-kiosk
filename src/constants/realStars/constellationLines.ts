import type { RealConstellationId } from './types'

/**
 * 별자리 작화선 — 어느 별과 어느 별을 선으로 잇는가.
 *
 * `constellations.ts`의 `ConstellationCard.shape.keyStarIds`는 "이
 * 별자리에 어떤 별이 속하는가"만 보증한다("실제 좌표는 여기 두지
 * 않는다"고 그 파일 타입 주석에 명시돼 있다). **어느 별과 어느 별을
 * 선으로 잇는가는 외부 작화선 자료(Stellarium 등)를 베끼지 않고,
 * AFTERLIGHT 자체의 `shape.description` 글과 각 별의 실제 RA/Dec만으로
 * 도출했다.** 그래서 "공식적으로 검증된 전통 별자리선"이 아니라
 * **AFTERLIGHT의 시각화 제안**이다 — 화면 문구도 이렇게 밝힌다.
 *
 * 12개 전부 사용자가 별자리 하나씩 검토·승인한 것만 들어 있다
 * (2026-11 검토, `claude.ai/artifact/TQUjRtyFP5MtFAMnDCPHUQ` 참고).
 * 선분이 가리키는 별은 전부 `src/constants/realStars/stars.*.ts`에
 * 실제로 있는 별이다 — 지어낸 별은 없다.
 *
 * ─── keyStarIds 밖의 별을 쓰는 세 곳 ──────────────────────
 *  - **황소자리**: 아인·히아둠1(알데바란 쪽 얼굴), 메로페·플레이오네
 *    (알키오네 쪽 플레이아데스 소그룹) — 전부 `RealStar.constellationId`가
 *    이미 `rc-taurus`인 실제 소속 별. keyStarIds가 3개뿐이라 모양을
 *    더 살리려고 추가했다. (플레이아데스의 다른 5자매는 좌표가
 *    "근사"로만 적혀 있어 — 초 단위가 없음 — 파서가 못 읽으므로 뺐다.)
 *  - **백조자리**: 파와리스(`rc-cygnus` 소속) — 사드르를 기준으로
 *    기에나와 거의 정반대편에 있어 북십자의 "다른 쪽 날개"로 쓴다.
 *  - **전갈자리**: 알니야트·팡·그라피아스·자바(머리 쪽 집게,
 *    `rc-scorpius` 소속)와 샤미디무라(꼬리가 굽는 지점).
 *  - **카시오페이아자리**: 세긴(`rc-cassiopeia` 소속) — 원작 설명이
 *    말하는 "다섯 별" W 모양을 완성한다.
 *
 * ─── 페가수스자리만 다른 별자리 소속 별을 "그리기용으로" 빌린다 ──
 *  큰 사각형의 네 번째 꼭짓점은 안드로메다자리의 알페라츠다 — 실제
 *  하늘에서도 같은 별이 두 별자리 경계에 걸쳐 함께 쓰인다(알파
 *  안드로메다 = 델타 페가수스로도 불렸던 전통이 있다). **그 별의
 *  `RealStar.constellationId`는 여전히 `rc-andromeda`이고, QR1
 *  배정 로직(`realStarId` → 소속 별자리)도 전혀 바뀌지 않는다** —
 *  여기서는 오직 페가수스자리를 "그릴 때" 좌표만 한 번 더 참조한다.
 */
export const CONSTELLATION_LINES: Partial<
  Record<RealConstellationId, ReadonlyArray<readonly [string, string]>>
> = {
  'rc-orion': [
    ['star-betelgeuse', 'star-bellatrix'],
    ['star-bellatrix', 'star-mintaka'],
    ['star-mintaka', 'star-alnilam'],
    ['star-alnilam', 'star-alnitak'],
    ['star-betelgeuse', 'star-alnitak'],
    ['star-mintaka', 'star-rigel'],
    ['star-alnitak', 'star-saiph'],
  ],
  'rc-canis-major': [
    ['star-mirzam', 'star-sirius'],
    ['star-sirius', 'star-wezen'],
    ['star-wezen', 'star-adhara'],
    ['star-wezen', 'star-aludra'],
  ],
  'rc-taurus': [
    ['star-hyadum-1', 'star-ain'],
    ['star-ain', 'star-aldebaran'],
    ['star-aldebaran', 'star-elnath'],
    // 플레이아데스 소그룹 — 얼굴·뿔 쪽과는 선으로 잇지 않는다(원작 설명대로 "따로 떨어진 성단").
    ['star-alcyone', 'star-merope'],
    ['star-merope', 'star-pleione'],
    ['star-pleione', 'star-alcyone'],
  ],
  'rc-ursa-major': [
    ['star-dubhe', 'star-merak'],
    ['star-merak', 'star-phecda'],
    ['star-phecda', 'star-megrez'],
    ['star-megrez', 'star-dubhe'],
    ['star-megrez', 'star-alioth'],
    ['star-alioth', 'star-mizar'],
    ['star-mizar', 'star-alkaid'],
  ],
  'rc-leo': [
    ['star-regulus', 'star-algieba'],
    ['star-regulus', 'star-denebola'],
    ['star-algieba', 'star-denebola'],
  ],
  'rc-bootes': [
    ['star-arcturus', 'star-muphrid'],
    ['star-arcturus', 'star-izar'],
    ['star-muphrid', 'star-seginus'],
    ['star-izar', 'star-seginus'],
  ],
  'rc-lyra': [
    ['star-vega', 'star-sheliak'],
    ['star-vega', 'star-sulafat'],
    ['star-sheliak', 'star-sulafat'],
  ],
  'rc-cygnus': [
    ['star-deneb', 'star-sadr'],
    ['star-sadr', 'star-albireo'],
    ['star-sadr', 'star-gienah'],
    ['star-sadr', 'star-fawaris'],
  ],
  'rc-scorpius': [
    ['star-dschubba', 'star-grafias'],
    ['star-grafias', 'star-jabbah'],
    ['star-dschubba', 'star-fang'],
    ['star-dschubba', 'star-alniyat'],
    ['star-alniyat', 'star-antares'],
    ['star-antares', 'star-xamidimura'],
    ['star-xamidimura', 'star-shaula'],
    ['star-shaula', 'star-sargas'],
  ],
  'rc-pegasus': [
    ['star-scheat', 'star-markab'],
    ['star-markab', 'star-algenib'],
    ['star-algenib', 'star-alpheratz'],
    ['star-alpheratz', 'star-scheat'],
    ['star-markab', 'star-enif'],
  ],
  'rc-andromeda': [
    ['star-alpheratz', 'star-mirach'],
    ['star-mirach', 'star-almach'],
  ],
  'rc-cassiopeia': [
    ['star-caph', 'star-schedar'],
    ['star-schedar', 'star-gamma-cas'],
    ['star-gamma-cas', 'star-ruchbah'],
    ['star-ruchbah', 'star-segin'],
  ],
}
