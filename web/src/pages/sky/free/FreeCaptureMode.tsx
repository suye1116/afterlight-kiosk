import { useEffect, useRef, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../../firebase'
import { DRAFT_CONSTELLATIONS, SAMPLE_STARS } from '@/constants/realStars'
import { useCameraStream } from './useCameraStream'
import { ConstellationOverlay, type NameMode, type OverlayHandle, type OverlayStar } from './ConstellationOverlay'
import { buildConstellationMembers } from '../constellationMembers'
import { compositeCameraPhoto, shareOrDownloadPhoto } from '../capturePhoto'

const NAME_MODE_LABEL: Record<NameMode, string> = {
  none: '이름 없이',
  mine: '나의 별만',
  all: '모든 별',
}
const NAME_MODE_NEXT: Record<NameMode, NameMode> = {
  none: 'mine',
  mine: 'all',
  all: 'none',
}

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
      members: OverlayStar[]
      lines: ReadonlyArray<readonly [string, string]>
    }

/**
 * "자유롭게 담기" — 카메라 화면 위에 실제 배정받은 별과 그 별자리를
 * 겹쳐 보고, 손으로 옮기고 키워서 사진으로 남긴다.
 *
 * **실제 하늘과 정렬되는 AR이 아니다.** 사용자가 직접 배치하는
 * 그래픽이라는 것을 화면 문구로 분명히 한다.
 *
 * 사진은 이 기기 안에서만 합성·저장된다 — 서버나 Firebase로
 * 보내는 코드는 이 파일에 없다.
 */
export function FreeCaptureMode({ token }: { token: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [overlayVisible, setOverlayVisible] = useState(true)
  const [nameMode, setNameMode] = useState<NameMode>('mine')
  const [photo, setPhoto] = useState<{ url: string; blob: Blob } | null>(null)
  const [saveNote, setSaveNote] = useState<string | null>(null)

  const camera = useCameraStream()
  const overlayRef = useRef<OverlayHandle | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const photoUrlRef = useRef<string | null>(null)

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
        const card = DRAFT_CONSTELLATIONS.find((c) => c.id === star.constellationId)
        const { members, lines } = buildConstellationMembers(star, card)

        setState({
          status: 'ready',
          starName: `${star.name.korean}${star.name.properName ? ` · ${star.name.properName}` : ''}`,
          constellationName: card ? card.name.korean : '',
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

  // 이 화면을 벗어나면(언마운트) 카메라를 반드시 끈다.
  useEffect(() => camera.stop, [camera.stop])

  // 사진을 새로 찍거나 화면을 벗어날 때, 전에 만든 Object URL을 정리한다.
  useEffect(() => {
    return () => {
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
    }
  }, [])

  async function capture() {
    const video = camera.videoRef.current
    const viewport = viewportRef.current
    const overlayCanvas = overlayRef.current?.getCanvas()
    if (!video || !viewport) return

    const blob = await compositeCameraPhoto({ video, viewport, overlayCanvas: overlayCanvas ?? null, overlayVisible })
    if (!blob) return

    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
    const url = URL.createObjectURL(blob)
    photoUrlRef.current = url
    setPhoto({ url, blob })
    setSaveNote(null)
  }

  async function savePhoto() {
    if (!photo) return
    const note = await shareOrDownloadPhoto(photo.blob, photo.url, 'afterlight-sky.jpg', 'AFTERLIGHT · 나의 하늘')
    setSaveNote(note)
  }

  function retake() {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
    photoUrlRef.current = null
    setPhoto(null)
    setSaveNote(null)
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

  return (
    <main className="sky-free">
      <header className="sky-free-header">
        <a className="sky-free-back" href={`/star/${token}/sky`}>
          ← 뒤로
        </a>
        <div className="sky-free-names">
          <p className="sky-free-star">{state.starName}</p>
          <p className="sky-free-constellation">{state.constellationName}</p>
        </div>
      </header>

      <div className="sky-free-viewport" ref={viewportRef}>
        {photo ? (
          <img className="sky-free-photo" src={photo.url} alt="합성된 하늘 사진" />
        ) : (
          <>
            <video
              className="sky-free-video"
              ref={camera.videoRef}
              playsInline
              muted
              style={{ display: camera.state.status === 'ready' ? 'block' : 'none' }}
            />
            {camera.state.status === 'ready' && (
              <ConstellationOverlay
                ref={overlayRef}
                stars={state.members}
                lines={state.lines}
                visible={overlayVisible}
                nameMode={nameMode}
              />
            )}

            {camera.state.status === 'idle' && (
              <div className="sky-free-gate">
                <p className="quiet">당신이 바라보는 풍경에 별을 남겨 보세요.</p>
                <button type="button" className="sky-free-primary" onClick={() => void camera.start()}>
                  카메라 시작
                </button>
              </div>
            )}
            {camera.state.status === 'requesting' && (
              <div className="sky-free-gate">
                <p className="quiet">카메라를 불러오는 중…</p>
              </div>
            )}
            {camera.state.status === 'denied' && (
              <div className="sky-free-gate">
                <p className="quiet">
                  카메라 접근이 허용되지 않았어요.
                  <br />
                  브라우저 설정에서 카메라 권한을 허용한 뒤 다시 시도해 주세요.
                </p>
                <button type="button" className="sky-free-primary" onClick={() => void camera.start()}>
                  다시 시도
                </button>
              </div>
            )}
            {camera.state.status === 'unsupported' && (
              <div className="sky-free-gate">
                <p className="quiet">
                  이 기기나 브라우저에서는 카메라를 쓸 수 없어요.
                  <br />
                  다른 기기의 브라우저로 다시 열어 주세요.
                </p>
              </div>
            )}
            {camera.state.status === 'error' && (
              <div className="sky-free-gate">
                <p className="quiet">
                  카메라를 여는 중 문제가 생겼어요.
                  <br />
                  <span className="dim">({camera.state.message})</span>
                </p>
                <button type="button" className="sky-free-primary" onClick={() => void camera.start()}>
                  다시 시도
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <p className="quiet dim sky-free-note">
        {photo
          ? saveNote ?? '화면에 보이는 그대로 담았어요.'
          : '실제 하늘의 방향과는 다를 수 있어요 — 당신이 직접 배치하는 그래픽입니다.'}
      </p>

      <footer className="sky-free-footer">
        {photo ? (
          <>
            <button type="button" className="sky-free-secondary" onClick={retake}>
              다시 촬영
            </button>
            <button type="button" className="sky-free-primary" onClick={() => void savePhoto()}>
              사진 저장
            </button>
          </>
        ) : (
          camera.state.status === 'ready' && (
            <>
              <button
                type="button"
                className="sky-free-secondary"
                onClick={() => setOverlayVisible((v) => !v)}
              >
                {overlayVisible ? '별자리 숨기기' : '별자리 표시'}
              </button>
              <button
                type="button"
                className="sky-free-secondary"
                onClick={() => overlayRef.current?.reset()}
              >
                위치 초기화
              </button>
              <button
                type="button"
                className="sky-free-secondary"
                onClick={() => setNameMode((mode) => NAME_MODE_NEXT[mode])}
              >
                이름: {NAME_MODE_LABEL[nameMode]}
              </button>
              <button type="button" className="sky-free-shutter" onClick={capture} aria-label="촬영">
                <span className="sky-free-shutter-dot" />
              </button>
            </>
          )
        )}
      </footer>
    </main>
  )
}
