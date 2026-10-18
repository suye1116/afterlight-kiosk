import { useEffect, useState } from 'react'

/**
 * 창의 크기.
 *
 * 하늘은 캔버스가 스스로 재지만, 별자리의 이름은 글자(무대)라서
 * 같은 셈을 React 쪽에서도 한 번 해야 한다.
 */
export function useViewport(): { width: number; height: number } {
  const [size, setSize] = useState(() => ({
    width: globalThis.innerWidth || 1024,
    height: globalThis.innerHeight || 768,
  }))

  useEffect(() => {
    const look = () =>
      setSize({
        width: globalThis.innerWidth || 1024,
        height: globalThis.innerHeight || 768,
      })
    globalThis.addEventListener('resize', look)
    globalThis.visualViewport?.addEventListener('resize', look)
    return () => {
      globalThis.removeEventListener('resize', look)
      globalThis.visualViewport?.removeEventListener('resize', look)
    }
  }, [])

  return size
}
