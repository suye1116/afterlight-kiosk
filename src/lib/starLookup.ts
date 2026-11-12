import type { RealStar } from '@/constants/realStars'

/**
 * 영수증 QR코드가 가리킬, 그 실제 별을 찾아보는 주소.
 *
 * ─── 왜 위키백과인가 ───────────────────────────────────
 *  처음에는 SIMBAD(천문학계의 표준 천체 식별 데이터베이스)를 생각했지만,
 *  확인해 보니 **SIMBAD의 본서버(Strasbourg)가 보안 사고로 지금 멈춰
 *  있고**, 임시 미러(하버드·남아프리카)만 떠 있다 — 종이에 찍어 몇 달을
 *  갈 주소로 "사고 대응용 임시 미러"를 쓸 수는 없다.
 *
 *  대신 **바이어/플램스티드 지정법**(`observation.skyMapIdentifier`,
 *  이미 모든 별에 들어 있다)으로 위키백과 문서를 바로 가리킨다.
 *  이 지정법은 "동명이인" 문제가 거의 없는 공인 천문 표기이고,
 *  위키백과는 이런 지정법 표제를 실제 별 문서로 넘겨주는 문서
 *  이동(redirect)을 거의 항상 가지고 있다 — 리겔(Beta Orionis),
 *  고유명이 없는 별(Gamma Cassiopeiae), 숫자가 붙는 지정법(Mu1 Scorpii),
 *  겹별 표기(Beta1 Scorpii→Beta Scorpii) 등 서로 다른 모양을 실제로
 *  불러와 확인했다 — 전부 그 별(또는 그 별이 속한 성계) 문서로 간다.
 *
 *  **모바일 대응**: 위키백과는 모바일 웹에서 그대로 읽힌다 — 따로
 *  손댈 것이 없다.
 * ───────────────────────────────────────────────────────
 *
 * ─── "찾아볼 수 있다"고만 말한다 ────────────────────────
 *  이 주소는 그 별이 무엇인지 알아보는 자리이지, 지금 이 순간
 *  실시간으로 관측할 수 있다는 뜻이 아니다. 낮일 수도, 계절이 아닐
 *  수도, 한국에서는 지평선 아래일 수도 있다 — 그래서 화면과 문구
 *  어디에도 "지금 볼 수 있다"고 쓰지 않는다.
 * ───────────────────────────────────────────────────────
 */
export function starLookupUrl(star: RealStar): string {
  const ascii = star.observation.skyMapIdentifier
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // 발음 구별 기호(ö 등)를 뗀다 — 위키백과 표제는 보통 ASCII다
    .trim()
  const slug = encodeURI(ascii.replace(/\s+/g, '_'))
  return `https://en.wikipedia.org/wiki/${slug}`
}
