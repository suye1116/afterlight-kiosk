import { useEffect, useRef, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../../firebase'
import { DRAFT_CONSTELLATIONS, SAMPLE_STARS } from '@/constants/realStars'
import { parsePosition, type EquatorialDeg } from '../../../lib/astro/coords'
import { altitudeLabel, compassLabel, equatorialToHorizontal, type HorizontalDeg } from '../../../lib/astro/horizontal'
import { useGeolocation } from './useGeolocation'
import { useDeviceHeading } from './useDeviceHeading'
import { useAlignmentGuidance } from './useAlignmentGuidance'
import { shouldRenderGuidanceSection, targetAzimuthFor } from './guidanceVisibility'
import { useCameraStream } from '../free/useCameraStream'
import { ConstellationOverlay, type OverlayHandle, type OverlayStar } from '../free/ConstellationOverlay'
import { AlignmentDial } from './AlignmentDial'
import { buildConstellationMembers } from '../constellationMembers'
import { compositeCameraPhoto, shareOrDownloadPhoto } from '../capturePhoto'

interface AssignmentDoc {
  realStarId: string
}

type LoadState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      starName: string
      constellationName: string
      position: EquatorialDeg
      members: OverlayStar[]
      lines: ReadonlyArray<readonly [string, string]>
    }

const RECOMPUTE_INTERVAL_MS = 30_000

/**
 * 개발 서버에서만(`import.meta.env.DEV`) `?debugAltitude=-10` 같은 쿼리로
 * 계산된 고도를 강제로 덮어써 본다 — 실제 날짜를 바꾸거나 Firebase 별
 * 데이터를 고치지 않고도, 지평선 아래 화면을 실기기에서 눈으로 확인하기
 * 위해서다. 프로덕션 빌드에서는 `import.meta.env.DEV`가 빌드 시점에
 * `false`로 치환되어 이 분기 자체가 빌드 결과에서 죽은 코드가 되고,
 * 화면에는 아무 흔적도 남지 않는다.
 */
function withDebugAltitudeOverride(horizontal: HorizontalDeg): HorizontalDeg {
  const raw = new URLSearchParams(window.location.search).get('debugAltitude')
  if (raw === null) return horizontal
  const altitude = Number(raw)
  return Number.isFinite(altitude) ? { ...horizontal, altitude } : horizontal
}

/** 카메라 CTA 버튼의 아이콘 — 이모지 대신 절제된 선 아이콘으로, 버튼 글자색을 그대로 이어받는다. */
function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h3l1.6-2.4a1 1 0 0 1 .8-.6h5.2a1 1 0 0 1 .8.6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13.5" r="3.2" />
    </svg>
  )
}

/**
 * "실제 별 찾기" — STEP 5-4-1~5-4-4.
 *
 * STEP 5-4-3에서 실시간 좌우 안내(화살표·문구·금빛 효과)가 더해졌고,
 * STEP 5-4-4에서 카메라 배경이 더해졌다. **카메라는 배경일 뿐 정렬
 * 계산에는 전혀 관여하지 않는다** — 좌우 판정·스무딩·히스테리시스·
 * 지평선 숨김은 카메라를 켜도 끄도 완전히 같은 `guidance` 값을 쓴다
 * (`AlignmentDial`이 그 값을 그대로 그린다).
 *
 * 카메라를 켜지 않으면(기본값) 이 화면은 STEP 5-4-3에서 검증된 모습
 * 그대로다 — 카메라가 `'ready'`가 될 때만 전체화면 레이아웃으로
 * 바뀐다. 즉 "카메라가 실패하면 돌아오는 화면"이 아니라 "카메라가
 * 성공하지 않으면 떠나지 않는 화면"이다.
 *
 * 센서 헤딩이 카메라가 실제로 향하는 방향과 정확히 같다고 가정하지
 * 않는다 — 그래서 화면 위 특정 픽셀에 별을 찍지 않고, 화살표·문구·
 * 금빛 효과라는 추상적인 신호만 카메라 위에 겹친다.
 *
 * 위치·방향·카메라 중 무엇도 서버나 Firebase로 보내지 않는다. 이
 * 화면을 벗어나면(언마운트) React state와 카메라 스트림 모두 함께
 * 사라진다 — 어디에도 남기지 않는다.
 */
export function FindStarMode({ token }: { token: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [horizontal, setHorizontal] = useState<HorizontalDeg | null>(null)
  const [isLandscape, setIsLandscape] = useState(false)
  const [photo, setPhoto] = useState<{ url: string; blob: Blob } | null>(null)
  const [saveNote, setSaveNote] = useState<string | null>(null)

  const geo = useGeolocation()
  const heading = useDeviceHeading()
  const camera = useCameraStream()
  const guidance = useAlignmentGuidance(heading.state, horizontal ? targetAzimuthFor(horizontal.altitude, horizontal.azimuth) : null)
  const overlayRef = useRef<OverlayHandle | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const photoUrlRef = useRef<string | null>(null)

  // 이 화면을 벗어나면(언마운트) 카메라를 반드시 끈다 — FreeCaptureMode.tsx와 같은 패턴.
  useEffect(() => camera.stop, [camera.stop])

  // 사진을 새로 찍거나 화면을 벗어날 때, 전에 만든 Object URL을 정리한다(FreeCaptureMode.tsx와 같은 패턴).
  useEffect(() => {
    return () => {
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
    }
  }, [])

  function stopCamera() {
    camera.stop()
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
    photoUrlRef.current = null
    setPhoto(null)
    setSaveNote(null)
  }

  async function capturePhoto() {
    if (state.status !== 'ready') return
    const video = camera.videoRef.current
    const viewport = viewportRef.current
    const overlayCanvas = overlayRef.current?.getCanvas()
    if (!video || !viewport) return

    const blob = await compositeCameraPhoto({
      video,
      viewport,
      overlayCanvas: overlayCanvas ?? null,
      overlayVisible: true,
      caption: { starName: state.starName, constellationName: state.constellationName },
    })
    if (!blob) return

    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
    const url = URL.createObjectURL(blob)
    photoUrlRef.current = url
    setPhoto({ url, blob })
    setSaveNote(null)
  }

  async function savePhoto() {
    if (!photo) return
    const note = await shareOrDownloadPhoto(photo.blob, photo.url, 'afterlight-constellation.jpg', 'AFTERLIGHT · 나의 별자리')
    setSaveNote(note)
  }

  function retakePhoto() {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
    photoUrlRef.current = null
    setPhoto(null)
    setSaveNote(null)
  }

  // 이 화면은 세로로 들고 쓰는 걸 기준으로 문구·좌우 방향을 정했다 — 가로로
  // 돌리면 "오른쪽"이 실제로 어느 쪽인지 보장할 수 없으니, 조용히 안내만 한다.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(orientation: landscape)')
    setIsLandscape(query.matches)
    const onChange = (event: MediaQueryListEvent) => setIsLandscape(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

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
          setState({ status: 'error', message: '별 정보를 찾는 중 문제가 생겼어요.' })
          return
        }
        const position = parsePosition(star.astronomy.position)
        if (!position) {
          setState({ status: 'error', message: '이 별의 좌표를 읽을 수 없었어요.' })
          return
        }
        const card = DRAFT_CONSTELLATIONS.find((c) => c.id === star.constellationId)
        const { members, lines } = buildConstellationMembers(star, card)
        setState({
          status: 'ready',
          starName: `${star.name.korean}${star.name.properName ? ` · ${star.name.properName}` : ''}`,
          constellationName: card ? card.name.korean : '',
          position,
          members,
          lines,
        })
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

  // 위치를 얻으면 바로 한 번 계산하고, 그 뒤로는 30초마다 다시 계산한다
  // (별의 위치는 시간에 따라 천천히 바뀐다 — 실시간 추적은 다음 단계의 일이다).
  useEffect(() => {
    if (state.status !== 'ready' || geo.state.status !== 'granted') {
      setHorizontal(null)
      return
    }
    const observer = { lat: geo.state.lat, lon: geo.state.lon }
    const position = state.position
    const recompute = () => {
      const computed = equatorialToHorizontal(position, observer, new Date())
      setHorizontal(import.meta.env.DEV ? withDebugAltitudeOverride(computed) : computed)
    }
    recompute()
    const interval = setInterval(recompute, RECOMPUTE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [state, geo.state])

  function startPermissions() {
    /*
     * 방향 센서 권한 요청을 먼저, 위치 요청을 그 다음에 — 같은 클릭
     * 안에서 둘 다 동기적으로 시작한다. 하나를 기다렸다가 다른 하나를
     * 요청하면(특히 위치를 먼저 기다리면) iOS Safari에서 방향 센서
     * 권한 요청이 "사용자 동작이 아니다"로 거부될 수 있다.
     */
    heading.request()
    geo.request()
  }

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

  // 카메라가 실제로 켜졌을 때만 전체화면 레이아웃으로 바꾼다 — 거부·미지원·
  // 중단·요청 중 어느 상태에서도 아래의(이미 검증된) 나침반 화면이 그대로 보인다.
  if (camera.state.status === 'ready') {
    return (
      <main className="sky-find-camera">
        <div className="sky-find-camera-viewport" ref={viewportRef}>
          {photo ? (
            <img className="sky-free-photo" src={photo.url} alt="합성된 하늘과 별자리 사진" />
          ) : (
            <>
              <video className="sky-find-camera-video" ref={camera.videoRef} playsInline muted />
              <ConstellationOverlay ref={overlayRef} stars={state.members} lines={state.lines} visible nameMode="mine" />
            </>
          )}
        </div>

        <div className="sky-find-camera-top">
          <div className="sky-find-camera-names">
            <p className="sky-find-camera-star">{state.starName}</p>
            <p className="sky-find-camera-constellation">{state.constellationName}</p>
          </div>
          <button type="button" className="sky-find-camera-toggle" onClick={stopCamera}>
            카메라 끄기
          </button>
        </div>

        {!photo && (
          <div className="sky-find-camera-guidance">
            {horizontal && shouldRenderGuidanceSection(horizontal.altitude, heading.state.status) ? (
              <AlignmentDial isLandscape={isLandscape} guidance={guidance} />
            ) : (
              <p className="alignCaveat">
                {horizontal && horizontal.altitude <= 0
                  ? '계산상 지금은 지평선 아래에 있어 방향 안내를 보여드리지 않아요.'
                  : '방향 센서 값을 기다리는 중이에요…'}
              </p>
            )}
          </div>
        )}

        <div className="sky-find-camera-bottom">
          {photo ? (
            <>
              <p className="sky-find-camera-note">{saveNote ?? '화면에 보이는 그대로 별자리와 함께 담았어요.'}</p>
              <div className="sky-find-camera-actions">
                <button type="button" className="sky-free-secondary" onClick={retakePhoto}>
                  다시 촬영
                </button>
                <button type="button" className="sky-free-primary" onClick={() => void savePhoto()}>
                  사진 저장
                </button>
              </div>
            </>
          ) : (
            <>
              {horizontal && (
                <dl className="sky-find-camera-rows">
                  <div className="row">
                    <dt>방위각</dt>
                    <dd>
                      {horizontal.azimuth.toFixed(0)}° · {compassLabel(horizontal.azimuth)}쪽
                    </dd>
                  </div>
                  <div className="row">
                    <dt>고도</dt>
                    <dd>
                      {horizontal.altitude.toFixed(0)}° · {altitudeLabel(horizontal.altitude)}
                    </dd>
                  </div>
                </dl>
              )}
              <p className="sky-find-camera-note">
                카메라 화면의 별자리와 화살표는 참고용이에요 — 실제 밤하늘의 정확한 위치를 가리키지 않아요.
              </p>
              <div className="sky-find-camera-actions">
                <button type="button" className="sky-free-secondary" onClick={() => overlayRef.current?.reset()}>
                  별자리 위치 초기화
                </button>
                <button type="button" className="sky-free-shutter" onClick={() => void capturePhoto()} aria-label="촬영">
                  <span className="sky-free-shutter-dot" />
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    )
  }

  const showStartButton = geo.state.status === 'idle' && heading.state.status === 'idle'

  return (
    <main className="page">
      <header className="hero">
        <p className="mark">AFTERLIGHT · 실제 별 찾기</p>
        <h1 className="realName">{state.starName}</h1>
        <p className="constellation">{state.constellationName}</p>
      </header>

      <section className="block">
        <p className="body">하늘 어딘가에 있는 당신의 별이 지금 어느 방향에 있는지 계산해서 보여드려요.</p>
        <p className="quiet dim">
          계산한 방향일 뿐이에요 — 휴대폰 나침반은 보통 5~15도, 때로는 더 많이 틀릴 수 있어요.
          <br />
          실제로 보이려면 날이 맑고 그 시간에 하늘 위에 떠 있어야 해요 — 건물이나 도시의 불빛에 가릴 수도 있어요.
        </p>
      </section>

      <section className="block skyCameraCta">
        {camera.state.status === 'idle' && (
          <button type="button" className="skyCameraCtaButton" onClick={() => void camera.start()}>
            <CameraIcon />
            카메라로 별자리 담기
          </button>
        )}
        {camera.state.status === 'requesting' && <p className="quiet">카메라를 불러오는 중…</p>}
        {camera.state.status === 'denied' && (
          <p className="quiet">
            카메라 접근이 허용되지 않았어요 — 방향 안내는 계속 쓸 수 있어요.{' '}
            <button type="button" className="backLink" onClick={() => void camera.start()}>
              다시 시도
            </button>
          </p>
        )}
        {camera.state.status === 'unsupported' && (
          <p className="quiet">이 기기나 브라우저에서는 카메라를 쓸 수 없어요 — 방향 안내는 계속 쓸 수 있어요.</p>
        )}
        {camera.state.status === 'error' && (
          <p className="quiet">
            카메라를 쓸 수 없었어요 — 방향 안내는 계속 쓸 수 있어요. <span className="dim">({camera.state.message})</span>{' '}
            <button type="button" className="backLink" onClick={() => void camera.start()}>
              다시 시도
            </button>
          </p>
        )}
      </section>

      {isLandscape && <p className="skyOrientationNotice">세로로 들고 봐야 방향 안내가 정확해요.</p>}

      {showStartButton && (
        <section className="block skyCta">
          <button type="button" className="skyCtaButton" onClick={startPermissions}>
            위치와 방향 사용하기
          </button>
        </section>
      )}

      <section className="block">
        <p className="label fact">위치 권한</p>
        {geo.state.status === 'idle' && <p className="quiet dim">아직 요청하지 않았어요.</p>}
        {geo.state.status === 'requesting' && <p className="quiet">위치를 확인하는 중…</p>}
        {geo.state.status === 'granted' && <p className="quiet">확인됐어요.</p>}
        {geo.state.status === 'denied' && (
          <p className="quiet">
            위치 권한이 거부됐어요.{' '}
            <button type="button" className="backLink" onClick={geo.request}>
              다시 시도
            </button>
          </p>
        )}
        {geo.state.status === 'timeout' && (
          <p className="quiet">
            위치를 확인하는 데 시간이 너무 오래 걸렸어요.{' '}
            <button type="button" className="backLink" onClick={geo.request}>
              다시 시도
            </button>
          </p>
        )}
        {geo.state.status === 'unsupported' && <p className="quiet">이 브라우저에서는 위치를 쓸 수 없어요.</p>}
        {geo.state.status === 'error' && (
          <p className="quiet">
            위치를 확인할 수 없었어요. <span className="dim">({geo.state.message})</span>{' '}
            <button type="button" className="backLink" onClick={geo.request}>
              다시 시도
            </button>
          </p>
        )}
      </section>

      <section className="block">
        <p className="label fact">방향 센서</p>
        {heading.state.status === 'idle' && <p className="quiet dim">아직 요청하지 않았어요.</p>}
        {heading.state.status === 'requesting' && <p className="quiet">권한을 확인하는 중…</p>}
        {heading.state.status === 'waiting-for-data' && <p className="quiet">센서 값을 기다리는 중…</p>}
        {heading.state.status === 'denied' && (
          <p className="quiet">
            방향 센서 권한이 거부됐어요.{' '}
            <button type="button" className="backLink" onClick={heading.request}>
              다시 시도
            </button>
          </p>
        )}
        {heading.state.status === 'unsupported' && (
          <p className="quiet">이 기기나 브라우저에서는 방향 센서를 쓸 수 없어요.</p>
        )}
        {heading.state.status === 'no-data' && (
          <p className="quiet">
            권한은 됐지만 센서 값이 들어오지 않아요 — 이 기기에 방향 센서가 없을 수 있어요.{' '}
            <button type="button" className="backLink" onClick={heading.request}>
              다시 시도
            </button>
          </p>
        )}
        {heading.state.status === 'error' && (
          <p className="quiet">
            방향 센서를 쓸 수 없었어요. <span className="dim">({heading.state.message})</span>
          </p>
        )}
        {heading.state.status === 'active' && (
          <p className="quiet">
            {heading.state.heading.toFixed(0)}°
            {heading.state.reference === 'true-north' && ' (참북 기준)'}
            {heading.state.reference === 'magnetic-estimated' && ' (자북 추정 보정값 — 오차가 있을 수 있어요)'}
            {heading.state.reference === 'unreliable' && ' (기준을 알 수 없어요 — 나침반으로 쓰지 마세요)'}
          </p>
        )}
      </section>

      {horizontal && (
        <section className="block">
          <p className="label poetry">계산된 방향(대략)</p>
          <dl className="rows">
            <div className="row">
              <dt>방위각</dt>
              <dd>
                {horizontal.azimuth.toFixed(0)}° · {compassLabel(horizontal.azimuth)}쪽
              </dd>
            </div>
            <div className="row">
              <dt>고도</dt>
              <dd>
                {horizontal.altitude.toFixed(0)}° · {altitudeLabel(horizontal.altitude)}
              </dd>
            </div>
            <div className="row">
              <dt>지금</dt>
              <dd>{horizontal.altitude > 0 ? '지평선 위' : '지평선 아래'}</dd>
            </div>
          </dl>
          {horizontal.altitude <= 0 && (
            <p className="quiet dim">계산상 지금은 지평선 아래에 있어요 — 시간이 지나면 다시 떠오를 수 있어요.</p>
          )}
          {horizontal.altitude > 0 && horizontal.altitude < 10 && (
            <p className="quiet dim">낮게 떠 있어 건물이나 안개·불빛에 가려 안 보일 수 있어요.</p>
          )}
        </section>
      )}

      {horizontal && shouldRenderGuidanceSection(horizontal.altitude, heading.state.status) && (
        <section className="block">
          <p className="label fact">실시간 방향 안내</p>
          <AlignmentDial isLandscape={isLandscape} guidance={guidance} />
        </section>
      )}

      <nav className="modeList">
        <a className="backLink" href={`/star/${token}/sky`}>
          ← 모드 선택으로
        </a>
        <a className="backLink" href={`/star/${token}/sky/free`}>
          자유롭게 담기로 전환
        </a>
      </nav>
    </main>
  )
}
