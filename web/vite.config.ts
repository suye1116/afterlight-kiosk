import { existsSync, readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

/**
 * 같은 Wi-Fi에서 아이폰으로 카메라(getUserMedia)를 테스트하기 위한
 * 임시 HTTPS 설정 — `web/.cert/`에 인증서가 있을 때만 켜진다
 * (`.gitignore`에 걸려 커밋되지 않는다). 그 폴더를 지우면 이 블록은
 * 조용히 꺼지고 평소의 http 개발 서버로 돌아간다 — 되돌리기를 위해
 * 파일을 지우는 것만으로 충분하게 해 두었다.
 */
const certDir = fileURLToPath(new URL('./.cert/', import.meta.url))
const hasLanCert = existsSync(`${certDir}cert.pem`) && existsSync(`${certDir}key.pem`)

/**
 * 영수증 QR로 접속하는 모바일 사이트.
 *
 * 전시장 키오스크(루트 프로젝트)와는 **완전히 다른 배포**다 — 이건
 * Vercel의 공개 인터넷 주소로 나가고, 키오스크는 계속 태블릿 안에만
 * 머문다. 그래도 "실제 별 데이터"와 "나의 별 이야기를 짓는 법"은
 * 하나여야 한다 — 그래서 `@`는 이 프로젝트의 것이 아니라 **루트
 * 프로젝트의 `src/`를 그대로 가리킨다.** 복사해 두 곳에 두면 언젠가
 * 두 글이 어긋난다.
 *
 * 이 별칭이 가리키는 자리(`src/lib/starAssignment/*`·`src/constants/
 * realStars/*`)는 전부 순수 데이터·순수 함수다 — `localStorage`도
 * DOM도 안 쓴다. 그래서 다른 프로젝트(이 web/)에서 가져다 써도
 * 안전하다. 키오스크 전용 코드(캔버스·사운드·센서 등)는 이 사이트가
 * 아예 import하지 않는다.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../src', import.meta.url)),
      '@web': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    ...(hasLanCert
      ? {
          host: true,
          https: {
            key: readFileSync(`${certDir}key.pem`),
            cert: readFileSync(`${certDir}cert.pem`),
          },
        }
      : {}),
  },
})
