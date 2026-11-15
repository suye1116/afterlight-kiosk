export interface CompositePhotoOptions {
  video: HTMLVideoElement
  viewport: HTMLElement
  overlayCanvas: HTMLCanvasElement | null
  overlayVisible: boolean
  /**
   * 사진 아래쪽에 작게 새겨 넣을 이름. 넘기지 않으면(자유롭게 담기는
   * 넘기지 않는다) 아무 글자도 그리지 않아 기존 저장 결과가 한 픽셀도
   * 달라지지 않는다 — "실제 별 찾기"(find 모드)만 넘긴다.
   */
  caption?: { starName: string; constellationName: string }
}

/**
 * 카메라 화면에 보이는 그대로(비디오 + 별자리 오버레이)를 하나의
 * JPEG으로 합성한다 — STEP 5-3 `FreeCaptureMode.tsx`의 `capture()`
 * 안에 있던 로직을 그대로 뽑은 것이다(동작 변경 없음, 그 파일은 이
 * 함수를 호출하도록만 바뀌었다). 두 화면이 같은 함수를 쓰므로
 * "별자리 그래픽만 저장되거나 카메라 영상만 저장되는" 종류의 실수가
 * 한쪽에서만 생길 일이 없다.
 *
 * 비디오가 아직 준비되지 않았거나 화면 크기를 읽을 수 없으면 `null`로
 * 끝난다 — 빈 사진을 지어내지 않는다.
 */
export function compositeCameraPhoto(options: CompositePhotoOptions): Promise<Blob | null> {
  const { video, viewport, overlayCanvas, overlayVisible, caption } = options
  if (video.readyState < 2) return Promise.resolve(null)

  const rect = viewport.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const outW = Math.round(rect.width * dpr)
  const outH = Math.round(rect.height * dpr)
  if (outW === 0 || outH === 0) return Promise.resolve(null)

  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const ctx = out.getContext('2d')
  if (!ctx) return Promise.resolve(null)

  /*
   * 화면의 <video>는 object-fit: cover로 잘려서 보인다 — 저장되는
   * 사진도 똑같이 잘라야 "보이는 대로 찍힌다"가 지켜진다(미리보기와
   * 저장되는 이미지의 구도를 일치시키는 부분).
   */
  const videoAspect = video.videoWidth / video.videoHeight
  const boxAspect = rect.width / rect.height
  let sx = 0
  let sy = 0
  let sw = video.videoWidth
  let sh = video.videoHeight
  if (videoAspect > boxAspect) {
    sw = video.videoHeight * boxAspect
    sx = (video.videoWidth - sw) / 2
  } else {
    sh = video.videoWidth / boxAspect
    sy = (video.videoHeight - sh) / 2
  }
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH)

  if (overlayVisible && overlayCanvas) {
    ctx.drawImage(overlayCanvas, 0, 0, overlayCanvas.width, overlayCanvas.height, 0, 0, outW, outH)
  }

  if (caption) drawCaption(ctx, outW, outH, caption)

  return new Promise((resolve) => {
    out.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92)
  })
}

/** 사진 아래쪽에 반투명 띠 + 별 이름(크게) · 별자리 이름(작게)을 새긴다. */
function drawCaption(
  ctx: CanvasRenderingContext2D,
  outW: number,
  outH: number,
  caption: { starName: string; constellationName: string },
) {
  const barHeight = Math.round(outH * 0.14)
  const gradient = ctx.createLinearGradient(0, outH - barHeight, 0, outH)
  gradient.addColorStop(0, 'rgba(4, 5, 11, 0)')
  gradient.addColorStop(1, 'rgba(4, 5, 11, 0.6)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, outH - barHeight, outW, barHeight)

  const pad = Math.round(outH * 0.035)
  const starFontSize = Math.max(16, Math.round(outH * 0.03))
  const constellationFontSize = Math.max(12, Math.round(outH * 0.02))
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = 'rgba(247, 220, 176, 0.96)'
  ctx.font = `${starFontSize}px "Jost", "Noto Sans KR", sans-serif`
  ctx.fillText(caption.starName, pad, outH - pad - constellationFontSize - 6)

  ctx.fillStyle = 'rgba(217, 208, 192, 0.88)'
  ctx.font = `${constellationFontSize}px "Noto Sans KR", sans-serif`
  ctx.fillText(caption.constellationName, pad, outH - pad)
}

/**
 * 사진을 공유하거나(가능하면) 다운로드한다 — STEP 5-3 `savePhoto()`를
 * 그대로 뽑은 것이다. 성공/취소를 단정하지 않고, 실제로 일어난 동작을
 * 그대로 문구로 돌려준다 — "저장됐다"처럼 확인할 수 없는 말을 하지 않는다.
 */
export async function shareOrDownloadPhoto(
  blob: Blob,
  url: string,
  filename: string,
  title: string,
): Promise<string> {
  const file = new File([blob], filename, { type: 'image/jpeg' })
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean }

  if (nav.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title })
      return '공유 화면을 열었어요.'
    } catch {
      // 사용자가 공유를 취소했을 수도 있다 — 다운로드로 넘어간다(실패로 단정하지 않는다).
    }
  }

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  return '다운로드를 시작했어요 — 사진 앱/파일에서 확인해 주세요.'
}
