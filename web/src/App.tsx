import { StarPage } from './pages/StarPage'
import { SkyIntroPage } from './pages/sky/SkyIntroPage'
import { FreeCaptureMode } from './pages/sky/free/FreeCaptureMode'
import { FindStarMode } from './pages/sky/find/FindStarMode'
import { UniversePage } from './pages/UniversePage'
import { NoticePage } from './pages/NoticePage'

/**
 * 아주 작은 길찾기.
 *
 * 다섯 길이다(`/star/:token`, `/star/:token/sky`, `/star/:token/sky/free`,
 * `/star/:token/sky/find`, `/universe`). 그 정도로는 라우팅 라이브러리를
 * 더하지 않는다 — 주소 하나를 문자열로 가르는 일에 의존성을 들이지 않는다.
 */
export function App() {
  const path = window.location.pathname

  const findMatch = /^\/star\/([^/]+)\/sky\/find\/?$/.exec(path)
  if (findMatch) {
    return <FindStarMode token={findMatch[1]} />
  }

  const freeMatch = /^\/star\/([^/]+)\/sky\/free\/?$/.exec(path)
  if (freeMatch) {
    return <FreeCaptureMode token={freeMatch[1]} />
  }

  const skyMatch = /^\/star\/([^/]+)\/sky\/?$/.exec(path)
  if (skyMatch) {
    return <SkyIntroPage token={skyMatch[1]} />
  }

  const starMatch = /^\/star\/([^/]+)\/?$/.exec(path)
  if (starMatch) {
    return <StarPage token={starMatch[1]} />
  }

  if (/^\/universe\/?$/.test(path)) {
    return <UniversePage />
  }

  return <NoticePage />
}
