/**
 * 팀원 공유용 껍데기를 만든다.
 *
 * Artifact는 `<!doctype>`·`<html>`·`<head>`·`<body>`를 **스스로 씌우므로**
 * 그 안쪽만 넘긴다. 그리고 에셋 경로는 앞에 `/` 없이 적어야 한다.
 *
 * 해시 파일명(`index-8Sf98rdK.js`)은 빌드할 때마다 바뀐다. 손으로 적으면
 * 반드시 언젠가 어긋나므로, `dist/index.html`에서 읽어 와 적는다.
 *
 *   npm run build && node scripts/artifact.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const built = readFileSync(path.join(ROOT, 'dist/index.html'), 'utf8')

const js = /src="\.\/(assets\/[^"]+\.js)"/.exec(built)?.[1]
const css = /href="\.\/(assets\/[^"]+\.css)"/.exec(built)?.[1]
if (!js || !css) {
  console.error('dist/index.html에서 에셋을 찾지 못했습니다. 먼저 npm run build 하세요.')
  process.exit(1)
}

const page = `<title>AFTERLIGHT · 아직 도착 중인 시간</title>
<meta name="description" content="시간은 사라지는 것이 아니라, 계속해서 우리에게 도착하고 있는 것입니다." />

<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Jost:wght@200;300;400&family=Noto+Sans+KR:wght@200;300;400&display=swap"
  rel="stylesheet"
/>
<link rel="stylesheet" href="${css}" />

<style>
  /*
   * 번들이 오기 전의 흰 바닥 번짐을 막는다.
   * 이 작품은 어두운 하늘에서 시작해야 한다 — 한 번이라도 흰 화면이
   * 번쩍이면 그건 작품이 아니라 웹페이지가 된다.
   */
  :root { color-scheme: dark; }
  html, body { margin: 0; background: #06070e; }
</style>

<div id="root"></div>
<noscript>
  이 작품은 빛의 움직임으로 이루어져 있습니다. 감상하시려면 자바스크립트를 켜 주세요.
</noscript>

<script type="module" src="${js}"></script>
`

const out = path.join(ROOT, 'dist/artifact.html')
writeFileSync(out, page, 'utf8')
console.log('껍데기:', path.relative(ROOT, out))
console.log('  js :', js)
console.log('  css:', css)
