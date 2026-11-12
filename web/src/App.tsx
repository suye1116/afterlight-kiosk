import { StarPage } from './pages/StarPage'
import { NoticePage } from './pages/NoticePage'

/**
 * 아주 작은 길찾기.
 *
 * 지금은 길이 하나뿐이다(`/star/:token`) — 다음 단계(모바일 우리의
 * 우주)에서 `/universe`가 늘어난다. 그 정도로는 라우팅 라이브러리를
 * 더하지 않는다 — 주소 하나를 문자열로 가르는 일에 의존성을 들이지
 * 않는다.
 */
export function App() {
  const path = window.location.pathname
  const starMatch = /^\/star\/([^/]+)\/?$/.exec(path)

  if (starMatch) {
    return <StarPage token={starMatch[1]} />
  }

  return <NoticePage />
}
