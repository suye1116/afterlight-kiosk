import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { DRAFT_CONSTELLATIONS, SAMPLE_STARS, type ObservableSeason } from '@/constants/realStars'
import { buildAssignmentReason } from '@/lib/starAssignment/reason'
import { buildComfortMessage } from '@/lib/starAssignment/comfort'
import type { MeaningTag } from '@/lib/starAssignment/types'
import type { EmotionKey, MemoryType, RecordMode, Season } from '@/types'
import { getEmotion } from '@/constants/emotions'
import { getTone } from '@/constants/tones'

/**
 * `assignments/{token}` 문서의 모양 — `src/lib/receipt.ts`의
 * `ReceiptData.assignment`가 서버에 보내는 그 모양 그대로다(여기서
 * 새로 정의하지 않고 같은 계약을 따른다). 기억 원문은 애초에 이
 * 문서에 없다.
 */
interface AssignmentDoc {
  realStarId: string
  season: Season
  type: MemoryType
  emotion: EmotionKey
  meaningTags: MeaningTag[]
  recordMode?: RecordMode
  promptQuestion?: string
}

type LoadState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; assignment: AssignmentDoc }

const SEASON_LABEL: Record<ObservableSeason, string> = {
  spring: '봄',
  summer: '여름',
  autumn: '가을',
  winter: '겨울',
}

const OPTICS_LABEL: Record<string, string> = {
  none: '맨눈으로 보여요',
  binoculars: '쌍안경을 쓰면 더 잘 보여요',
  telescope: '망원경이 있어야 보기 쉬워요',
}

export function StarPage({ token }: { token: string }) {
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
        setState({ status: 'ready', assignment: snap.data() as AssignmentDoc })
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
        {/* 지어내지 않는다 — 주소가 틀렸거나, 아주 오래전 기록이라 이 자리에 없을 수 있다. */}
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
          지금은 별을 불러올 수 없어요. 잠시 뒤 다시 시도해 주세요.
          <br />
          <span className="dim">({state.message})</span>
        </p>
      </main>
    )
  }

  const { assignment } = state
  const star = SAMPLE_STARS.find((s) => s.id === assignment.realStarId)

  if (!star) {
    // 있어서는 안 되는 경우(저장된 realStarId가 지금의 별 데이터에 없다) — 지어내지 않는다.
    return (
      <main className="page">
        <p className="mark">AFTERLIGHT</p>
        <p className="quiet">별 정보를 찾는 중 문제가 생겼어요. 전시장에 알려 주시면 감사하겠습니다.</p>
      </main>
    )
  }

  const card = DRAFT_CONSTELLATIONS.find((c) => c.id === star.constellationId)
  const reason = buildAssignmentReason(
    star,
    {
      season: assignment.season,
      type: assignment.type,
      emotion: assignment.emotion,
      recordMode: assignment.recordMode,
      promptQuestion: assignment.promptQuestion,
    },
    assignment.meaningTags,
  )
  const comfort = buildComfortMessage(star, assignment.type)
  const emotion = getEmotion(assignment.emotion)
  const tone = getTone(assignment.type)

  return (
    <main className="page">
      <header className="hero">
        <p className="mark">AFTERLIGHT · 나의 별</p>
        <h1 className="realName">
          {star.name.korean}
          <span className="realNameEn"> {star.name.properName ?? star.name.designation}</span>
        </h1>
        {card && !card.draft && (
          <p className="constellation">
            실제 별자리 · {card.name.korean} <span className="dim">({card.name.international})</span>
          </p>
        )}
      </header>

      <section className="block">
        <p className="label fact">검증된 사실</p>
        <dl className="rows">
          {star.name.etymology && (
            <div className="row">
              <dt>이름의 뜻</dt>
              <dd>
                {star.name.etymology.origin} · '{star.name.etymology.meaning}'
              </dd>
            </div>
          )}
          <div className="row">
            <dt>색</dt>
            <dd>{star.astronomy.colorDescription}</dd>
          </div>
          <div className="row">
            <dt>거리</dt>
            <dd>
              약 {star.astronomy.distance.lightYears.toLocaleString()}광년
              {star.astronomy.distance.approximate ? ' (추정)' : ''}
            </dd>
          </div>
          <div className="row">
            <dt>겉보기 밝기</dt>
            <dd>{star.astronomy.apparentMagnitude ?? '검증되지 않음'}등급</dd>
          </div>
          {star.astronomy.spectralType && (
            <div className="row">
              <dt>분광형</dt>
              <dd>{star.astronomy.spectralType}</dd>
            </div>
          )}
        </dl>
        {star.astronomy.facts.length > 0 && (
          <ul className="facts">
            {star.astronomy.facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="block">
        <p className="label poetry">AFTERLIGHT의 해석 — 시적 표현</p>
        <p className="poeticName">{star.poetry.poeticName}</p>
        <p className="body">{star.poetry.symbolism}</p>
      </section>

      <section className="block">
        <p className="label poetry">나의 별 이야기</p>
        <p className="body">{reason}</p>
        <p className="body quiet-strong">{comfort}</p>
        <p className="tags">
          {emotion.label} · {tone.cardLabel}
        </p>
      </section>

      <section className="block">
        <p className="label fact">관측 안내</p>
        <dl className="rows">
          <div className="row">
            <dt>보기 좋은 계절</dt>
            <dd>{star.astronomy.bestSeasonKR.map((s) => SEASON_LABEL[s]).join(' · ')}</dd>
          </div>
          <div className="row">
            <dt>한국에서</dt>
            <dd>{star.observation.visibleFromKorea ? '지평선 위로 뜹니다' : '보기 어려워요'}</dd>
          </div>
          <div className="row">
            <dt>도구</dt>
            <dd>{OPTICS_LABEL[star.observation.requiresOptics]}</dd>
          </div>
        </dl>
        <p className="body quiet">{star.observation.findingTip}</p>
        {/*
          지금 이 순간 보인다는 뜻이 아니다 — 날짜·위치 기반 실시간 계산을
          하기 전까지는 "보기 좋은 계절"까지만 안내한다(§6 참고).
        */}
        <p className="quiet dim">* 지금 바로 볼 수 있다는 뜻은 아니에요 — 계절·시간·날씨에 따라 다릅니다.</p>
      </section>
    </main>
  )
}
