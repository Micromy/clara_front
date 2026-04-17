# ARIAS Front Mockup — 진행 상황

> 마지막 업데이트: 2026-04-17
> 현재 브랜치: `main` (HEAD: `fb57fdc`)
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
- 타입 변경 시 selected cells / 검색 결과 / chartConfig / derivedFormulas 일괄 초기화
- el-table `reserve-selection` 누수 방지 가드 (`filteredCells`로 화이트리스트)
- 다중 선택, 페이지 간 선택 유지, **드래그 선택** (`useDragSelect` composable)
- 별도 팝업창으로 검색 분리 가능 (`usePopupWindow` — Pinia / Element Plus 공유)
- 상단 검색 테이블에서 `cellType` / `PDK` 컬럼 제거 (드롭다운으로 이미 필터링하므로 중복)

### 3-2. 셀 추가 & Aliasing
- 상단 검색 테이블에서 체크 → **액션 바**의 화살표 클릭 → 하단 Selected Cells에 추가 + **alias 일괄 적용** (프롬프트 입력)
- 같은 alias를 부여하면 차트에서 "By Alias" 그룹핑으로 하나의 시리즈로 묶임

### 3-3. Selected Cells 패널
- **체크박스 (좌측 고정)** + 체크 항목 **일괄 제거** (X 버튼 제거됨)
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

### 3-5. 차트 (ChartDisplay)
- ECharts scatter / line / bar
- Grouping 기준 시리즈 분할 (셀 1개 = 점 1개)
- **인터랙티브 줌** — 마우스 휠, 드래그 팬, Box Zoom, Reset, Save Image (toolbox)
- 기본 zoom: 양쪽 5% 크롭하여 데이터 영역 강조
- **데이터 라벨 토글** — `showLabels` prop으로 점 위에 이름 고정 표시
- **emphasis / blur** — 시리즈 호버 시 다른 시리즈 blur (opacity 0.3)
- **테이블 행 선택 → 차트 하이라이트** 연동
- **범례 우측 세로 배치** (기존 하단 → 오른쪽)
- PNG 내보내기 (Export PNG 버튼)

### 3-6. 차트 페이지
- ChartView 좌/우 분할 (차트 70% / Source Data 30%)
- Splitter 클릭 → 테이블이 차트 위로 **오버레이 슬라이드** (차트 크기 고정)
- **SourceDataTable** — 축 순서(X, Y1, Y2) 기준 컬럼 정렬, Raw / Diff 비교, 컬럼별 −/÷ 오버라이드
- 차트 PNG 내보내기 (테이블 Export PNG 제거)

### 3-7. 빌더 / 탭 관리
- 다중 Builder 탭 + Builder 별 Chart 탭 자동 생성
- **더블클릭으로 탭 이름 인라인 편집** (Builder / Chart 모두, `@keydown.stop` 으로 backspace 누수 차단)
- 새 Builder 추가, 닫기

### 3-8. 레이아웃
- 상단 / 하단 **드래그 splitter** — 상단 높이만 조절, 하단은 자체 크기 유지
- 컨텐츠가 뷰포트 넘으면 페이지 스크롤
- 우측 ChartConfigPanel 360px 고정

### 3-9. 영속성
- localStorage 자동 저장: `builders` (selectedCellIds / chartConfig / derivedFormulas / name), `cellAliases`, `activeBuilderIndex`
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
- **드래그 splitter** — 상단 높이 조절
- **SelectedCellsPanel** — 선택된 셀 메타/시뮬 비교 (좌하)
- **ChartConfigPanel** — 차트/축/그룹/Derived Metrics 설정 (우하, 360px 고정)

### 5-2. Chart 탭 (`/chart/:builderId`)
- **ChartDisplay** — ECharts 차트 (좌, 인터랙티브 줌)
- **SourceDataTable** — 차트 데이터 테이블 (우, 오버레이 슬라이드)
- 차트 PNG / 테이블 PNG 내보내기

### 5-3. 공통
- **AppLayout** — 헤더 + 탭바 + `<router-view>`. 탭 더블클릭으로 이름 편집
- **CellSearchPopupRoot** — 별도 윈도우에서 검색 (Pinia store 공유, Element Plus teleport 리다이렉트)

---

## 6. 로컬 개발

```bash
npm install
npm run dev         # http://localhost:5173/clara_front/
npm run build       # 프로덕션 빌드 (dist/)
npm run preview     # 빌드 결과 확인
```

`public/data/*.json` 직접 편집 가능 — dev 서버에서 즉시 반영, 빌드 불필요.

---

## 7. 배포

- **URL**: https://micromy.github.io/clara_front/
- **워크플로**: `.github/workflows/deploy.yml`
- **트리거 브랜치**: `main`, `snp`, `claude/*` — push 시 자동 빌드 + 배포
- **브랜치별 서브디렉토리**: feature 브랜치는 `/clara_front/{slug}/`에 배포 (예: `claude/ui-improvements` → `/clara_front/ui-improvements/`). `main`은 루트(`/clara_front/`)에 배포. `peaceiris/actions-gh-pages@v4` + `destination_dir` + `keep_files: true`.

---

## 8. 알려진 이슈 / 향후 개선

- **ECharts 번들 사이즈** — `dist/assets/index-*.js` ≈ 1.17MB (gzip 377KB). tree-shakable import + 코드 스플리팅 필요
- **Save Preset** — 버튼만 존재, 동작 미구현 (현재는 localStorage 자동 저장만)
- **localStorage 마이그레이션** — `builders` 스키마 변경 시 충돌 가능. 버전 키 도입 필요
- **반응형** — 모바일/태블릿 레이아웃 미검증

---

## 9. 백엔드 전환 계획

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

| 메서드 | 경로 | 응답 |
|---|---|---|
| GET | `/api/cells` | 메타 배열 |
| GET | `/api/cells/:id` | 단일 셀 메타 |
| GET | `/api/simulations` | `{ cellId: {...} }` |
| GET | `/api/simulations/:cellId` | 단일 셀 시뮬 |
| GET | `/api/column-config` | 컬럼/차트 옵션 |

---

## 10. 백로그

> 2026-04-16 회의 결과 + 기존 기술 백로그를 영역별로 정리.

### 10-1. 셀 검색 & 선택 (상단)
- [x] Search 시 **AND 조합** 지원 (Cell Name 검색 + 컬럼 필터를 모두 만족하는 결과만)
- [x] 상단에 **PDK / Library 드롭다운** 추가 — 선택된 값에 해당하는 데이터 전부 쿼리
- [x] **Library 드롭다운은 다중 선택** 지원
- [x] 필터 변경 시 **Search 버튼 누르지 않고 즉시** 목록 업데이트
- [x] 팝업 검색창에서 **페이지당 표시 개수 선택** 옵션 (이미 메인은 있음, 팝업도 동일하게)
- [x] 컬럼 헤더의 **필터 / 정렬 아이콘 위치 변경** + 컬럼 우측에 고정
- [ ] 컬럼 너비 **auto** (각 컬럼 max 너비만 지정, 콘텐츠에 맞춰 자동 축소) — fixed width 유지 중
- [x] Diff / Ratio **백분율 표시**, 자릿수 정렬

### 10-2. Cell 선택 & Aliasing
- [x] 상단에서 여러 셀 선택 후 **화살표 클릭으로 하단에 추가** + 선택 항목들에 **alias 일괄 적용** (같은 alias 부여 → "By Alias" 그룹핑으로 차트에서 묶임)

### 10-3. Selected Cells (하단)
- [x] **좌측 체크박스 추가** + **우측 X 버튼 제거**
- [x] 체크된 항목 **일괄 제거** 액션

### 10-4. 차트 탭
- [x] 범례 별 색상을 **차트 우측**에 표시
- [x] 우측 테이블 행 선택 시 좌측 차트의 해당 점 **highlight**
- [x] 차트 데이터 점에 **이름/정보 라벨 고정 토글** (호버가 아닌 영구 표시)
- [x] 범례 위치를 **차트 좌/우**로 이동 (현재 하단)
- [x] 테이블 **Export PNG 제거**

### 10-5. 기술적 개선
- [ ] 실제 백엔드 연동 — `src/api/cells.js` fetch URL 교체
- [ ] ECharts tree-shaking + 코드 스플리팅으로 번들 다이어트
- [ ] Save Preset 실동작 구현 (명명된 preset 라이브러리)
- [ ] localStorage 스키마 버전 키 + 마이그레이션 정책
- [ ] 반응형 (모바일/태블릿 레이아웃) 검토
