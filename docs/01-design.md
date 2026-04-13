# ARIAS 요구사항서 (역작성)

> 작성일: 2026-04-13  
> 작성 방법: 기존 코드베이스(`clara_front`) 분석을 통한 역작성

---

## 1. 프로젝트 개요

**ARIAS** — 반도체 셀 라이브러리 분석 플랫폼

반도체 셀의 메타데이터와 V-I 시뮬레이션 데이터를 검색·선택하고 대시보드에서 시각화하는 Vue 3 기반 단일 페이지 애플리케이션(SPA).

| 항목 | 값 |
|------|-----|
| Repository | `Micromy/clara_front` |
| 배포 URL | `https://micromy.github.io/clara_front/` |
| 배포 플랫폼 | GitHub Pages |
| CI/CD | GitHub Actions (`main`, `claude/arias-rebrand-and-features` 브랜치) |
| 현황 | Mock 데이터 기반 MVP 완성 |

---

## 2. 기술 스택

| 분류 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | Vue 3 (Composition API, `<script setup>`) | 3.5.30 |
| 빌드 도구 | Vite | 4.5.5 |
| UI 라이브러리 | Element Plus | 2.13.6 |
| UI 아이콘 | @element-plus/icons-vue | 2.3.2 |
| 상태 관리 | Pinia | 3.0.4 |
| 라우팅 | Vue Router (Hash 히스토리 모드) | 4.6.4 |
| 차트 | ECharts + vue-echarts | 6.0.0 / 8.0.1 |
| 패키지 관리자 | npm | — |
| Node 버전 | 20+ | — |

---

## 3. 아키텍처

### 3-1. 디렉토리 구조

```
clara_front/
├── public/
│   └── data/
│       ├── cells.json              # 셀 메타데이터 (~43KB, 100개)
│       ├── simulations.json        # 시뮬레이션 결과 (~159KB)
│       └── column-config.json      # UI 컬럼/차트 옵션 정의
├── src/
│   ├── api/
│   │   └── cells.js               # Fetch 추상화 계층 (백엔드 교체 대응)
│   ├── components/
│   │   ├── builder/
│   │   │   ├── CellSearchTable.vue
│   │   │   ├── SelectedCellsPanel.vue
│   │   │   └── ChartConfigPanel.vue
│   │   └── chart/
│   │       ├── ChartDisplay.vue
│   │       └── SourceDataTable.vue
│   ├── layouts/
│   │   └── AppLayout.vue          # 헤더 + 탭바 + 메인 영역
│   ├── views/
│   │   ├── BuilderView.vue
│   │   └── ChartView.vue
│   ├── stores/
│   │   └── builderStore.js        # Pinia 전역 상태
│   ├── router/
│   │   └── index.js
│   ├── mock/
│   │   └── cellData.js            # Mock 데이터 생성 유틸
│   └── assets/
│       └── styles/global.css      # CSS 변수, 리셋
└── scripts/
    └── generate-mock-data.js      # public/data/*.json 재생성
```

### 3-2. 컴포넌트 계층도

```
App.vue (루트, 초기화)
└── AppLayout.vue (헤더 + 탭바)
    └── <RouterView>
        ├── BuilderView.vue  (/builder/:id)
        │   ├── CellSearchTable.vue      (상단 — 검색/필터/페이징)
        │   ├── Divider (접이식)
        │   ├── SelectedCellsPanel.vue   (하단 좌 — 메타/시뮬 비교)
        │   └── ChartConfigPanel.vue     (하단 우 — 차트 설정)
        └── ChartView.vue    (/chart/:builderId)
            ├── ChartDisplay.vue         (좌 — ECharts)
            ├── Splitter (클릭 토글)
            └── SourceDataTable.vue      (우 — 소스 데이터 테이블)
```

### 3-3. 데이터 흐름

```
App.vue 마운트
  └── store.init()  ←  Promise.all([fetchCells, fetchColumnConfig, fetchSimulations])
        ├── store.allCells        (전체 셀 메타데이터)
        ├── store.config          (UI 옵션 정의)
        └── store.simulations     (cellId → 시뮬 결과)

사용자 셀 선택
  └── store.toggleCellSelection(cellId)
        └── store.selectedCells (computed) = allCells.filter() + merge simulations

차트 생성
  └── store.generateChart()
        └── chartTabs에 추가/갱신 → router.push('/chart/:builderId')
```

---

## 4. 페이지 및 라우팅

| Route | 페이지 | 역할 |
|-------|--------|------|
| `/` | — | `/builder/1` 리다이렉트 |
| `/builder/:id` | BuilderView | 셀 검색·선택 + 차트 설정 |
| `/chart/:builderId` | ChartView | 차트 시각화 + 소스 데이터 테이블 |

- **해시 라우터** (`createWebHashHistory`) — GitHub Pages 서브경로 대응
- **탭 기반 네비게이션**: Builder 탭 + Chart 탭 + `+New Builder` 버튼

---

## 5. 기능 요구사항

### FR-1. 셀 검색 및 선택 (CellSearchTable)

- 셀 이름 / 타입 / 라이브러리 텍스트 검색 (대소문자 무시)
- 페이지네이션 (페이지 크기: 10 / 20 / 50 / 100)
- 체크박스 다중 선택, 페이지 전환 시 선택 상태 유지
- 선택 개수 표시

### FR-2. 선택 셀 데이터 표시 (SelectedCellsPanel)

- **Metadata 모드**: Gate Length, CPP, FEOL/BEOL Corner, VDD, Temp 등 18개 필드
- **Simulation 모드**: iPeak, iAvg, delay 및 IV 포인트 데이터
- **비교 연산** (Simulation 모드 전용):
  - `Off`: 절댓값 표시
  - `Diff`: 선택 셀 − Reference 셀
  - `Ratio`: 선택 셀 / Reference 셀 (`×{ratio}` 표기)
- **Reference 셀**: 드롭다운으로 선택된 셀 중 하나 지정
- **Alias 편집**: 셀별 사용자 정의 이름 설정 (차트 범례에 반영)

### FR-3. 차트 설정 및 생성 (ChartConfigPanel)

- Builder 이름 편집
- 차트 유형: `Line` / `Scatter` / `Bar`
- X축 속성: `voltage` / `temp` / `vdd`
- Primary Y축 속성: `currentMA` / `currentUA` / `voltage`
- Secondary Y축 속성 (선택적, None 가능)
- 범례 그룹핑: `alias` / `cellType` / `driveStrength` / `library` / `feolCorner`
- **Generate Chart** 버튼 → Chart 탭 생성 후 이동
- **Save Preset** 버튼 (미구현)

### FR-4. 차트 시각화 (ChartDisplay)

- ECharts 기반 Line / Scatter / Bar 차트
- 다중 셀 동시 표시 (자동 색상 배분)
- Secondary Y축 지원 (활성화 시 오른쪽 Y축 추가)
- 범례 스크롤 (셀이 많을 경우)
- Hover Tooltip
- 자동 리사이즈 (ResizeObserver)

### FR-5. 소스 데이터 테이블 (SourceDataTable)

- 차트에 사용된 셀의 원본 데이터 표시
- IV 커브 포인트 필드: `min ~ max (N pts)` 형식으로 요약
- Scalar 필드: 정확한 값 표시
- 고정 컬럼(Cell명) + 수평 스크롤 가능한 데이터 컬럼

### FR-6. 스플리터 레이아웃 (ChartView)

- 기본 레이아웃: 차트 70% / 테이블 30%
- 스플리터 클릭 시 토글: 차트 30% / 테이블 70%
- 레이아웃 전환 시 ECharts 자동 리사이즈

### FR-7. 다중 Builder / Chart 탭

- Builder 탭 추가 (`+New Builder`), 삭제
- Builder별 독립적인 셀 선택 목록 및 차트 설정 보존
- Builder에서 차트 생성 시 해당 Builder의 Chart 탭 생성/갱신

---

## 6. 데이터 모델

### 6-1. Cell (셀 메타데이터)

```typescript
interface Cell {
  id: number
  cellName: string                    // e.g., "DFFX8_A7"
  cellType: string                    // INV|NAND|NOR|BUF|DFF|MUX|AOI|OAI|XOR|XNOR
  evt: string                         // EVT1|EVT2|EVT3
  driveStrength: string               // X1|X2|X4|X8|X12|X16
  nanosheet: string                   // NS3|NS4|NS5
  library: string                     // stdcell_hvt|stdcell_svt|stdcell_lvt|stdcell_ulvt
  gateLength: number                  // 5|7|12|14
  cpp: number                         // 48|51|54|57
  cellHeight: number                  // 5.0|6.0|6.5|7.5
  feolCorner: string                  // TT|FF|SS|FS|SF
  beolCorner: string                  // Cmax|Cmin|Cnom
  gdsOverlay: string                  // nom|max|min
  vth: number                         // 0.25~0.45
  vdd: number                         // 0.65~0.85
  temp: number                        // -40|0|25|85|125
  lot: string
  wafer: string                       // W01~W06
  createTime: string                  // YYYY-MM-DD
}
```

### 6-2. SimulationResult (시뮬레이션 결과)

```typescript
interface IVPoint {
  voltage: number
  currentMA: number
  currentUA: number                   // = currentMA × 1000
}

interface SimulationResult {
  iPeak: number                       // μA
  iAvg: number                        // μA
  delay: number                       // ps
  ivData: IVPoint[]
}

// 저장 형식: { [cellId: number]: SimulationResult }
```

### 6-3. ColumnConfig (UI 설정)

```typescript
interface ColumnDef {
  key: string
  label: string
  width?: number
  numeric?: boolean                   // 시뮬레이션 비교 대상 여부
}

interface ColumnConfig {
  searchTableColumns: ColumnDef[]
  selectedCellsMetadataColumns: ColumnDef[]
  selectedCellsSimulationColumns: ColumnDef[]
  chartOptions: {
    chartTypes: { value: string; label: string }[]
    xAxisOptions: { value: string; label: string }[]
    yAxisOptions: { value: string; label: string }[]
    groupingOptions: { value: string; label: string }[]
  }
}
```

### 6-4. Builder / ChartTab

```typescript
interface ChartConfig {
  chartType: 'line' | 'scatter' | 'bar'
  xAxis: string
  yAxisPrimary: string
  yAxisSecondary?: string | null
  grouping: string
}

interface Builder {
  id: number
  name: string
  selectedCellIds: number[]
  chartConfig: ChartConfig
}

interface ChartTab {
  builderId: number
  builderName: string
  cells: (Cell & SimulationResult & { alias: string })[]
  config: ChartConfig
}
```

---

## 7. API 계층 설계

`src/api/cells.js`를 수정하면 백엔드 전환 가능하도록 추상화.

| Method | 예상 엔드포인트 | 현재 소스 파일 |
|--------|-----------------|----------------|
| GET | `/cells` | `public/data/cells.json` |
| GET | `/column-config` | `public/data/column-config.json` |
| GET | `/simulations` | `public/data/simulations.json` |
| GET | `/simulations/:id` | (미사용, 향후 대비) |

---

## 8. 상태 관리 (Pinia Store)

`src/stores/builderStore.js`에 모든 전역 상태 집중.

| 상태 | 타입 | 설명 |
|------|------|------|
| `allCells` | `Cell[]` | API에서 로드한 전체 셀 목록 |
| `simulations` | `Record<id, SimulationResult>` | 전체 시뮬레이션 결과 |
| `config` | `ColumnConfig` | UI 옵션 정의 |
| `builders` | `Builder[]` | 다중 Builder 인스턴스 |
| `activeBuilderIndex` | `number` | 현재 활성 Builder |
| `chartTabs` | `ChartTab[]` | 생성된 차트 탭 목록 |
| `cellAliases` | `Record<string, string>` | `{builderId}-{cellId}` → alias |
| `loading` / `error` | boolean / Error | 로딩/에러 상태 |

**주요 Computed**: `activeBuilder`, `selectedCells` (allCells + simulations 자동 머지)

---

## 9. 미구현 기능 (향후 개발)

| 기능 | 설명 | 우선순위 |
|------|------|---------|
| Save / Load Preset | 차트 설정 저장 및 불러오기 | 중 |
| Add Derived Metric | 계산 필드 추가 (e.g., iPeak/iAvg) | 상 |
| CSV / Image 내보내기 | 차트 및 데이터 테이블 내보내기 | 중 |
| 사용자 로그인 | 인증 시스템 | 중 |
| Builder 백엔드 저장 | 사용자별 Builder 영속화 | 중 |
| 공유 링크 | Builder / Chart 공유 URL | 중 |
| 그룹 연산 | 시뮬/메타 데이터 집계 | 상 |

---

## 10. 비기능 요구사항

| 항목 | 내용 |
|------|------|
| 브라우저 호환성 | Chrome / Firefox / Safari / Edge 최신 버전 (ES2020+) |
| 초기 로딩 | cells.json, simulations.json, column-config.json 병렬 로드 |
| 차트 리사이즈 | ResizeObserver로 컨테이너 변경 감지 후 자동 적용 |
| 페이지네이션 | 대용량 셀 목록 대응 (pageSize 10~100) |
| 레이지 로딩 | 페이지 컴포넌트 동적 import |
