import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { SAMPLE_STARS } from '@/constants/realStars'

/**
 * "나의 하늘에 담기" 소개 + 모드 선택 화면.
 *
 * `/star/:token`과 같은 토큰으로 같은 `assignments` 문서를 다시 읽는다
 * (StarPage.tsx의 조회 방식 그대로 — 지금은 꼭 필요한 경우가 아니라
 * 리팩터링하지 않는다는 방침에 따라, 공유 훅으로 뽑지 않고 그대로
 * 한 번 더 둔다). 이 화면에서 쓰는 것은 "이 토큰이 실제 배정된
 * 별을 가리키는가"뿐이라 StarPage처럼 시적 해석까지 다시 조립하지
 * 않는다 — 다음 단계(카메라·센서 모드)에서 실제 별 정보가 필요해지면
 * 그때 이 조회 결과를 넘겨 쓴다.
 */
interface AssignmentDoc {
  realStarId: string
}

type LoadState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready' }

export function SkyIntroPage({ token }: { token: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    getDoc(doc(db, 'assignments', token))
      .then((snap) => {
        if (cancelled) return
        if (!snap.exists()) {
          setState({ status: 'not-found' })
          return
        }
        const assignment = snap.data() as AssignmentDoc
        const star = SAMPLE_STARS.find((s) => s.id === assignment.realStarId)
        if (!star) {
          // 있어서는 안 되는 경우(StarPage.tsx와 같은 원칙) — 지어내지 않는다.
          setState({ status: 'error', message: '별 정보를 찾는 중 문제가 생겼어요.' })
          return
        }
        setState({ status: 'ready' })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : '알 수 없는 오류',
        })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  if (state.status === 'loading') {
    return (
      <main className="page">
        <p className="quiet">별을 찾고 있어요…</p>
      </main>
    )
  }

  if (state.status === 'not-found') {
    return (
      <main className="page">
        <p className="mark">AFTERLIGHT</p>
        <p className="quiet">
          이 주소로는 별을 찾을 수 없어요.
          <br />
          영수증의 QR코드를 다시 스캔해 주세요.
        </p>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="page">
        <p className="mark">AFTERLIGHT</p>
        <p className="quiet">
          지금은 불러올 수 없어요. 잠시 뒤 다시 시도해 주세요.
          <br />
          <span className="dim">({state.message})</span>
        </p>
      </main>
    )
  }

  return (
    <main className="page sky-page">
      <header className="hero">
        <p className="mark">AFTERLIGHT · 나의 하늘에 담기</p>
        <h1 className="skyTitle">나의 하늘에 담기</h1>
        <p className="quiet skyLead">당신에게 도착한 별을, 오늘의 하늘에 남겨 보세요.</p>
      </header>

      <div className="modeList">
        <a className="modeCard modeCardLink" href={`/star/${token}/sky/free`}>
          <p className="modeTitle">자유롭게 담기</p>
          <p className="quiet modeDesc">당신이 바라보는 풍경에 별을 남겨 보세요.</p>
        </a>
        <a className="modeCard modeCardLink" href={`/star/${token}/sky/find`}>
          <p className="modeTitle">실제 별 찾기</p>
          <p className="quiet modeDesc">하늘 어딘가에 있는 당신의 별을 찾아보세요.</p>
        </a>
      </div>

      <a className="backLink" href={`/star/${token}`}>
        나의 별 이야기로 돌아가기
      </a>
    </main>
  )
}
