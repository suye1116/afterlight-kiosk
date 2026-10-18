# 원작에서 그대로 가져온 것

두 곳을 **읽기 전용으로만** 참고했다. 어느 쪽에도 아무것도 쓰지 않았다.

| | 어디 |
| --- | --- |
| 공개 저장소 | https://github.com/suye1116/afterlight (`main`, `e99fa21`) |
| 실제 작업본 | `~/Desktop/조형실습/AFTERLIGHT` — 공개본보다 앞서 있다 (src 99개 파일) |

아래에서 따로 적지 않은 것은 모두 **공개 저장소**에서 온 것이다.

## 한 바이트도 고치지 않은 파일

```
src/styles/tokens.css        색 · 폰트 · 리듬 · 여백 토큰
src/styles/global.css        네 겹 레이어 · 장막 · 필름 입자 · .tap
src/constants/tones.ts       keep / letgo 두 톤의 모든 수치
src/constants/text.inherited.ts   ← 원작 src/constants/text.ts 전문
src/canvas/nebula.ts         성운 픽셀 계산
src/canvas/stars.ts          배경별 네 종류와 색 비율
src/canvas/safeArea.ts       FIELD → 안전 영역 매핑
src/lib/noise.ts             은하수 띠 · fBm
src/lib/random.ts            씨앗 난수
src/lib/safeZones.ts         [data-safe]
src/lib/fullscreen.ts        절대 throw하지 않는 전체화면
src/components/Notice.module.css
```

`diff`로 원본과 대조할 수 있다. 고칠 일이 생기면 **고치지 말고 옆에 새 파일을 둔다**
(`styles/kiosk.css`가 그렇게 생겼다).

## 수치만 가져오고 새로 쓴 파일

| 파일 | 원작 | 무엇이 달라졌나 |
| --- | --- | --- |
| `src/canvas/starForm.ts` | `canvas/memoryForms.ts` | 생김새를 씨앗이 아니라 **감정**이 정한다. 네 모양의 수치는 그대로 |
| `src/canvas/skyEngine.ts` | `canvas/starfieldEngine.ts` (2557줄) | 스프라이트·성운·배경별·별자리 선의 수치와 그리는 법은 그대로. 한 사람의 하늘에만 필요한 것들(NOW/THEN · 중력 · 잔광 보기 · 도감 판면 · 다시 도착한 빛)은 들여오지 않았다. 선은 **같은 감정끼리만** 잇는다 |
| `src/lib/starMath.ts` | `lib/starMath.ts` | 군집 배치 알고리즘과 상수는 그대로. 자리를 잡는 '하늘'이 전체가 아니라 **감정 하나의 영역**으로 좁혀진다 |
| `src/scenes/scene.module.css` | `scenes/SceneCompose.module.css` 외 | 같은 언어(테두리 없음·한 줄 밑줄·빛 모양 선택지)를 태블릿 크기로 |
| `src/components/ActionButton.tsx` | `SceneCompose.tsx`의 ActionButton | 그대로 |
| `src/components/Notice.tsx` | `components/Notice.tsx` | store 이름만 바뀌었다 |
| `src/constants/emotions.ts` | **작업본**의 `constants/emotions.ts` | 일곱의 `type`·`label`·`tint`·`blends`, `EMOTION_TINT`(0.34), `mixColor`, `emotionHalo`를 **한 글자도 바꾸지 않고** 옮겼다. 더한 것은 `form`(생김새)과 `field`(별자리가 차지하는 하늘의 조각) 둘뿐이다 — 원작의 하늘은 한 사람의 것이라 별자리를 마음으로 나눌 일이 없었다 |

## 마음의 색에 대한 규칙 (작업본에서 그대로)

> **별 전체의 색을 바꾸지 않는다.** 핵은 언제나 원래의 크림빛이고,
> 회절 십자도 그대로다. 달라지는 것은 그 바깥으로 번지는 빛뿐이다.

`skyEngine.ts`가 이 규칙을 지킨다 — 핵과 십자는 `tones.ts`의 색을 쓰고,
번짐에만 `haloFor()`로 마음의 색이 0.34만큼 섞인다. 화면의 선택지(`SceneEmotion`)도 같다.

## 새로 쓴 문구

`src/constants/text.exhibit.ts` 하나에 모여 있다. 원작에 있는 문장은
`text.inherited.ts`에서 가져다 쓰고, 여기에는 **원작에 없어서 새로 써야만 했던 것만** 둔다.
