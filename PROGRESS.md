# ARIAS Front Mockup — 진행 상황

> 마지막 업데이트: 2026-04-14
> 현재 작업 브랜치: `claude/arias-rebrand-and-features` (HEAD: `e740152`)
> 리포: `Micromy/clara_front`

---

## 1. 프로젝트 개요

**ARIAS** — 반도체 셀 라이브러리 분석 프론트엔드 목업. 셀 메타데이터와 시뮬레이션(V-I 특성) 데이터를 검색·선택하고 차트로 시각화하는 Vue 3 SPA. 추후 백엔드 REST API와 연동 예정.

원본 리포 `park-sungil/clara-front-mockup` 를 `Micromy/clara_front`로 복사한 뒤 리브랜딩 및 기능 확장 중.

---

## 2. 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Vue 3 (Composition API, `<script setup>`) |
| 빌드 | Vite **4.5.5** |
| Vue 플러그인 | `@vitejs/plugin-vue` **4.6.2** |
| UI 라이브러리 | Element Plus 2.13 (+ `@element-plus/icons-vue`) |
| 상태 관리 | Pinia 3 |
| 라우팅 | Vue Router 4 (Hash history — GH Pages 호환) |
| 차트 | ECharts 6 + vue-echarts |
| 패키지 매니저 | npm (Node 20+) |
| 배포 | GitHub Pages (GitHub Actions) |

---

## 3. 지금까지 완료된 작업

### 3-1. 프로젝트 복사 + 배포 환경 구축
- 원본 리포에서 소스 전체 복사 (`7c5d6cf`)
- Vite / plugin-vue 다운그레이드 (4.5.5 / 4.6.2) (`7920a25`)
- GitHub Actions 기반 GH Pages 배포 워크플로 추가 (`a95765c`, `3b31092`)
  - `base: '/clara_front/'` 설정, 해시 라우팅 채택
  - 배포 URL: `https://micromy.github.io/clara_front/`
  - 현재 환경 보호 룰에서 허용 브랜치 수동 추가 필요

### 3-2. ARIAS 리브랜딩 + 기능 5종 (`1ff2bec`)
- `CLARA` → `ARIAS` 변경, 부제 삭제
- Selected Cells 패널에 **Metadata ↔ Simulation 토글** (el-switch, 컬럼 세트 교체)
- Simulation 모드에서 **Diff / Ratio 비교 연산** (el-segmented + alias 드롭다운으로 reference 선택)
- ChartView에 **클릭 토글 스플리터** (기본 7:3 ↔ 클릭 시 3:7)
- ChartDisplay에 `ResizeObserver` 추가 → 스플리터 변경 시 ECharts 자동 리사이즈
- ChartConfigPanel의 Generate/Save 버튼을 `el-form-item`으로 감싸 정렬 보정

### 3-3. Mock 데이터 파일화 + API 레이어 (`78238f1`)
- `public/data/cells.json`, `public/data/column-config.json` 파일 기반으로 전환
- `src/api/cells.js` 추상화 레이어 (`fetchCells`, `fetchColumnConfig`)
- `builderStore.init()` 비동기 초기화, loading/error 상태 노출
- 모든 컬럼·차트 옵션을 JSON에서 로드
- `scripts/generate-mock-data.js` + `npm run generate-mock` 으로 mock 재생성

### 3-4. 메타 / 시뮬 엔드포인트 분리 (`0001a76`)
- `cells.json` (메타, 43KB) + `simulations.json` (시뮬 결과, 159KB) 두 파일로 분리
- `fetchSimulations()` 추가 (+ future-proofing용 `fetchSimulation(cellId)`)
- `store.selectedCells` computed가 `simulations[cellId]`를 자동 merge → 컴포넌트 코드 무변경
- 실제 백엔드 `GET /cells` / `GET /simulations` 엔드포인트 구조에 대응

### 3-5. 차트 오버레이 스플리터 + 트랜스포즈 테이블 (`b6fe985`, `eb8452e`)
- ChartView: 스플리터 토글 시 차트가 리사이즈되는 대신 테이블이 차트 위로 슬라이드 (차트 크기 고정)
- ChartDisplay: legend scroll + width + pagination 지정, `grid.bottom` 확대로 범례/축 겹침 해소
- SourceDataTable: 축 순서(X, Y1, Y2) 기준 컬럼 정렬, 셀 1개 = 1행 유지
- BuilderView: bottom-section `min-height` 680px로 확대 → ChartConfigPanel 9개 폼 항목이 오버플로 없이 수용

### 3-6. 스칼라 기반 차트로 전환 (`b5771a7`) — 데이터 모델 변경
실제 데이터는 셀당 시뮬값 스칼라 하나씩만 존재하므로 `ivData` 배열을 제거하고 전 레이어 스칼라화.
- `cellData.js`/`generate-mock-data.js`: `generateIVData` 제거, iPeak/iAvg/delay만 생성
- `simulations.json`: 셀당 3개 스칼라 (ivData 없음)
- `column-config.json`: xAxis → vdd/temp/vth/gateLength/cpp, yAxis → iPeak/iAvg/delay, 기본 차트 scatter
- ChartDisplay: `ivData` 루프 제거 → grouping 필드 기준으로 시리즈 구성 (scatter/line/bar 모두 셀 1개 = 점 1개)
- `docs/01-design.md`: 코드베이스 역작성 요구사항서 추가

### 3-7. Alias/Diff 색상/Derived Formula/차트 테이블 Diff (`a44fa84`)
- **alias / cellName 분리 표시**: SelectedCellsPanel(Alias|CellName 고정 2열), SourceDataTable(Cell 단일 → 분리)
- **Diff 색상 강조**: formatter → template slot, 양수 초록/음수 빨강, ratio 1 기준 대비, ref 행에 "REF" 배지
- **Derived Formula**: `builderStore.derivedFormulas[]` + `computeDerived()`, `__df_{id}` 키로 selectedCells에 자동 주입, ChartConfigPanel "+ Add Derived Metric" 다이얼로그, SelectedCellsPanel에 `f(x)` 태그 렌더
- **SourceDataTable Diff**: Off/Diff/Ratio 세그먼트 + Reference 셀렉터, derived 필드도 대상 포함

### 3-8. Derived Formula 통계 확장 + 컬럼별 Δ/× 독립 토글 (`9c18d4b`)
6가지 formula type 지원: Binary, Math Function(log₁₀/ln/√x/|x|/1/x), Z-score, Relative to Mean, Delta from Mean, % of Max. 통계 기반 타입은 선택 셀 전체 기준 μ/σ/max 2-pass 계산.
컬럼 헤더에 `[Δ|×]` 태그로 컬럼별 diff↔ratio 오버라이드 (전역 모드 변경 시 초기화).

### 3-9. Group Mean/Std + 축별 차트 타입 (`ba097be`, `ac46940`)
- `mean` / `std` formula type + `groupBy` 필드 (alias, cellType, driveStrength, library, feolCorner)
- `chartTypeSecondary` — Y1/Y2 독립 차트 타입(scatter/line/bar)
- Secondary 차트 타입을 primary와 x-axis 호환성 기준으로 clamp (bar는 category x-axis 필요)
- Derived metric 다이얼로그 520px 확장, derived-item flex overflow 방지

### 3-10. 패널 오버플로 수정 + PNG/CSV Export + CSV Import (`3f52fb9`)
- BuilderView: bottom-right 패널 `overflow-y:auto + max-height`로 derived 다수 추가 시 뷰포트 보호
- AppLayout: 차트 탭 close 버그 수정 (`@tab-remove` on el-tabs)
- ChartView: PNG(`getDataURL()`) + CSV 내보내기 툴바
- `CsvImportDialog.vue`: 디버그 전용 CSV 페이스트 → 5행 프리뷰 → `allCells + simulations`에 주입 + 자동 선택, `_debug` 태그로 일괄 제거 가능

### 3-11. Bar chart 버그/Raw↔Diff 2-way/Table PNG/resize/persistence (`0d42d0c`)
- Bar grouping key: alias 비었을 때 `''`로 병합되던 버그 → `cellName` 폴백
- Comparison 모드: 3-way(Off/Diff/Ratio) → **2-way(Raw/Diff)**, 컬럼 토글 라벨 Δ/× → **−/÷**
- SelectedCellsPanel 숫자 포맷: `String(v)` → `formatNum` (iPeak/iAvg 2dp, delay 1dp)
- Table PNG export: `html2canvas`로 `.chart-right` 캡처
- Splitter resize: `toggleSplit()`이 260ms 후 `chartInstance.resize()` 호출, ChartDisplay에 `resize()` expose
- **localStorage persistence (F2)**: builders(selectedCellIds/chartConfig/derivedFormulas/name) + cellAliases + activeBuilderIndex 전량 저장, 첫 렌더 전 동기 복원, `nextBuilderId`/`nextDerivedId` 충돌 방지

### 3-12. Export 버튼 레이아웃 + 전체 테이블 캡처 (`f5fdcd8`, `e740152`)
- CSV Export 제거 (PNG만 유지)
- Chart PNG: 차트 패널 좌상단 absolute
- Table PNG: 테이블 패널 sticky 헤더에 고정, 라벨 "Export PNG"로 통일
- 전체 행 캡처: `html2canvas` 전에 `.el-scrollbar__wrap` / `.el-table__body-wrapper` / `.el-scrollbar` overflow/height 제약을 임시 해제 → `finally`에서 복원

### 3-13. CSV Import(Debug) 제거
- `src/components/debug/CsvImportDialog.vue` 삭제 (+ `debug/` 디렉토리)
- BuilderView: `[Debug] CSV Import` 버튼 / ref / 다이얼로그 / `.debug-csv-btn`·`.top-section-header` 스타일 제거
- builderStore: `addDebugCells` / `clearDebugCells` / `nextDebugId` / `_debug` 경로 제거

---

## 4. 데이터 아키텍처

### 4-1. 파일 구조
```
public/data/
  ├── cells.json              메타데이터 (18개 필드 × 100개 셀)
  ├── simulations.json        시뮬레이션 결과 (per-cell dict)
  └── column-config.json      컬럼/차트 옵션 정의

src/
  ├── api/
  │   └── cells.js            fetch 추상화 (백엔드 전환 시 이 파일만 수정)
  ├── mock/
  │   └── cellData.js         generator 유틸 (scripts에서만 사용)
  └── stores/
      └── builderStore.js     Pinia store — init(), allCells, simulations, config

scripts/
  └── generate-mock-data.js   mock JSON 재생성 스크립트
```

### 4-2. `cells.json` 스키마 (메타데이터)

배열 형태, 각 셀:
```json
{
  "id": 1,
  "cellName": "DFFX8_A7",
  "cellType": "DFF",          // INV | NAND | NOR | BUF | DFF | MUX | AOI | OAI | XOR | XNOR
  "evt": "EVT1",
  "driveStrength": "X8",      // X1 | X2 | X4 | X8 | X12 | X16
  "nanosheet": "NS4",         // NS3 | NS4 | NS5
  "library": "stdcell_svt",
  "gateLength": 14,
  "cpp": 48,
  "cellHeight": 6.5,
  "feolCorner": "FF",         // TT | FF | SS | FS | SF
  "beolCorner": "Cmin",       // Cmax | Cmin | Cnom
  "gdsOverlay": "nom",
  "vth": 0.35,
  "vdd": 0.75,
  "temp": 25,
  "lot": "LOT-A001",
  "wafer": "W03",
  "createTime": "2025-04-13"
}
```

### 4-3. `simulations.json` 스키마 (시뮬 결과) — **스칼라 전환됨 (`b5771a7`)**

셀당 시뮬값 스칼라 3개만 보존. `ivData` 배열은 제거됨.
`cellId(string)` → 시뮬 객체:
```json
{
  "1": { "iPeak": 297.9, "iAvg": 135.7, "delay": 2386.2 },
  "2": { "iPeak": 364.3, "iAvg": 152.6, "delay":  819.1 },
  ...
}
```
차트는 X축(vdd/temp/vth/gateLength/cpp)과 Y축(iPeak/iAvg/delay) 모두 스칼라 기준 — 셀 1개 = 점 1개로 렌더.

### 4-4. `column-config.json` 스키마

- `searchTableColumns[]` — CellSearchTable의 18개 컬럼
- `selectedCellsMetadataColumns[]` — Selected Cells 메타 모드 컬럼
- `selectedCellsSimulationColumns[]` — Selected Cells 시뮬 모드 컬럼 (numeric 플래그로 Diff/Ratio 대상 지정)
- `chartOptions.{chartTypes,xAxisOptions,yAxisOptions,groupingOptions}` — ChartConfigPanel 드롭다운 옵션

### 4-5. 데이터 흐름

```
앱 시작
  └─ App.vue onMounted → store.init()
       └─ Promise.all([
            fetchCells()         GET /data/cells.json
            fetchColumnConfig()  GET /data/column-config.json
            fetchSimulations()   GET /data/simulations.json
          ])

셀 선택 / 차트 생성 시
  └─ store.selectedCells (computed)
       └─ allCells.filter(id∈selected).map(c => ({
            ...c,
            ...simulations[c.id],
            __df_{id}: computeDerived(formula, cell, allSelected)   // derived 자동 주입
          }))
  └─ SelectedCellsPanel:  row.iPeak / row.iAvg / row.delay / row.__df_{id} 접근
  └─ ChartDisplay:        grouping 필드로 시리즈 분할, 셀당 점 1개 scatter/line/bar

영속성
  └─ builders / cellAliases / activeBuilderIndex → localStorage (deep watch)
  └─ 첫 렌더 전 동기 복원, ID 카운터(nextBuilderId/nextDerivedId) 재계산
```

---

## 5. 주요 화면 / 컴포넌트

### 5-1. Builder 탭 (`/builder/:id`)
- **CellSearchTable** (`src/components/builder/`) — 100개 셀 페이징·검색, `store.searchTableColumns` 18컬럼
- **SelectedCellsPanel** — Alias/CellName 2열 고정, Metadata↔Simulation 토글, Raw↔Diff 2-way 모드, 컬럼 헤더 `[−|÷]` 오버라이드, ref 행 "REF" 배지, 색상 강조(양수 초록/음수 빨강), derived 컬럼 `f(x)` 태그
- **ChartConfigPanel** — 차트 타입 / Primary·Secondary Y축 차트 타입 / X·Y1·Y2 / Grouping / **+ Add Derived Metric** 다이얼로그(6 formula types + Group By)

### 5-2. Chart 탭 (`/chart/:builderId`)
- **ChartDisplay** (`src/components/chart/`) — ECharts scatter/line/bar, grouping 기준 시리즈 분할, Y1/Y2 독립 차트 타입(`chartTypeSecondary`, 호환성 clamp), `resize()` 및 `getChartImage()` expose, legend scroll+pagination, `getDataURL()` 기반 PNG export
- **SourceDataTable** — 축 순서(X, Y1, Y2) 기준 컬럼 정렬, Raw/Diff 토글, Reference 선택, PNG export (전체 행 캡처를 위해 scrollbar 제약 임시 해제)
- **Splitter** — 클릭 시 테이블이 차트 위로 **오버레이 슬라이드** (차트 크기 고정, 리사이즈 없음)

---

## 6. 로컬 개발

### 6-1. 설치 및 실행
```bash
npm install
npm run dev         # http://localhost:5173/clara_front/
```

### 6-2. 프로덕션 빌드
```bash
npm run build       # dist/ 생성
npm run preview     # dist/ 서빙 (검증용)
```

### 6-3. Mock 데이터 재생성
```bash
npm run generate-mock           # 기본 100개
npm run generate-mock 50        # 개수 지정
```
→ `public/data/cells.json` + `public/data/simulations.json` 두 파일 덮어쓰기

### 6-4. Mock 직접 편집
- `public/data/*.json` 을 손으로 편집해도 OK (`npm run dev` 에서 즉시 반영, 빌드 불필요)
- 컬럼 추가·제거는 `public/data/column-config.json` 편집만으로 가능

---

## 7. 배포

### 7-1. GitHub Pages 설정
- 워크플로: `.github/workflows/deploy.yml` (push 트리거: `main`, `claude/copy-clara-mockup-6dqyU`, `claude/arias-rebrand-and-features`)
- `actions/configure-pages@v5` with `enablement: true` — Pages 자동 활성화
- 배포 URL: **https://micromy.github.io/clara_front/**

### 7-2. 현재 블로커
GitHub `github-pages` 환경의 **Deployment branches 보호 룰**이 걸려 있어 feature 브랜치 배포가 차단됨. 해결 방법:

1. `https://github.com/Micromy/clara_front/settings/environments` → `github-pages` 선택
2. **Deployment branches** → **Add deployment branch rule** → `claude/arias-rebrand-and-features` 추가
3. Actions 탭에서 Re-run

※ 최종적으로는 `main`에 머지하여 main만 트리거로 남기는 것을 권장.

---

## 8. 알려진 이슈 / 향후 개선점

### 8-1. ~~Chart X축 옵션 ↔ `ivData` 포맷 미스매치~~ ✅ 해결 (`b5771a7`)
`ivData` 배열을 제거하고 스칼라 기반 비교 차트로 전환. xAxis 옵션은 vdd/temp/vth/gateLength/cpp로 재정의.

### 8-2. ECharts 번들 사이즈
- `dist/assets/index-*.js` ≈ 1.17MB (gzip 377KB)
- Vite가 500KB 경고 출력 중
- 향후 개선: `import { LineChart } from 'echarts/charts'` 형태의 **tree-shakable import**로 전환 + 코드 스플리팅

### 8-3. Comparison 모드 시 NumericFormatter 세밀도
Ratio 모드 값이 소수 4자리로 고정. 매우 작은 차이가 잘 안 보일 수 있음 — 사용자 피드백에 따라 조정 가능.

### 8-4. ~~Selected Cells 패널의 "+ Add Derived Metric"~~ ✅ 해결 (`a44fa84`, `9c18d4b`, `ba097be`)
실동작 구현됨 — 6종 formula type + Group By(mean/std) 지원.

### 8-5. Save Preset
버튼만 존재, 클릭 시 동작 없음. 현재 선택 상태는 localStorage에 자동 저장되므로 "명명된 preset 라이브러리" 수준의 기능은 미구현.

### 8-6. localStorage 마이그레이션 정책
`builders` 스키마가 바뀌면 이전 버전 저장 데이터가 복원 단계에서 충돌할 수 있음. 현재는 방어 로직 없음 — 필드 추가 시 optional chaining/fallback으로 처리하되, 구조 변경 시 버전 키 도입 필요.

---

## 9. 백엔드 전환 계획

실제 API가 준비되면 **`src/api/cells.js` 한 파일만** 수정하면 됩니다. 스토어·컴포넌트 전부 무변경.

### 9-1. 직접 교체 (bulk 엔드포인트 있을 때)
```js
// src/api/cells.js
export async function fetchCells() {
  const res = await fetch('https://api.micromy.com/v1/cells', {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
}

export async function fetchSimulations() {
  const res = await fetch('https://api.micromy.com/v1/simulations', {
    headers: { Authorization: `Bearer ${token}` }
  })
  return res.json()   // { cellId: {...} } 포맷 유지
}
```

### 9-2. Lazy fetch (per-cell 엔드포인트만 있을 때)
페이로드 큰 경우, 선택된 셀의 시뮬만 요청하도록 전환:

1. `src/api/cells.js` 에서 `fetchSimulation(cellId)` 를 per-cell 엔드포인트로 변경 (예약된 자리 이미 있음)
2. `builderStore`:
   - `simulations` 를 Map으로 유지 (이미 dict)
   - `watch(selectedCellIds, async (ids) => { for (const id of ids) if (!simulations[id]) simulations[id] = await fetchSimulation(id) })` 패턴 추가
3. `selectedCells` computed 의 merge 로직은 그대로 동작

### 9-3. 예상 백엔드 REST 인터페이스

| 메서드 | 경로 | 응답 |
|---|---|---|
| GET | `/api/cells` | 메타 배열 (`cells.json`과 동일 구조) |
| GET | `/api/cells/:id` | 단일 셀 메타 |
| GET | `/api/simulations` | `{ cellId: {iPeak,iAvg,delay,ivData} }` |
| GET | `/api/simulations/:cellId` | 단일 셀 시뮬 |
| GET | `/api/column-config` | 컬럼/차트 옵션 config |

---

## 10. 커밋 히스토리 (요약, 최신 → 과거)

| Hash | 요약 |
|---|---|
| `e740152` | Export PNG: 버튼 라벨 통일, 좌상단 배치, 전체 테이블 캡처 수정 |
| `f5fdcd8` | Export 버튼 재배치, CSV export 제거 |
| `0d42d0c` | Bar chart 버그, Raw/Diff 2-way, Table PNG, resize, localStorage persistence |
| `3f52fb9` | 패널 overflow/탭 close 수정, Chart PNG/CSV export, CSV import 다이얼로그 |
| `ac46940` | Derived 다이얼로그 520px 확장, secondary 차트 타입 x-axis 호환성 clamp |
| `ba097be` | Group Mean/Std formula + 축별(Y1/Y2) 독립 차트 타입 |
| `9c18d4b` | Derived formula 통계 확장(6종) + 컬럼별 Δ/× 독립 토글 |
| `a44fa84` | alias/cellName 분리, diff 색상 강조, Derived Formula 구현, SourceTable Diff |
| `b5771a7` | `ivData` 제거 → 스칼라 기반 차트로 전환 |
| `eb8452e` | SourceTable 축 순서 기준 컬럼 정렬, ChartConfigPanel 높이 수용 |
| `b6fe985` | 차트 위로 테이블 오버레이 스플리터, legend 겹침 수정, transposed table |
| `79d715f` | PROGRESS.md 스냅샷 추가 |
| `0001a76` | 메타/시뮬 JSON 엔드포인트 분리 |
| `78238f1` | cells + column config를 public/data JSON + API 레이어로 리팩터 |
| `1ff2bec` | ARIAS 리브랜딩, 시뮬 토글, 차트 스플리터 (기능 5종) |
| `3b31092` | GH Pages auto-enable (configure-pages enablement) |
| `a95765c` | GH Pages 배포 워크플로 추가 |
| `7920a25` | Vite 4.5.5 + plugin-vue 4.6.2 다운그레이드 |
| `7c5d6cf` | park-sungil/clara-front-mockup에서 프로젝트 복사 |

---

## 11. 다음에 할 수 있는 것들

- [ ] `main`에 머지 + 환경 보호 룰 정리 → 공식 배포 URL 안정화
- [x] ~~X축/`ivData` 미스매치~~ / ~~Add Derived Metric 실동작~~ — 완료
- [x] ~~Scalar 시뮬 값 bar chart 모드~~ — 완료 (scatter/line/bar 축별 선택 가능)
- [ ] 실제 백엔드 연동 — `src/api/cells.js` 에서 fetch URL 교체
- [ ] ECharts tree-shaking + 코드 스플리팅으로 번들 다이어트
- [ ] Save Preset (명명된 preset 라이브러리) 실동작 구현
- [ ] localStorage 스키마 버전 키 + 마이그레이션 정책 (위 8-6)
- [ ] 로딩 스피너 스타일 다듬기 / skeleton UI
- [ ] 반응형 (모바일/태블릿 레이아웃) 검토
