# ARIAS Front Mockup — 진행 상황

> 마지막 업데이트: 2026-04-21
> 현재 브랜치: `main` (HEAD: `a637d7f`)
> 리포: `Micromy/clara_front`

---

## 1. 프로젝트 개요

**ARIAS** — 반도체 셀 라이브러리 분석 프론트엔드. **FF / ICG** 두 타입의 셀 메타데이터와 시뮬레이션 결과를 검색·선택하고 차트로 비교 시각화하는 Vue 3 SPA.

---

## 2. 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Vue 3 (Composition API, `<script setup>`) |
| 빌드 | Vite 4.5.5 (`@vitejs/plugin-vue` 4.6.2) |
| UI 라이브러리 | Element Plus 2.13 + `@element-plus/icons-vue` |
| 상태 관리 | Pinia 3 |
| 라우팅 | Vue Router 4 (Hash history) |
| 차트 | ECharts 6 + vue-echarts |
| 패키지 매니저 | npm (Node 20+) |
| 배포 | GitHub Pages (GitHub Actions) |

---

## 3. 구현된 기능

### 3-1. 셀 검색 & 선택
- **CellSearchTable** — 페이지네이션, 컬럼별 정렬, 컬럼 필터 드롭다운, `show-overflow-tooltip`
- **Cell Type 드롭다운** (FF / ICG) — 선택 시 자동 검색, 변경 시 확인 다이얼로그
- **PDK 드롭다운** — 단일 선택, cellType 기반 동적 옵션
- **Library 드롭다운** — 다중 선택 (`multiple` + `collapse-tags`), PDK 변경 시 자동 초기화
- **Cell Name 검색** — 디바운스 300ms, 입력 즉시 필터링 (Search 버튼 불필요)
- Cell Type / PDK / Library 3개 필터 AND 조합으로 검색
- **쉼표 구분 AND 검색** — Cell Name 및 컬럼 필터에서 `DFF, D2` 형태로 다중 조건 검색
- 타입 변경 시 selected cells / 검색 결과 / chartConfig / derivedFormulas 일괄 초기화
- el-table `reserve-selection` 누수 방지 가드 (`filteredCells`로 화이트리스트)
- 다중 선택, 페이지 간 선택 유지, **드래그 선택** (`useDragSelect` composable)
- **이미 선택된 셀 비활성화** — 현재 빌더의 selectedCellIds에 있는 셀은 체크박스 disabled + 행 반투명
- **컬럼 auto-width** — 콘텐츠 길이 기반 자동 너비 계산 (상단 CHAR_WIDTH=8, 하단 CHAR_WIDTH=7)
- **Clear Filters 버튼** — borderless 스타일, hover 시 빨간 톤, disabled 상태 지원
- 별도 팝업창으로 검색 분리 가능 (`usePopupWindow` — Pinia / Element Plus 공유, 다른 모니터 지원)
- 상단 검색 테이블에서 `cellType` / `PDK` 컬럼 제거 (드롭다운으로 이미 필터링하므로 중복)

### 3-2. 셀 추가 & Aliasing
- 상단 검색 테이블 **footer** 에서 Checked 카운트 + Alias 입력 + ↓ Add 버튼
- 같은 alias를 부여하면 차트에서 "By Alias" 그룹핑으로 하나의 시리즈로 묶임

### 3-3. Selected Cells 패널
- **체크박스 (좌측 고정)** + 체크 시 **Remove 버튼** 등장 (fade-in, borderless 스타일, hover 시 빨간색)
- **Alias / Cell Name** 고정 2열 (Cell Name 280px)
- **Metadata ↔ Simulation** 토글 (el-switch)
- **Raw ↔ Diff** 비교 모드 + Reference 셀 선택
- **컬럼별 Diff ↔ Ratio 오버라이드** (`[−|÷]` 토글, 전역 모드 변경 시 초기화)
- Ratio 모드: **백분율 표시** (`+12.34%` / `-5.67%`)
- 색상 강조: 양수 초록 / 음수 빨강 / Reference 행 "REF" 배지
- Derived 컬럼은 `f(x)` 태그
- cellType 에 따라 시뮬 컬럼 셋이 자동 전환 (FF/ICG 별 다른 필드)
- 드래그 선택 지원 (`useDragSelect`)

### 3-4. 차트 설정 (ChartConfigPanel)
- 차트 타입 (scatter / line / bar)
- **X / Y1 / Y2 축** — 활성 cellType 의 옵션만 표시 (자동 전환)
- Primary / Secondary Y 축 **독립 차트 타입** (x-axis 호환성 clamp)
- Grouping (alias / cellType / driveStrength / library / feol)
- **Derived Metrics 다이얼로그** — 6 + 2 종 (Binary, Math Function, Z-score, Relative to Mean, Delta from Mean, % of Max, Group Mean, Group Std)
- cellType 변경 시 chartConfig 기본값(X/Y) + derivedFormulas 자동 리셋
- **Save / Load Preset 버튼** — borderless text 스타일, localStorage 기반 (`arias-chart-presets`)
- **Load Preset 다이얼로그** — preset 테이블 (이름, 타입, 축, 그룹핑 표시) + Apply / Delete

### 3-5. 차트 (ChartDisplay)
- ECharts scatter / line / bar
- Grouping 기준 시리즈 분할 (셀 1개 = 점 1개)
- **Vivid 컬러 팔레트** — `#2563EB`, `#E63946`, `#2D9F46`, `#E88C1E`, `#8B5CF6` 등
- **인터랙티브 줌** — 마우스 휠 X축 줌 + 드래그 팬
- **Box Zoom** — 툴박스 돋보기 아이콘 또는 **Shift+드래그**로 X/Y 양축 영역 확대
- **Shift+더블클릭** — zoom 리셋 (라벨 유지)
- **커스텀 toolbox** — 태그 (라벨 토글), 돋보기+ (box zoom), ↺ (리셋), ↓ (PNG 저장) 커스텀 SVG 아이콘
- **리셋 시 라벨 상태 동기화** — restore 시 labelsOn ref도 false로 리셋
- **데이터 라벨 토글** — 태그 아이콘 클릭으로 on/off, 네모 테두리 + 연결선 + shiftY 겹침 방지 + 드래그 가능
- **Tooltip 소수점 8자리** — 소수점 값은 toFixed(8), 정수는 그대로
- **애니메이션 300ms** — 기본 1000ms에서 단축
- **emphasis / blur** — 시리즈 호버 시 다른 시리즈 blur (opacity 0.3)
- **테이블 행 선택 → 차트 하이라이트** 연동
- **범례 우측 세로 배치** (width 350px, 텍스트 width 320px, right 150, top 50)
- **축 여백** — `boundaryGap: ['5%', '5%']`로 양쪽 끝 여유
- **차트 3:2 비율** — ResizeObserver로 높이 기반 너비 계산 (px 단위, max 80%, min 30%)
- 타이틀 좌상단, 앱 폰트와 통일

### 3-6. 차트 페이지
- ChartView 좌/우 분할 (차트 + Source Data 오버레이)
- **12px 오버랩** — 테이블 패널이 차트 위로 살짝 겹침
- **세로 스플리터** — 매트한 border + box-shadow 스타일, 세로 grip 줄 (48px, 2px, 간격 3px)
- **더블클릭 토글** — 테이블 최소/최대 전환 (중간값 기준)
- **hover 시 grip 색상** — primary color 50% opacity 전환 (0.15s ease)
- **SourceDataTable** — 축 순서(X, Y1, Y2) 기준 컬럼 정렬, Raw / Diff 비교, 컬럼별 −/÷ 오버라이드 (헤더 세로 배치)
- **auto column width** — 데이터 내용 + 헤더 라벨 + 정렬 아이콘 기반 자동 계산
- **정렬 아이콘 우측 정렬** — 헤더 셀 space-between
- 차트 PNG 내보내기 (테이블 Export PNG 제거)

### 3-7. 빌더 / 탭 관리
- 다중 Builder 탭 + Builder 별 Chart 탭 자동 생성
- **2단 탭 바** — 상단: 세트 이름 (30px), 하단: Builder/Chart 서브탭 (26px)
- **비활성 탭 서브탭 표시** — 연한 색으로 Builder/Chart 보이고 직접 클릭 시 해당 세트+뷰로 이동
- **active 탭 underline** — primary color 2px inset box-shadow
- **탭 컨텍스트 메뉴** (`⋯` 아이콘) — Rename / Save / Close
- **Builder 닫기 확인 다이얼로그** — 선택된 셀 수 경고
- **탭 드래그 순서 변경** — builders 배열 직접 조작, 드롭 위치 파란 라인 표시
- **탭 이름 인라인 편집** — 클릭 → 입력 + ✓ 확인
- **Load / + New 버튼** — borderless text 스타일 (New는 primary color + bold)
- **Chart Save** — `store.saveChart()` + 중복 이름 suffix
- **Chart Load 다이얼로그** — 저장된 차트 테이블 + Load / Delete
- 새 Builder 추가 시 빈 검색 상태로 시작, `nextUntitledName()` 자동 번호

### 3-8. 레이아웃
- 상단 / 하단 **드래그 splitter** — 가로 grip 줄 (72px, 2px, 간격 3px), 4px 드래그 dead zone
- **더블클릭** — 기본값(420px) 근처면 확장(800px), 멀면 기본값 복귀 (±80px 임계값)
- **드래그 중 transition 비활성화**, 더블클릭 시 0.25s ease 전환
- **hover 시 grip 색상** — primary color 50% opacity 전환 (0.15s ease)
- 우측 ChartConfigPanel 360px 고정
- 컨텐츠가 뷰포트 넘으면 페이지 스크롤

### 3-9. 영속성
- localStorage 자동 저장: `builders` (selectedCellIds / chartConfig / derivedFormulas / name / **search**), `cellAliases`, `activeBuilderIndex`
- **빌더별 검색 상태 독립** — 빌더 전환 시 search 조건 save/restore (PDK→Library cascade 방지 플래그)
- **Chart Preset CRUD** — localStorage (`arias-chart-presets`), cellType 기반 필터링
- **Saved Charts CRUD** — localStorage (`arias-saved-charts`), hidden preset + chart + items
- 첫 렌더 전 동기 복원
- `nextBuilderId` / `nextDerivedId` 충돌 방지

---

## 4. 데이터 아키텍처

### 4-1. 파일 구조
```
public/data/
  ├── cells.json              메타데이터
  ├── simulations.json        시뮬 결과 (cellId 키)
  └── column-config.json      컬럼/차트 옵션 정의

src/
  ├── api/cells.js            fetch 추상화 (백엔드 전환 시 이 파일만 수정)
  └── stores/builderStore.js  Pinia store
```

### 4-2. `cells.json` 스키마

배열 형태, 각 셀 20개 필드:

```json
{
  "id": 1,
  "cellType": "FF",
  "pdk": "[SF2P] HSPICE: V1.0.0.0 / LVS: V1.0.0.0 / PEX: V1.0.0.0",
  "vendor": "SPIL",
  "cellName": "SDFF_D2_N2_C01L03_SCH168",
  "cell": "SDFF",
  "version": "2025-01-04 09:37",
  "driveStrength": "D2",
  "nanosheet": "N2",
  "gateLength": "L03",
  "cellHeight": "CH168",
  "cpp": "C01",
  "feol": "tt",
  "beol": "nominal",
  "gdsOverlay": "max",
  "library": "DFFASR",
  "vth": "SLVT",
  "vdd": 0.75,
  "temperature": 25,
  "characTool": "PrimeLib"
}
```

- `cellType`: **`FF`** 또는 **`ICG`** — 시뮬 컬럼 / 차트 옵션 / Derived Fields 분기 기준
- `vth`: 문자열 flavor — `ULVT / SLVT / VLVT / LVT / RVT / HVT`
- `vdd`, `temperature`: 숫자 (운영 조건)
- `cellName`: `{cell}_{drive}_{nanosheet}_{cpp}{gateLength}_S{cellHeight}` 패턴

### 4-3. `simulations.json` 스키마

`cellId(string) → 시뮬 객체`. cellType 에 따라 필드 셋이 다름.

**FF (10 필드):**
```json
"1": {
  "dqWorst": 0.12, "dqAvg": 0.08, "cqDelayAvg": 0.06,
  "dSetup3SigmaAvg": 0.04, "dHoldSohmAvg": 0.02,
  "area": 120.5, "ckCap": 3.2, "pLeakage": 1.8,
  "pDyn": 5.4, "pdpAvg": 0.35
}
```

**ICG (11 필드):**
```json
"2": {
  "eeckWorst": 0.18, "eeckAvg": 0.12, "cqDelayAvg": 0.08,
  "eSetup3SigmaAvg": 0.05, "eHoldSohmAvg": 0.03,
  "delayTranRfRatio": 1.2,
  "area": 95.0, "ckCap": 2.1, "pLeakage": 1.1,
  "pDyn": 3.8, "pdpAvg": 0.22
}
```

**공통 필드** (양쪽 모두 포함): `area`, `ckCap`, `pLeakage`, `pDyn`, `pdpAvg`

### 4-4. `column-config.json` 스키마

- `searchTableColumns[]` — 검색 테이블 컬럼 (key, label, width)
- `selectedCellsMetadataColumns[]` — Selected Cells 의 Metadata 모드 컬럼
- `selectedCellsSimulationColumns: { FF: [], ICG: [] }` — Simulation 모드 컬럼 (타입별 분기)
- `chartOptions`:
  - `chartTypes[]` — scatter / line / bar
  - `xAxisOptions: { FF: [], ICG: [] }` — X축 옵션 (타입별 분기)
  - `yAxisOptions: { FF: [], ICG: [] }` — Y축 옵션 (타입별 분기)
  - `groupingOptions[]` — 시리즈 그룹핑

### 4-5. 데이터 흐름

```
앱 시작
  └─ App.vue onMounted → store.init()
       └─ Promise.all([
            fetchCells(),         GET /data/cells.json
            fetchColumnConfig(),  GET /data/column-config.json
            fetchSimulations()    GET /data/simulations.json
          ])

셀 선택 / 차트 생성
  └─ store.selectedCells (computed)
       └─ allCells.filter(id ∈ selected).map(c => ({
            ...c,
            ...simulations[c.id],
            __df_{id}: computeDerived(...)   // derived 자동 주입
          }))

타입 분기
  └─ store.activeCellType (= appliedSearch.cellType)
       └─ selectedCellsSimulationColumns / xAxisOptions / yAxisOptions
          / derivedFields 모두 이 값으로 동적 dereference

영속성
  └─ builders / cellAliases / activeBuilderIndex → localStorage (deep watch)
  └─ 첫 렌더 전 동기 복원
```

---

## 5. 주요 화면 / 컴포넌트

### 5-1. Builder 탭 (`/builder/:id`)
- **CellSearchTable** — 셀 검색·선택 (상단)
- **드래그 splitter** — 가로 grip 줄, 4px dead zone, 더블클릭 확장/복귀
- **SelectedCellsPanel** — 선택된 셀 메타/시뮬 비교 (좌하)
- **ChartConfigPanel** — 차트/축/그룹/Derived Metrics 설정 (우하, 360px 고정)

### 5-2. Chart 탭 (`/chart/:builderId`)
- **ChartDisplay** — ECharts 차트 (좌, 3:2 비율, box zoom + Shift 단축키)
- **SourceDataTable** — 차트 데이터 테이블 (우, 오버레이 + box-shadow, auto column width)
- **세로 스플리터** — 매트한 border 스타일, 더블클릭 토글, grip hover accent
- 차트 PNG 내보내기

### 5-3. 공통
- **AppLayout** — 헤더 + 2단 탭바 (세트명 + Builder/Chart 서브탭) + `<router-view>`
- **CellSearchPopupRoot** — 별도 윈도우에서 검색 (Pinia store 공유, Element Plus teleport 리다이렉트)

---

## 6. UI 디자인 언어

### 6-1. 보조 버튼 (borderless text)
앱 전체에서 보조 액션은 border-less text 버튼으로 통일:
- 기본: `#909399`, hover: `rgba(0,0,0,0.04)` 배경 + `#606266`
- Primary: `var(--clara-primary)` + `font-weight: 600`
- 파괴적 액션 (Remove, Clear Filters): hover 시 `#f56c6c` + 빨간 배경

### 6-2. 스플리터
- **가로 (Builder)**: grip 줄 2개 (72px, 2px, 간격 3px), hover 시 primary 50%
- **세로 (Chart)**: grip 줄 2개 (48px, 2px, 간격 3px), hover 시 primary 50%
- 둘 다 `transition: 0.15s ease`, primary color(`#4078C0`) 공통 accent

### 6-3. 컬럼 너비
- 검색 테이블: 메타데이터 컬럼 65px 통일 (FEOL, BEOL, VDD, Temp, Drive Str 등)
- Selected Cells: 메타 컬럼 70px 통일 + auto-width (데이터 기반 확장)
- Source Data: auto-width (CHAR_WIDTH=7, 헤더+정렬 아이콘 고려)

---

## 7. 로컬 개발

```bash
npm install
npm run dev         # http://localhost:5173/clara_front/
npm run build       # 프로덕션 빌드 (dist/)
npm run preview     # 빌드 결과 확인
```

`public/data/*.json` 직접 편집 가능 — dev 서버에서 즉시 반영, 빌드 불필요.

---

## 8. 배포

- **URL**: https://micromy.github.io/clara_front/
- **워크플로**: `.github/workflows/deploy.yml`
- **트리거 브랜치**: `main`, `snp`, `claude/*` — push 시 자동 빌드 + 배포
- **브랜치별 서브디렉토리**: feature 브랜치는 `/clara_front/{slug}/`에 배포 (예: `claude/ui-improvements` → `/clara_front/ui-improvements/`). `main`은 루트(`/clara_front/`)에 배포. `peaceiris/actions-gh-pages@v4` + `destination_dir` + `keep_files: true`.

---

## 9. 알려진 이슈 / 향후 개선

- **ECharts 번들 사이즈** — `dist/assets/index-*.js` ≈ 1.17MB (gzip 377KB). tree-shakable import + 코드 스플리팅 필요
- **localStorage 마이그레이션** — `builders` 스키마 변경 시 충돌 가능. 버전 키 도입 필요
- **반응형** — 모바일/태블릿 레이아웃 미검증

---

## 10. 백엔드 전환 계획

`src/api/cells.js` 한 파일만 수정하면 됨 (스토어/컴포넌트 무변경).

```js
// src/api/cells.js
export async function fetchCells() {
  const res = await fetch('https://api.example.com/v1/cells', { headers: ... })
  return res.json()
}
export async function fetchSimulations() {
  const res = await fetch('https://api.example.com/v1/simulations', { headers: ... })
  return res.json()   // { cellId: {...} } 포맷 유지
}
```

페이로드가 크면 per-cell lazy fetch 로 전환 가능 (`fetchSimulation(cellId)` 자리 이미 있음).

### 예상 REST 인터페이스

> **chart** = Builder + Chart 탭 전체 상태 (선택 셀, 차트 설정 등)를 저장/불러오기
> **chart_preset** = Chart Configuration (축, 그룹핑, 파생 지표 등) 설정만 저장/불러오기

#### 페이지 초기 로드

| # | 메서드 | 경로 | 설명 | 시점 |
|---|---|---|---|---|
| 1 | GET | `/api/pdks` | PDK 드롭다운 목록 | 페이지 접속 |
| 2 | GET | `/api/libraries` | Library 드롭다운 목록 | 페이지 접속 |
| 3 | GET | `/api/charts` | 저장된 chart 리스트 (load 팝업용) | 페이지 접속 |

#### 셀 검색 (FF/ICG + PDK + Library 셋 다 선택 시)

| # | 메서드 | 경로 | 설명 | 시점 |
|---|---|---|---|---|
| 6 | GET | `/api/cells?cellType=FF&pdk=...&libraries=...` | 검색 조건에 맞는 Cell 리스트 + 시뮬 데이터 | 필터 3개 선택 완료 |
| 7 | GET | `/api/chart-presets?cellType=FF&pdk=...&libraries=...` | 해당 조건의 chart_preset 리스트 | 필터 3개 선택 완료 |

#### Chart 저장/삭제

| # | 메서드 | 경로 | 설명 | 시점 |
|---|---|---|---|---|
| 4 | POST | `/api/charts` | chart 저장 (빌더 상태 전체: 선택 셀, alias, 차트 설정, 파생 지표 등) | 상단 탭 Save |
| 5 | DELETE | `/api/charts/:id` | chart 삭제 | load 팝업에서 삭제 |

#### Chart Preset 저장/삭제

| # | 메서드 | 경로 | 설명 | 시점 |
|---|---|---|---|---|
| 8 | POST | `/api/chart-presets` | chart_preset 저장 (Chart Configuration: 축, 그룹핑, 파생 지표 설정만) | preset save 팝업 |
| 9 | DELETE | `/api/chart-presets/:id` | chart_preset 삭제 | preset load 팝업에서 삭제 |

---

## 11. 백로그

> 2026-04-16 회의 결과 + 기존 기술 백로그를 영역별로 정리.

### 11-1. 셀 검색 & 선택 (상단)
- [x] Search 시 **AND 조합** 지원 (Cell Name 검색 + 컬럼 필터를 모두 만족하는 결과만)
- [x] 상단에 **PDK / Library 드롭다운** 추가 — 선택된 값에 해당하는 데이터 전부 쿼리
- [x] **Library 드롭다운은 다중 선택** 지원
- [x] 필터 변경 시 **Search 버튼 누르지 않고 즉시** 목록 업데이트
- [x] 팝업 검색창에서 **페이지당 표시 개수 선택** 옵션 (이미 메인은 있음, 팝업도 동일하게)
- [x] 컬럼 헤더의 **필터 / 정렬 아이콘 위치 변경** + 컬럼 우측에 고정
- [x] 컬럼 너비 **auto** — 콘텐츠 기반 자동 계산 (calcAutoWidth), 상하단 별도 CHAR_WIDTH
- [x] Diff / Ratio **백분율 표시**, 자릿수 정렬

### 11-2. Cell 선택 & Aliasing
- [x] 상단에서 여러 셀 선택 후 **화살표 클릭으로 하단에 추가** + 선택 항목들에 **alias 일괄 적용** (같은 alias 부여 → "By Alias" 그룹핑으로 차트에서 묶임)

### 11-3. Selected Cells (하단)
- [x] **좌측 체크박스 추가** + **우측 X 버튼 제거**
- [x] 체크된 항목 **일괄 제거** 액션

### 11-4. 차트 탭
- [x] 범례 별 색상을 **차트 우측**에 표시
- [x] 우측 테이블 행 선택 시 좌측 차트의 해당 점 **highlight**
- [x] 차트 데이터 점에 **이름/정보 라벨 고정 토글** (호버가 아닌 영구 표시)
- [x] 범례 위치를 **차트 좌/우**로 이동 (현재 하단)
- [x] 테이블 **Export PNG 제거**
- [x] **Box Zoom** + Shift 단축키 + Shift+더블클릭 리셋
- [x] **Tooltip 소수점 8자리**
- [x] **SourceDataTable auto column width** + 정렬 아이콘 우측 정렬
- [x] 컬럼 헤더 **−/÷ 태그 아래줄 배치** (세로 col-header)

### 11-5. 기술적 개선
- [ ] 실제 백엔드 연동 — `src/api/cells.js` fetch URL 교체
- [ ] ECharts tree-shaking + 코드 스플리팅으로 번들 다이어트
- [ ] localStorage 스키마 버전 키 + 마이그레이션 정책
- [ ] 반응형 (모바일/태블릿 레이아웃) 검토
