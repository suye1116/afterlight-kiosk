/**
 * 어디서 온 연결인가.
 *
 * 이 다리는 **바깥 인터넷에 내놓지 않는다.** 기본은 이 기계 안이고,
 * `--lan`을 켜도 사설 대역에서 오는 연결만 받는다.
 *
 * 떼어 둔 것은 시험하기 위해서다 — 전시장에서 확인할 수 없는 일이기 때문이다.
 */
export function isPrivateAddressForTest(address) {
  if (!address) return false
  const ip = String(address).replace(/^::ffff:/, '')
  if (ip === '::1' || ip === '127.0.0.1') return true
  if (/^10\./.test(ip)) return true
  if (/^192\.168\./.test(ip)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true
  if (/^169\.254\./.test(ip)) return true
  if (/^f[cd]/i.test(ip)) return true
  if (/^fe80:/i.test(ip)) return true
  return false
}
