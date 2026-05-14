# CLARA Front Mockup — 진행 상황

> 마지막 업데이트: 2026-05-14
> 현재 브랜치: `main` (HEAD: `052a43b`)
> 리포: `Micromy/clara_front`

---

## 1. 프로젝트 개요

**CLARA** — 반도체 셀 라이브러리 분석 프론트엔드. **FF / ICG** 두 타입의 셀 메타데이터와 시뮬레이션 결과를 검색·선택하고 차트로 비교 시각화하는 Vue 3 SPA. 백엔드(Django REST)와 연동하며, 사내 API 접근 불가 시 `public/data/*.json` fallback 사용.

---

## 2. 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Vue 3 (Composition API, `<script setup>`) |
| 빌드 | Vite 4.5.5 |
| UI 라이브러리 | Element Plus 2.13 + `@element-plus/icons-vue` |
| 상태 관리 | Pinia 3 |
| 라우팅 | 없음 — 단일 경로 SPA (`<AppView>` 조건부 렌더) |
| 차트 | ECharts 6 + vue-echarts |
| 패키지 매니저 | npm (Node 20+) |
| 배포 | 사내 Docker (nginx) |
| 백엔드 | Django REST (`/clara/*` 엔드포인트) |

---

## 3. 구현된 기능

### 3-1. 셀 검색 & 선택
- **CellSearchTable** — 페이지네이션, 컬럼별 정렬, 컬럼 필터 드롭다운
- **Cell Type 드롭다운** (FF / ICG) — 변경 시 selected cells / 검색 / chartConfig / labelTemplate 일괄 초기화
- **PDK 드롭다운** — 단일 선택, API에서 동적 로드
- **Library 드롭다운** — 다중 선택, **항상 regex 모드** (입력 즉시 case-insensitive regex로 필터링). 잘못된 패턴은 빨간 테두리 + 전체 목록 유지. `Select all` 버튼으로 매칭 결과를 기존 선택에 OR 합산
- **Cell Name 검색** — 디바운스 300ms (substring)
- Cell Type / PDK / Library 셋 다 선택 시 `/clara/meta/` 호출 → 결과 테이블 표시
- 다중 선택, 페이지 간 선택 유지, **드래그 선택** (`useDragSelect`)
- **이미 선택된 셀 비활성화** — 현재 빌더의 selectedCellIds에 있는 행은 disabled
- **컬럼 auto-width** — 콘텐츠 길이 기반 자동 너비
- 별도 팝업창으로 검색 분리 가능 (`usePopupWindow`)

### 3-2. 셀 추가 & Tag
- 검색 테이블 **footer**에서 Checked 카운트 + **Tag (optional)** 입력 + ↓ Add
- Tag는 per-cell 자유 입력 — Group 템플릿의 `[Tag]` 토큰이 이를 참조

### 3-3. Selected Cells 패널 (Group/Label 모델)
- **Label template builder** — 테이블 위 chip builder. `[Field]` / `[Tag]` 토큰을 조합해서 Group을 정의. `_`로 자동 join, 빈 토큰은 생략
- **Tag 컬럼** — per-cell 텍스트 입력 (이전 `Alias` 컬럼). monospace 폰트
- **Group 컬럼** — 템플릿이 셀별로 계산한 read-only 결과 (`D2_fast`, `X4_NS3` 등)
- **체크박스 + Remove 버튼** (체크 시 fade-in)
- **Metadata ↔ Simulation** 토글
- **Raw ↔ Diff** 비교 모드 + Reference 셀 선택
- **컬럼별 Diff ↔ Ratio 오버라이드** (`[−|÷]`)
- Ratio 모드: 백분율 표시 (`+12.34%`)
- 색상 강조: 양수 초록 / 음수 빨강 / Reference "REF" 배지
- Derived 컬럼 `f(x)` 태그
- cellType 별 시뮬 컬럼 자동 전환 (FF/ICG)

### 3-4. 차트 설정 (ChartConfigPanel)
- 차트 타입 (scatter / line / bar)
- **Grouped By** — Selected Cells의 Label template을 read-only chip으로 미러. 클릭 시 빌더로 스크롤 + flash
- **X / Y1 / Y2 축** — 활성 cellType의 metric 옵션
- **Bar 전용 동작:**
  - Group은 항상 X-axis (라벨 `Grouped By (X-Axis)`)
  - X-Axis 입력 행 자체 숨김 (옵션 없음)
  - 시리즈는 single — Group 버킷별 평균 (mean aggregation)
- **Scatter/Line:** 시리즈 색상은 Group 기준 자동 분리
- Primary / Secondary Y 축 **독립 차트 타입**
- **Derived Metrics 다이얼로그** — Binary / Math Function / Z-score / Relative to Mean / Delta from Mean / % of Max / Group Mean / Group Std
- **Save / Load Preset** — API 호출 (`/clara/preset/`)

### 3-5. 차트 (ChartDisplay)
- ECharts scatter / line / bar
- **Vivid 컬러 팔레트** (`#2563EB`, `#E63946`, `#2D9F46`, `#E88C1E`, `#8B5CF6` 등)
- **인터랙티브 줌** — 휠 X줌 + 드래그 팬, **Box Zoom** (Shift+드래그), Shift+더블클릭 리셋
- **커스텀 toolbox** — 라벨 토글 / box zoom / 리셋 / PNG 저장
- **데이터 라벨 토글** — 네모 테두리 + 연결선 + 겹침 방지 + 드래그
- **Tooltip 소수점 8자리**
- **emphasis / blur** — 호버 시 다른 시리즈 흐림
- **테이블 행 ↔ 차트 점 highlight** 연동
- 범례 우측 세로 배치
- 차트 3:2 비율 (ResizeObserver)

### 3-6. 차트 페이지
- ChartView 좌/우 분할 (차트 + Source Data 오버레이)
- 12px 오버랩, 세로 스플리터 (더블클릭 토글)
- **SourceDataTable** — Group / 축 순서(X, Y1, Y2) 기준 컬럼 정렬, Raw / Diff 비교
- auto column width (CHAR_WIDTH=7)

### 3-7. 빌더 / 탭 관리
- 다중 Builder 탭 + Builder별 Chart 탭
- 2단 탭 바 (세트명 + Builder/Chart 서브탭)
- 탭 컨텍스트 메뉴 (Rename / Save / Close)
- 탭 드래그 순서 변경
- Chart Save (이름 중복 시 `(2)` suffix, prev suffix strip)
- Chart Load 다이얼로그 (Load / Delete)
- 활성 빌더/서브탭은 store에서 관리 (URL은 항상 `/`)

### 3-8. 레이아웃
- 상단/하단 드래그 splitter (가로 grip)
- 더블클릭 — 기본(420px) ↔ 확장(800px)
- 우측 ChartConfigPanel 360px 고정

### 3-9. 영속성
- **localStorage 자동 저장**: builders (selectedCellIds / chartConfig / derivedFormulas / labelTemplate / name / search), cellAliases(=tags), activeBuilderIndex, activeSubTab
- **빌더별 검색 상태 독립** — 빌더 전환 시 save/restore
- **Chart Preset / Saved Charts** — 백엔드 API
- 첫 렌더 전 동기 복원

---

## 4. 데이터 아키텍처

### 4-1. 파일 구조
```
src/
  ├── api/cells.js            REST 호출 + snake/camel 변환 + 로컬 fallback
  ├── stores/builderStore.js  Pinia store (selectedCells, labelTemplate, ...)
  ├── views/
  │   ├── AppView.vue         BuilderView/ChartView 조건부 렌더
  │   ├── BuilderView.vue     검색 + Selected Cells + ChartConfig
  │   └── ChartView.vue       ECharts + SourceData
  ├── components/
  │   ├── builder/
  │   │   ├── CellSearchTable.vue
  │   │   ├── LabelTemplateBuilder.vue   ← Group 템플릿 chip builder
  │   │   ├── SelectedCellsPanel.vue
  │   │   └── ChartConfigPanel.vue
  │   └── chart/
  │       ├── ChartDisplay.vue
  │       └── SourceDataTable.vue
  └── layouts/AppLayout.vue

public/data/                  로컬 fallback 데이터 (USE_LOCAL_DATA=true 시 사용)
  ├── cells.json
  ├── simulations.json
  └── column-config.json       UI 메타 (chartOptions, labelableFields)
```

### 4-2. 데이터 소스: API ↔ Local fallback

`.env`의 `VITE_USE_LOCAL_DATA=true` 시 모든 fetch가 `public/data/*.json`으로 분기 (사내 DB 접근 불가 시 검토용). `false`/미설정 시 실제 API 호출. 프로덕션 Docker 빌드는 `.env` 없이 도므로 자동으로 API 모드.

**API 엔드포인트** (`/clara/...`) — 자세한 계약은 [API.md](API.md) 참조:
- `GET /pdk/`, `/lib/`, `/metric/` — 드롭다운/축 옵션
- `GET /meta/?cell_type=&pdk_id=&lib_id=` — 메타데이터 검색
- `GET /cell/ff/?cell_id=...`, `/cell/icg/?cell_id=...` — 시뮬 데이터
- `GET/POST/DELETE /preset/` — Chart Preset
- `GET/POST/DELETE /chart/` — Saved Chart (preset + items 묶음)

### 4-3. snake_case ↔ camelCase 자동 변환
`api/cells.js`의 `get()`/`post()` 헬퍼가 응답은 camelCase로, 요청 body는 snake_case로 자동 변환. 프론트 코드는 항상 camelCase.

### 4-4. Group 템플릿 인코딩 (백엔드 영속화)
프론트의 `labelTemplate: [{type, field?}]` 배열을 `group_by` VARCHAR에 CSV로 직렬화:
- field 토큰 → 필드명 (`drive_str`)
- tag 토큰 → 센티넬 `__tag__`
- 예: `[Drive Str, Tag]` → `"drive_str,__tag__"`

자세한 인코딩 규칙: [API.md](API.md#group-템플릿-인코딩)

### 4-5. 데이터 흐름
```
앱 시작
  └─ App.vue onMounted → store.init()
       └─ Promise.all([fetchColumnConfig, fetchPdks, fetchLibraries,
                       fetchMetrics, fetchPresets, fetchCharts])

검색 (Cell Type + PDK + Library 셋 다 선택 시)
  └─ store.applySearch() → fetchMeta({cellType, pdkId, libIds})
       → metaCells 업데이트 → filteredCells (클라이언트 필터)

셀 선택
  └─ store.selectCells(ids)
       → fetchSimForCells(ids) → simulations[id] 캐시 채움

selectedCells (computed)
  └─ metaCells + simulations + computeLabel(template, cell, tag)
       → 각 셀에 .label 주입 + derived formula 결과 주입

차트 생성
  └─ store.generateChart() → chartTab 생성 (cells + config + labelMap)
       → ChartDisplay가 cell.label로 시리즈 분리, X-axis로 사용 (bar)

영속성
  └─ builders / cellAliases / activeBuilderIndex / activeSubTab → localStorage
```

---

## 5. 주요 화면 / 컴포넌트

### 5-1. Builder 뷰 (`store.activeSubTab === 'builder'`)
- **CellSearchTable** — 셀 검색·선택 (상단)
- **SelectedCellsPanel** — Label template + 선택 셀 표 (좌하)
- **ChartConfigPanel** — 차트 설정 (우하, 360px)

### 5-2. Chart 뷰 (`store.activeSubTab === 'chart'`)
- **ChartDisplay** — ECharts 차트 (좌)
- **SourceDataTable** — 차트 데이터 테이블 (우, 오버레이)

### 5-3. 공통
- **AppLayout** — 헤더 + 2단 탭바 + `<AppView>` 직접 렌더
- **CellSearchPopupRoot** — 별도 윈도우에서 검색 (Pinia store 공유)

---

## 6. UI 디자인 언어

### 6-1. 보조 버튼 (borderless text)
- 기본: `#909399`, hover: `rgba(0,0,0,0.04)`
- Primary: `var(--clara-primary, #4078C0)` + bold
- 파괴적 액션: hover 시 `#f56c6c` + 빨간 배경

### 6-2. 스플리터
- 가로/세로 grip 줄 2개, hover 시 primary 50%

### 6-3. Tag / Group / Label
- Tag, Group 컬럼은 monospace (`Menlo, Consolas`) — 식별자 톤
- Label template 칩: 흰 배경 + 회색 테두리. Tag 토큰만 italic으로 구분
- ChartConfig의 Grouped By 미러: 클릭 시 빌더로 스크롤 + 파란 flash 애니메이션

### 6-4. 컬럼 너비
- 검색 테이블 메타 컬럼: 65~70px 통일
- Selected Cells: Tag 100px, Group 160px, Cell Name 320px
- Source Data: auto-width

---

## 7. 로컬 개발

```bash
npm install
npm run dev         # http://localhost:5173/
npm run build       # 프로덕션 빌드 (dist/)
npm run preview     # 빌드 결과 확인
```

**환경 변수** (`.env` 파일, gitignored):
```
VITE_USE_LOCAL_DATA=true    # public/data/*.json 사용 (API 우회)
```
미설정 또는 `false` → 실제 백엔드 API 호출. dev server는 env 변경 후 재시작 필요.

---

## 8. 배포

- **사내 Docker** — `Dockerfile`에서 `npm run build` → nginx 컨테이너로 정적 자산 서빙
- **SPA fallback** — `nginx.conf`에서 `try_files $uri $uri/ /index.html`로 모든 경로 → index.html
- **URL 정책** — 단일 경로 `/`. 비루트 접근은 mount 시 `history.replaceState`로 `/`로 정리

---

## 9. 알려진 이슈 / 향후 개선

- **ECharts 번들 사이즈** — `dist/assets/index-*.js` ≈ 2.4MB (gzip 770KB). tree-shakable import + 코드 스플리팅 필요
- **localStorage 마이그레이션** — `builders` 스키마 변경 시 ensureBuilderShape에서 처리 중. 추후 스키마 버전 키 권장
- **Group 템플릿 백엔드 영속화** — `group_by`에 CSV로 저장 중. JSON으로 확장 시 schema 변경 필요
- **반응형** — 모바일/태블릿 레이아웃 미검증
- **로그인 시스템 부재** — `CURRENT_USER = 'anonymous'` 하드코딩. 도입 시 교체 예정

---

## 10. 백로그

### 10-1. 백엔드 협의 필요
- [ ] `chart_preset.group_by` 컬럼 `VARCHAR2(255)`로 길이 확장 (현재 길이 확인 필요)
- [ ] `chart_item.cell_alias` → `cell_tag` 리네임 + 빈 값 허용
- [ ] `chart_preset.x_axis`에서 `__label__` 문자열 허용
- [ ] `/clara/meta/?id=...` 필터 — chart restore 시 cell_id로 정확히 가져오기

### 10-2. 기술적 개선
- [ ] ECharts tree-shaking + 코드 스플리팅
- [ ] localStorage 스키마 버전 키
- [ ] 반응형 (모바일/태블릿) 검토
- [ ] 로그인 시스템 도입 → `CURRENT_USER` 교체

### 10-3. UX
- [ ] Cell Name 검색도 always-regex로 통일 (현재 substring + debounce)
- [ ] Chart 저장 시 labelTemplate도 함께 영속화 (현재 CSV로 호환 완료, JSONField로 확장 시 고려)
