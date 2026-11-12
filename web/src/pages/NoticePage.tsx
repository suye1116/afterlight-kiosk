/**
 * `/star/:token` 바깥의 모든 주소.
 *
 * 이 사이트는 영수증의 QR코드로만 들어오는 자리다 — 주소를 외워서
 * 직접 치고 들어올 일이 없다. 그래서 이 화면은 꾸미지 않는다. 다음
 * 단계(모바일 우리의 우주)가 생기면 `/universe`로 가는 안내만 하나
 * 더한다.
 */
export function NoticePage() {
  return (
    <main className="notice">
      <p className="notice-mark">AFTERLIGHT</p>
      <p className="notice-body">
        이 페이지는 영수증의 QR코드로 들어올 때만 뜻이 있습니다.
        <br />
        전시장에서 받으신 영수증의 QR코드를 다시 스캔해 주세요.
      </p>
    </main>
  )
}
