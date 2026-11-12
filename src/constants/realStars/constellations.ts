import type { ConstellationCard } from './types'

/**
 * 실제 별자리 12종 — 사용자가 승인한 확정 목록.
 *
 * ─── 고른 기준 ─────────────────────────────────────────
 *  사용자가 준 다섯 기준을 모두 따졌다.
 *
 *   1. 한국에서 계절별로 볼 수 있는가 — 겨울·봄·여름·가을에 각각 셋,
 *      고르게 나눴다(겨울: 오리온·큰개·황소 / 봄: 큰곰·사자·목동 /
 *      여름: 거문고·백조·전갈 / 가을: 페가수스·안드로메다·카시오페이아).
 *      이 열두 벌은 한국 과학관·천문대가 '계절 별자리'로 흔히 가르치는
 *      목록과 같다 — 새로 지어낸 분류가 아니다.
 *   2. 실제 별을 충분히 포함하는가 — 열둘 모두 공식 고유명이 있는 별을
 *      다섯 개 이상 갖고 있다. 오리온·황소(플레이아데스)·큰곰(북두칠성)은
 *      특히 많다.
 *   3. 위로의 결을 찾을 수 있는가 — 아래 `story`/`comfort`에 각각 적었다.
 *      신화나 문화적 이야기는 실제로 알려진 것만 적었고, 그것을 '위로'로
 *      읽는 일은 이 작품의 해석임을 분명히 한다.
 *   4. 계절 편중이 없는가 — 3×4로 고르다.
 *   5. 실물 카드에서 모양이 구분되는가 — 국자(큰곰)·허리띠 세 별과 모래시계
 *      (오리온)·W자(카시오페이아)·낚시바늘(전갈)·십자(백조)처럼, 하나같이
 *      이미 '그 모양'으로 불리는 별자리를 골랐다. 애매하게 흩어진 모양은
 *      뺐다.
 *
 *  열두 벌 모두 사용자가 승인했다(`draft: false`). `draft` 필드는 타입에
 *  남겨 둔다 — 나중에 또 추천안을 만들 일이 생기면 같은 자리를 쓴다.
 * ───────────────────────────────────────────────────────
 *
 * 각 별자리의 `shape.keyStarIds`는 `./stars.ts`에 있는 표본 별들을 가리킨다.
 * 실제 하늘 좌표(RA/Dec)는 이 파일에 없다 — 카드 도안을 그릴 때는
 * Stellarium이나 IAU 별자리 경계도 같은 공인 자료로 실제 모양을
 * 다시 확인해야 한다. 여기서 보증하는 것은 "이 별들로 이루어진다"까지다.
 */
export const DRAFT_CONSTELLATIONS: readonly ConstellationCard[] = [
  {
    id: 'rc-orion',
    name: { korean: '오리온자리', international: 'Orion' },
    cardNumber: 1,
    bestSeasonKR: ['winter'],
    shape: {
      keyStarIds: [
        'star-betelgeuse',
        'star-rigel',
        'star-bellatrix',
        'star-saiph',
        'star-alnitak',
        'star-alnilam',
        'star-mintaka',
      ],
      description:
        '어깨에 베텔게우스(붉은빛)와 벨라트릭스, 발에 리겔과 사이프를 두고, 가운데 세 별(민타카·알닐람·알니타크)이 허리띠처럼 가로로 늘어선 모래시계 모양.',
    },
    astronomy: {
      story:
        '그리스 신화의 사냥꾼 오리온. 밤하늘에서 가장 뚜렷한 별자리 중 하나로, 세계 거의 모든 문화가 이 "허리띠 세 별"을 저마다의 이름으로 불러 왔다.',
      facts: [
        '베텔게우스(어깨)는 적색초거성, 리겔(발)은 청백색 초거성이라 두 별의 색 대비가 눈으로도 또렷하다.',
        '허리띠의 세 별(민타카·알닐람·알니타크)은 밝기가 비슷해 일직선으로 늘어선 모습이 유난히 눈에 띈다.',
      ],
      verification: 'verified',
      sources: [{ note: '여러 출처 교차 확인(Wikipedia 각 별 항목, constellation-guide.com)' }],
    },
    comfort: {
      theme: '겨울 하늘 한가운데서 가장 먼저 눈에 띄는, 서로 다른 빛이 나란히 선 자리',
      message:
        '붉은 어깨와 흰 발이 나란히 서 있습니다. 서로 다른 빛도 하나의 자리를 이룰 수 있습니다.',
    },
    draft: false,
  },
  {
    id: 'rc-canis-major',
    name: { korean: '큰개자리', international: 'Canis Major' },
    cardNumber: 2,
    bestSeasonKR: ['winter'],
    shape: {
      keyStarIds: ['star-sirius', 'star-mirzam', 'star-wezen', 'star-adhara', 'star-aludra'],
      description:
        '가장 밝은 시리우스를 머리로, 베자·웨즌·아다라·알루드라가 몸통과 꼬리 쪽으로 이어지는 개의 옆모습.',
    },
    astronomy: {
      story:
        '오리온이 데리고 다니는 사냥개로 그려진다. 알파성 시리우스는 태양을 제외하면 지구에서 보는 가장 밝은 별이다.',
      facts: [
        '시리우스는 지구에서 약 8.6광년 거리로, 밝은 별 중에서는 지구와 매우 가까운 편이다.',
        '같은 별자리 안에서도 별마다 거리 차이가 아주 크다(시리우스 8.6광년 vs 알루드라 약 3,000광년) — 하늘에서 나란히 보여도 실제 거리는 전혀 다르다.',
      ],
      verification: 'verified',
      sources: [{ note: 'Wikipedia: Sirius / star-facts.com: Mirzam, Adhara, Aludra' }],
    },
    comfort: {
      theme: '가장 가까운 빛과 가장 먼 빛이 나란히 서 있는 자리',
      message:
        '같은 별자리 안에도 아주 가까운 빛과 아주 먼 빛이 함께 있습니다. 거리가 달라도 같은 하늘을 이룰 수 있습니다.',
    },
    draft: false,
  },
  {
    id: 'rc-taurus',
    name: { korean: '황소자리', international: 'Taurus' },
    cardNumber: 3,
    bestSeasonKR: ['winter'],
    shape: {
      keyStarIds: ['star-aldebaran', 'star-elnath', 'star-alcyone'],
      description:
        'V자 모양의 뿔(히아데스성단) 끝에 붉은 눈(알데바란)이 있고, 등 쪽으로 좀 떨어진 자리에 작은 점들이 뭉쳐 보이는 플레이아데스성단이 있다.',
    },
    astronomy: {
      story:
        '제우스가 변신했다는 황소. 등 위의 플레이아데스는 그리스 신화에서 "일곱 자매"로 불리며, 세계 여러 문화에서 독립된 이름으로도 불려 온 뭉친 별무리다.',
      facts: [
        '플레이아데스성단은 지구에서 약 444광년 거리에 있고, 맨눈으로도 여러 개의 별이 뭉쳐 보인다.',
        '알데바란(눈)은 같은 시야에 보이는 히아데스성단과 실제로는 관계가 없다 — 알데바란이 히아데스보다 지구에 훨씬 가깝다(약 67광년 vs 히아데스 중심 약 153광년).',
      ],
      verification: 'verified',
      sources: [{ note: 'Wikipedia: Aldebaran, Hyades (star cluster); messier-objects.com: M45' }],
    },
    comfort: {
      theme: '따로 보여도 실은 한 무리인, 흩어진 자매들의 자리',
      message: '멀리서는 하나의 흐린 빛처럼 보여도, 가까이 가면 저마다 다른 이름을 가진 별들입니다.',
    },
    draft: false,
  },
  {
    id: 'rc-ursa-major',
    name: { korean: '큰곰자리', international: 'Ursa Major' },
    cardNumber: 4,
    bestSeasonKR: ['spring'],
    shape: {
      keyStarIds: [
        'star-dubhe',
        'star-merak',
        'star-phecda',
        'star-megrez',
        'star-alioth',
        'star-mizar',
        'star-alkaid',
      ],
      description:
        '북두칠성 일곱 별이 국자 모양을 이룬다. 국자의 끝(두베·메라크) 두 별을 잇는 선을 그대로 늘이면 북극성 방향과 가까워진다.',
    },
    astronomy: {
      story:
        '북두칠성은 큰곰자리의 일부다. 한국·중국을 비롯한 동아시아에서도 오래전부터 방위와 계절을 가늠하는 별자리로 널리 쓰였다.',
      facts: [
        '두베와 메라크를 잇는 선을 연장하면 북극성 방향을 대략 찾을 수 있다는 것은 실제로 쓰이는 길잡이 방법이다.',
        '미자르는 맨눈으로도 희미하게 옆의 알코르와 함께 보일 수 있는, 오래전부터 알려진 겹별 자리다.',
      ],
      verification: 'verified',
      sources: [{ note: 'Wikipedia: Big Dipper, Alcor (star); constellation-guide.com: Big Dipper' }],
    },
    comfort: {
      theme: '그 자체로 길을 알려 주는, 늘 그 자리에 있는 국자',
      message: '길을 잃은 밤에도 국자 모양의 일곱 별이 북쪽을 가리켜 줍니다.',
    },
    draft: false,
  },
  {
    id: 'rc-leo',
    name: { korean: '사자자리', international: 'Leo' },
    cardNumber: 5,
    bestSeasonKR: ['spring'],
    shape: {
      keyStarIds: ['star-regulus', 'star-denebola', 'star-algieba'],
      description:
        '레굴루스가 사자의 가슴·앞다리, 알지에바가 갈기, 데네볼라가 꼬리 끝에 서 있는, 낫 모양 머리와 삼각형 몸통.',
    },
    astronomy: {
      story: '사자자리는 서양 황도 12궁 중 하나로, 레굴루스라는 이름은 "작은 왕"이라는 뜻을 담고 있다.',
      facts: [
        '레굴루스는 황도(태양이 지나는 길)에 아주 가까이 있어, 가끔 달이나 행성에 가려지는 일이 생긴다.',
        '알지에바는 눈으로는 하나지만 실제로는 금빛을 띠는 두 개의 거성이 서로를 돌고 있는 쌍성이다.',
      ],
      verification: 'verified',
      sources: [{ note: 'Wikipedia: Regulus; Gamma Leonis(Algieba)' }],
    },
    comfort: {
      theme: '작은 왕의 자리를 지키며, 늘 태양이 다니는 길 가까이에 선 별',
      message: '가장 바쁜 길목에서도 제자리를 지키는 빛이 있습니다.',
    },
    draft: false,
  },
  {
    id: 'rc-bootes',
    name: { korean: '목동자리', international: 'Boötes' },
    cardNumber: 6,
    bestSeasonKR: ['spring'],
    shape: {
      keyStarIds: ['star-arcturus', 'star-izar', 'star-seginus', 'star-muphrid'],
      description:
        '아르크투루스를 맨 아래 꼭짓점으로, 위로 갈수록 좁아지는 연 모양(카이트 아스터리즘).',
    },
    astronomy: {
      story:
        '곰(큰곰자리)을 지키는 목동으로 그려진다. 북두칠성의 손잡이 곡선을 그대로 따라가면 아르크투루스에 닿는다는 길잡이 방법으로도 알려져 있다.',
      facts: [
        '아르크투루스는 북반구 밤하늘에서 가장 밝은 별 중 하나로, 봄철 저녁 하늘의 대표적인 길잡이 별이다.',
        '이자르는 금빛과 청백색, 두 색이 또렷이 다른 두 별이 함께 있는 쌍성이다.',
      ],
      verification: 'verified',
      sources: [{ note: 'Wikipedia: Arcturus, Izar(Epsilon Boötis)' }],
    },
    comfort: {
      theme: '곰을 지키려 밤새 그 자리를 지키는 목동의 별',
      message: '누군가를 지키려 밤새 깨어 있는 자리가 있습니다.',
    },
    draft: false,
  },
  {
    id: 'rc-lyra',
    name: { korean: '거문고자리', international: 'Lyra' },
    cardNumber: 7,
    bestSeasonKR: ['summer'],
    shape: {
      keyStarIds: ['star-vega', 'star-sheliak', 'star-sulafat'],
      description: '베가를 꼭짓점으로, 아래쪽에 작은 평행사변형이 매달린 모양.',
    },
    astronomy: {
      story:
        '오르페우스가 연주했다는 리라(현악기)로 그려진다. 동아시아 전통에서는 베가를 "직녀성"이라 불러, 견우(독수리자리의 알타이르)와 1년에 한 번 만난다는 이야기로 전해진다.',
      facts: [
        '베가는 북반구 밤하늘에서 가장 밝은 별 중 하나이며 여름철 대삼각형의 한 꼭짓점이다.',
        '쉴리아크(베타 거문고자리)는 약 13일 주기로 밝기가 눈에 보일 만큼 변하는 식변광성이다.',
      ],
      verification: 'verified',
      sources: [{ note: 'Wikipedia: Vega, Beta Lyrae' }],
    },
    comfort: {
      theme: '1년에 한 번, 그래도 다시 만나는 자리',
      message: '지금은 멀어도, 돌아오는 계절마다 같은 자리에서 다시 떠오릅니다.',
    },
    draft: false,
  },
  {
    id: 'rc-cygnus',
    name: { korean: '백조자리', international: 'Cygnus' },
    cardNumber: 8,
    bestSeasonKR: ['summer'],
    shape: {
      keyStarIds: ['star-deneb', 'star-albireo', 'star-sadr', 'star-gienah'],
      description: '데네브를 꼬리, 알비레오를 부리로 둔 큰 십자가 모양(북십자).',
    },
    astronomy: {
      story: '날아가는 백조로 그려진다. "북십자"라는 별명으로도 불리는, 여름 밤하늘의 큰 십자 모양.',
      facts: [
        '데네브는 지구에서 약 2,000광년 넘게 떨어져 있는데도 맨눈으로 또렷이 보일 만큼 실제로는 엄청나게 밝은 별이다.',
        '알비레오는 금빛과 청빛, 색이 또렷이 다른 두 별이 쌍을 이루는, 작은 망원경으로도 아름답게 보이는 쌍성이다.',
      ],
      verification: 'verified',
      sources: [{ note: 'Wikipedia: Deneb, Albireo' }],
    },
    comfort: {
      theme: '아주 먼 곳에서 지금 막 닿은 빛, 그리고 서로 다른 색으로 함께 있는 빛',
      message: '아주 오래전에 떠난 빛이 지금 당신에게 닿고 있습니다.',
    },
    draft: false,
  },
  {
    id: 'rc-scorpius',
    name: { korean: '전갈자리', international: 'Scorpius' },
    cardNumber: 9,
    bestSeasonKR: ['summer'],
    shape: {
      keyStarIds: ['star-antares', 'star-dschubba', 'star-shaula', 'star-sargas'],
      description:
        '안타레스가 심장, 드슈바가 머리 쪽 집게, 샤울라와 사르가스가 구부러진 꼬리 끝의 독침.',
    },
    astronomy: {
      story:
        '그리스 신화에서 오리온을 쏘아 죽였다는 전갈. 두 별자리가 하늘에서 거의 마주보는 자리(한쪽이 뜨면 다른 쪽이 지는 자리)에 있다는 점이 그 이야기와 함께 전해진다.',
      facts: [
        '안타레스는 밝기가 불규칙하게(약 0.6~1.6등급 사이) 변하는 적색초거성이다.',
        '꼬리의 구부러진 모양은 다른 별자리와 혼동하기 어려울 만큼 독특해, 여러 문화에서 공통적으로 "갈고리"나 "낚싯바늘"로 읽혔다.',
      ],
      verification: 'verified',
      sources: [{ note: 'Wikipedia: Antares, Scorpius' }],
    },
    comfort: {
      theme: '같은 하늘에 함께 있을 수 없어, 서로 다른 계절에 피어나는 빛',
      message: '같은 시간, 같은 자리에 있지 못해도 각자의 계절에 선명하게 빛날 수 있습니다.',
    },
    draft: false,
  },
  {
    id: 'rc-pegasus',
    name: { korean: '페가수스자리', international: 'Pegasus' },
    cardNumber: 10,
    bestSeasonKR: ['autumn'],
    shape: {
      keyStarIds: ['star-markab', 'star-scheat', 'star-enif', 'star-algenib'],
      description:
        '마르카브·스카트·알제닙(그리고 안드로메다자리의 알페라츠)이 큰 사각형을 이루고, 에닙이 그 바깥으로 목 쪽에 선다.',
    },
    astronomy: {
      story: '날개 달린 말. 네 별이 이루는 "가을의 대사각형"은 가을 밤하늘에서 길을 찾는 대표적인 기준이다.',
      facts: [
        '에닙은 평소에는 조용하다가 아주 드물게 갑자기 밝아지는 폭발적인 변광을 보이는 것으로 알려져 있다.',
        '사각형의 한 꼭짓점(알페라츠)은 원래 페가수스자리의 별로 그려졌다가, 지금은 국제적으로 안드로메다자리의 별로 정리되어 있다 — 두 별자리가 한 별을 나누어 썼던 흔적이다.',
      ],
      verification: 'verified',
      sources: [{ note: 'Wikipedia: Epsilon Pegasi, Alpheratz' }],
    },
    comfort: {
      theme: '날개를 펴고, 가을 하늘에 큰 사각의 문을 여는 자리',
      message: '늘 조용하던 빛도 때로는 예상치 못하게 환해질 수 있습니다.',
    },
    draft: false,
  },
  {
    id: 'rc-andromeda',
    name: { korean: '안드로메다자리', international: 'Andromeda' },
    cardNumber: 11,
    bestSeasonKR: ['autumn'],
    shape: {
      keyStarIds: ['star-alpheratz', 'star-mirach', 'star-almach'],
      description: '알페라츠에서 미라크, 알마크로 이어지는 완만한 두 줄의 선.',
    },
    astronomy: {
      story:
        '바다 괴물에게 바쳐질 운명이었다가 페르세우스에게 구출되는 공주 안드로메다. 이 별자리 방향에는 맨눈으로도 보이는, 우리 은하 바로 옆의 안드로메다 은하(M31)가 있다.',
      facts: [
        '미라크는 밝기가 조금씩 변하는 것으로 의심되는 거성이다.',
        '알마크는 금빛 별과 청백색 별이 뚜렷이 대비되는, 눈으로 보기에 아름다운 쌍성(실제로는 네 개의 별로 이루어진 다중성)이다.',
      ],
      verification: 'verified',
      sources: [{ note: 'Wikipedia: Mirach, Almach(Gamma Andromedae)' }],
    },
    comfort: {
      theme: '묶여 있던 자리에서 구해져, 더 큰 우주로 이어지는 자리',
      message: '힘든 시간 뒤에도 더 멀리, 더 넓은 하늘로 이어질 수 있습니다.',
    },
    draft: false,
  },
  {
    id: 'rc-cassiopeia',
    name: { korean: '카시오페이아자리', international: 'Cassiopeia' },
    cardNumber: 12,
    bestSeasonKR: ['autumn'],
    shape: {
      keyStarIds: ['star-schedar', 'star-caph', 'star-gamma-cas', 'star-ruchbah'],
      description: '다섯 별이 또렷한 W(또는 M) 모양으로 늘어선, 혼동하기 어려운 형태.',
    },
    astronomy: {
      story:
        '허영심으로 벌을 받았다는 왕비 카시오페이아의 이야기로 전해진다. 북극성 가까이에 있어 한국에서는 일 년 내내 밤하늘 어딘가에서 볼 수 있는 별자리다.',
      facts: [
        'W자 모양을 이루는 별 중 감마 카시오페이아는 예측할 수 없이 밝기가 변하는 특이한 변광성이다(이 별은 국제천문연맹의 공식 고유명이 아직 없다).',
        '북극성 둘레를 도는 궤도가 좁아, 한국(북반구 중위도)에서는 계절과 무관하게 거의 늘 지평선 위에서 볼 수 있다.',
      ],
      verification: 'verified',
      sources: [{ note: 'Wikipedia: Cassiopeia (constellation), Gamma Cassiopeiae' }],
    },
    comfort: {
      theme: '계절이 바뀌어도 하늘에서 사라지지 않는, 늘 그 자리의 W',
      message: '어느 계절에 와도, 밤하늘을 올려다보면 같은 모양이 거기 있습니다.',
    },
    draft: false,
  },
] as const
