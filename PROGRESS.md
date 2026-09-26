# CLARA Front Mockup — 진행 상황

> 마지막 업데이트: 2026-09-26
> 현재 브랜치: `mw-table-height-type-params` (HEAD: `201d7ed`, `origin/main` 대비 32 커밋 앞섬 · 1 커밋 미푸시)
> 리포: `Micromy/clara_front`

---

## 1. 프로젝트 개요

**CLARA** — 반도체 셀 라이브러리 분석 프론트엔드. **FF / ICG** 두 타입의 셀 메타데이터와 시뮬레이션 결과를 검색·선택하고 차트로 비교 시각화하는 Vue 3 SPA. 백엔드(Django REST)와 연동.

> 이후 상위 **DTCO Platform** 쉘에 서비스로 편입되었고(3-10), PDK/Family 단위 요약을 보여주는 **Library Report** 페이지가 추가됨(3-11, 현재 mock 단계).

---

## 2. 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Vue 3 (Composition API, `<script setup>`) |
| 빌드 | Vite 4.5.5 |
| UI 라이브러리 | Element Plus 2.13 + `@element-plus/icons-vue` |
| 상태 관리 | Pinia 3 |
| 라우팅 | Vue Router — `/`(CLARA PPA 빌더), `/library-report`(Library Report), 그 외 `/`로 redirect. 사내 nginx 배포는 history mode, GitHub Pages 빌드는 hash mode(`VITE_ROUTER_HASH=true`) |
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

### 3-10. 플랫폼 쉘 (PlatformShell)
- CLARA가 **DTCO Platform**이라는 상위 쉘 안의 한 서비스로 편입 — 헤더에 서비스 스위처(`src/config/services.js`) 추가
- Vue Router 도입: `/`(CLARA PPA 빌더 = `PpaApp.vue`, 기존 `AppView`를 감싸는 형태로 loading/error 화면 처리), `/library-report`(신규), 나머지 경로는 `/`로 redirect
- 배포 환경별 history 모드 분기 — 사내 nginx(`try_files ... /index.html`)는 `createWebHistory`, GitHub Pages(서브디렉토리, 서버 rewrite 없음)는 `createWebHashHistory`

### 3-11. Library Report 페이지 (신규 — 전부 mock 데이터)
`/library-report` — **PDK × Family**를 고르면 4개 탭에 걸쳐 요약을 보여주는 신규 화면. **현재 `src/views/library-report/data.js`의 하드코딩 mock만 존재하며 백엔드 연동 전 단계.**

2026-09-26: 컨텍스트 단위가 **library 1개 → family 1개(= library N개)** 로 바뀜. family는 `library` 테이블의 신규 컬럼이며 마스터 테이블이 아니다(자체 id 없음, 이름 문자열이 키). family 선택이 곧 소속 library 전체 선택이고, 4개 탭이 family 멤버 library들을 함께 그린다. 목록은 신규 `GET /clara/family/`([API.md](API.md) §11), 설계는 [docs/library-report-family-design.md](docs/library-report-family-design.md).
- **Library Info** — PDK 구성(HSPICE/LVS/PEX 버전)은 family 공통. Release Path / Cell Design 표는 **`LIBRARY` 열이 추가되어 행 = library × height**로 쌓인다(같은 height끼리 붙어 library 간 GDS version·지원 범위 차이를 비교). Cell Design 매트릭스(Drive Str × VTH × Nanosheet 지원 여부 mini-table)는 library별로 생성(`cellDesign(library)`). 2차 라운드(9/26)에서 데이터 경로를 **신규 `GET /clara/library-info/`([API.md](API.md) §12) 1회 호출**로 묶었다 — library마다 조회하지 않고 family 단위 집계를 받아 표 행으로 펼치기만 한다. 표 구성·열은 변경 없음
- **PPA** — 저장된 Chart Preset(메인 PPA 페이지에서 저장한 셋)을 선택 → **열 = library × metric의 2단 헤더 표**(행은 family 전체 cell 합집합). 참조 library는 family 멤버 중에서 고르고 diff%는 그 library의 **실측 행**에서 계산(이전의 pseudo-random 가짜 참조 제거). 특정 library에 없는 cell은 빈칸(0과 구분). library가 1개인 family면 참조 select·Raw/Diff 토글을 숨김
- **MW** — Cell Height + mw_type(MWD/MWS) 축 선택 → CK Slope별 voltage로 그룹핑된 pivot 테이블. 백엔드는 로우 데이터만 주고 **표 조립(pivot)은 프론트 책임** ([API.md](API.md) `GET /clara/mw/`). 테이블 1개 = library 1개 = `/clara/mw/` 1회 호출이라 **테이블 내부에 library 축을 넣지 않고**, family 선택이 "library마다 테이블 1개"인 비교 셋을 자동 구성한다. 테이블/picker의 Library 옵션은 family 멤버로 제한
- **Final Report** — **PDK+Family당 1개**, "참조형(스냅샷 아님)" 설계([docs/final-report-design.md](docs/final-report-design.md)):
  - 블록 구성: `LIB`(Library Info 요약) / `PPA`(저장 셋 요약) / `MW`(경고 셀) / `user`(자유 입력 블록, 삽입·재정렬 가능)
  - 블록 스코프: `LIB`/`MW`는 **library 단위**(블록에 `library_id`, 제목에 library 접두, 카드에 library 칩), `PPA`는 family 단위. library N개면 `N × 3 + 1` 블록. family 변경 시 리포트 정체성이 바뀌므로 `state`를 `idle`로 리셋
  - 블록마다 AI 초안(`ai_draft`) + 사람이 수정한 본문(`body`) + 원본 조인 데이터(`data`, 응답 시점에 inline 확장) + 낡음 배지(`stale`, `source_saved_at` vs `source_current_at` 비교)
  - MW 블록은 CK Slope 40 고정 + `MW_THRESHOLD`(MWD 44 / MWS 40, 시스템 상수로 하드코딩, DB 없음) 이상 fail_count 셀만 필터
  - 액션은 **edit / save / final-save** 3단으로 단순화 (별도 "리뷰 완료 체크" 단계는 한때 추가됐다가 제거됨)
  - `final-save` 5일 후 편집 잠금 (`locked` computed)
  - 9/22 커밋에서 응답 shape을 계획 중인 `GET /clara/report/` 계약에 맞춰 재구성 — **이 엔드포인트는 아직 API.md에 정식 등재되지 않음** (final-report-design.md 초안만 존재)

---

## 4. 데이터 아키텍처

### 4-1. 파일 구조
```
src/
  ├── router.js                라우팅 (`/`, `/library-report`, 그 외 redirect)
  ├── api/
  │   ├── client.js            공통 HTTP transport (snake/camel 변환)
  │   └── cells.js             REST 호출
  ├── config/
  │   ├── column-config.json   UI 메타 (chartOptions, groupableFields 등)
  │   └── services.js          플랫폼 서비스 스위처 목록, CURRENT_USER
  ├── stores/builderStore.js  Pinia store (selectedCells, groupTemplate, ...)
  ├── views/
  │   ├── PpaApp.vue          CLARA PPA 빌더 진입점 (loading/error 화면 + AppLayout)
  │   ├── AppView.vue         BuilderView/ChartView 조건부 렌더
  │   ├── BuilderView.vue     검색 + Selected Cells + ChartConfig
  │   ├── ChartView.vue       ECharts + SourceData
  │   └── library-report/     신규 — Library Report 페이지 (전부 mock)
  │       ├── LibraryReportView.vue  탭 컨테이너 + PDK/Family 컨텍스트바
  │       ├── TabLibraryInfo.vue
  │       ├── TabPpa.vue
  │       ├── TabMw.vue
  │       ├── TabFinalReport.vue
  │       └── data.js          mock 데이터 + 백엔드 응답 shape 시뮬레이션
  ├── components/
  │   ├── builder/
  │   │   ├── CellSearchTable.vue
  │   │   ├── GroupTemplateBuilder.vue   ← Group 템플릿 chip builder
  │   │   ├── SelectedCellsPanel.vue
  │   │   └── ChartConfigPanel.vue
  │   └── chart/
  │       ├── ChartDisplay.vue
  │       └── SourceDataTable.vue
  └── layouts/
      ├── PlatformShell.vue    상위 플랫폼 헤더 + 서비스 스위처 (신규)
      └── AppLayout.vue        CLARA 내부 헤더 + 2단 탭바
```

### 4-2. 데이터 소스: 사내 Django REST API

`VITE_API_BASE_URL` 환경변수로 endpoint 지정 (빌드 타임 inline). 사내 배포는 ConfigMap → BuildConfig env로 같은 값 주입.

**API 엔드포인트** (`/clara/...`) — 자세한 계약은 [API.md](API.md) 참조:
- `GET /pdk/`, `/lib/`, `/metric/` — 드롭다운/축 옵션
- `GET /family/` — family별 library 목록 (Library Report 컨텍스트바). `/lib/`의 응답 스키마는 변경 없음
- `GET /meta/?cell_type=&pdk_id=&lib_id=` — 메타데이터 검색
- `GET /cell/ff/?cell_id=...`, `/cell/icg/?cell_id=...` — 시뮬 데이터
- `GET/POST/DELETE /preset/` — Chart Preset
- `GET/POST/DELETE /chart/` — Saved Chart (preset + items 묶음)
- `GET /cell-height/` — Cell Height 목록 (Library Report용)
- `GET /library-info/?pdk_id=&family=` — Library Info 탭 집계 (family 멤버 library별 release path + cell design, 1회 호출)
- `GET /mw/` — MW 테이블 로우 데이터 (pivot은 프론트에서 조립)
- `GET /report/` — Final Report (**설계 초안 단계, API.md 미등재** — [docs/final-report-design.md](docs/final-report-design.md) 참조)

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
  └─ PpaApp.vue onMounted → store.init()
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
- **PlatformShell** — 최상위 헤더(서비스 스위처), `App.vue`에서 `<router-view>`와 함께 항상 렌더
- **AppLayout** — CLARA 내부 헤더 + 2단 탭바, `/`(`PpaApp` → `AppView`) 안에서만 렌더
- **CellSearchPopupRoot** — 별도 윈도우에서 검색 (Pinia store 공유)

### 5-4. Library Report 뷰 (`/library-report`, 신규)
- **LibraryReportView** — PDK/Family 컨텍스트바 + 4개 탭(Library Info / PPA / MW / Final Report) 전환. 선택 상태는 라우트 쿼리에 실려 딥링크 가능
- route query: `tab`(`info|ppa|mw|final`) · `pdk`(PDK id) · **`family`(family 이름)** · `set`(PPA 저장 셋 id). `family`는 2026-09-26에 `lib`를 대체했으며, 없거나 존재하지 않는 값이면 첫 family로 방어 fallback (`?lib=` 하위 호환은 두지 않음 — 외부 배포된 고정 링크가 없다)
- Family select 오른쪽에 멤버 library를 읽기 전용 칩으로 표시(4개 초과 시 `+N`) — family 선택이 곧 library N개 선택임을 화면에 드러내기 위함
- 자세한 탭별 기능은 3-11, 설계 근거는 [docs/library-report-family-design.md](docs/library-report-family-design.md) 참조

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
VITE_API_BASE_URL=http://...-prod...samsungds.net
```
빌드 타임에 inline. dev server는 env 변경 후 재시작 필요.

---

## 8. 배포

- **사내 Docker** — `Dockerfile`에서 `npm run build` → nginx 컨테이너로 정적 자산 서빙
- **SPA fallback** — `nginx.conf`에서 `try_files $uri $uri/ /index.html`로 모든 경로 → index.html
- **URL 정책** — Vue Router 2개 경로(`/`, `/library-report`) + catch-all redirect. 사내 배포는 history mode(SPA fallback 필요), GitHub Pages 빌드만 hash mode

---

## 9. 알려진 이슈 / 향후 개선

- **ECharts 번들 사이즈** — `dist/assets/index-*.js` ≈ 2.4MB (gzip 770KB). tree-shakable import + 코드 스플리팅 필요
- **localStorage 마이그레이션** — `builders` 스키마 변경 시 ensureBuilderShape에서 처리 중. 추후 스키마 버전 키 권장
- **Group 템플릿 백엔드 영속화** — `group_by`에 CSV로 저장 중. JSON으로 확장 시 schema 변경 필요
- **반응형** — 모바일/태블릿 레이아웃 미검증
- **로그인 시스템 부재** — `CURRENT_USER`가 파일마다 따로 하드코딩(`builderStore.js`는 `'anonymous'`, `config/services.js`·`library-report/data.js`는 `'demo.user'`). 도입 시 단일 소스로 교체 예정
- **Library Report 전체 mock** — Library Info/PPA/MW/Final Report 4탭 모두 `data.js` 하드코딩으로 동작. `GET /clara/mw/`·`/clara/family/`·`/clara/library-info/`는 API 스펙 확정([API.md](API.md))되어 있고, 나머지는 백엔드 미연동

---

## 10. 백로그

### 10-1. 백엔드 협의 필요
- [ ] `chart_preset.group_by` 컬럼 `VARCHAR2(255)`로 길이 확장 (현재 길이 확인 필요)
- [ ] `chart_item.cell_alias` → `cell_tag` 리네임 + 빈 값 허용
- [ ] `chart_preset.x_axis`에서 `__label__` 문자열 허용
- [ ] `/clara/meta/?id=...` 필터 — chart restore 시 cell_id로 정확히 가져오기
- [ ] `/clara/library-info/`의 release path·GDS version 원천 테이블 확정 (없으면 탭의 PATH 열 재검토)
- [ ] `cell_meta`에 `cell_height_id` 추가 (현재 `cell_height` 문자열 ↔ `cell_height_id` int 불일치)

### 10-2. 기술적 개선
- [ ] ECharts tree-shaking + 코드 스플리팅
- [ ] localStorage 스키마 버전 키
- [ ] 반응형 (모바일/태블릿) 검토
- [ ] 로그인 시스템 도입 → `CURRENT_USER` 교체

### 10-3. UX
- [ ] Cell Name 검색도 always-regex로 통일 (현재 substring + debounce)
- [ ] Chart 저장 시 labelTemplate도 함께 영속화 (현재 CSV로 호환 완료, JSONField로 확장 시 고려)

### 10-4. Final Report (Library Report) — 2026-09-17 스펙 산정 미팅 확정
- [x] Final Report 영역별 유효성 체크 (MW/PPA 변경 여부 확인) — `stale` 배지 + `source_saved_at`/`source_current_at` 비교 뼈대 구현. mock이라 항상 `stale: false`; 실 데이터로는 백엔드 연동 후 검증 필요
- [ ] 영역별 AI 초안 생성 로직 분리 — `ai_draft` 필드는 있으나 mock에서는 고정 문구만 생성. 실제 생성 로직 없음
- [ ] Library 이름 convention & gds version 설명 입력 기능 — 데이터 모델에 `gds_desc` 필드는 있으나 입력 UI 미구현
- [x] 최종 저장 시 library info/MW/PPA 수정 불가 고정 — `final-save` 5일 후 `locked`. 액션은 edit/save/final-save 3단으로 단순화(별도 "리뷰 완료 체크" 단계는 도입 후 제거)
- [ ] Comment 기능 추가 (권한: SPiL 전원) — **부분 구현**: 스펙은 "리포트 전체 댓글 스레드"였으나 현재는 삽입 가능한 단일 `user` 자유입력 블록으로 대체 구현됨. 멀티유저 댓글/스레드는 아직 없음
- [x] PPA & MW를 F.R.에 작게 요약 표시 — 블록 `data`에서 파생한 요약 칩(`blockSummary`)으로 구현
- [ ] PPA 백엔드+프론트 재점검
- [ ] ETL 재공유
- [ ] `GET /clara/report/` 백엔드 구현 + API.md 정식 등재 — 현재 [docs/final-report-design.md](docs/final-report-design.md) 초안만 있고, 프론트는 그 계약대로 mock을 미리 맞춰둔 상태(9/22 커밋)

---

## 11. Final Report 기능 스펙 (2026-09-17 확정)

> `src/views/library-report/TabFinalReport.vue` 등 현재 프로토타입에 반영 예정. 아래는 확정된 스펙, 위 10-4가 남은 작업.
> 데이터 구조 설계는 [docs/final-report-design.md](docs/final-report-design.md) 참조.

- **코멘트 기능** — 리포트 전체에 대한 댓글 형태로 제공
  - 실무자: 다음 개발 사항, 현재 이슈 위주로 작성 예상
  - TL/서브TL: 추가 필요사항 등 첨언 형태
  - 유효기간 없음, 최종 확정 이후에도 열람 가능
- **F.R. 기본 표시 content**
  - library info: pdk version / height 종류 등
  - PPA: chart의 meta 정보
  - MW: slope 40 포함 셀 중 특정 값 이상인 셀 리스트
- **gds version**은 각각 표시. Final Report는 PDK & library별 1개씩 생성 (변경점 생기면 library가 추가 생성되므로 무방)
- **predefined PPA**는 리포트 작성 후 변경되지 않는다고 가정
- **권한** — 리포트/코멘트 작성 권한은 SPiL 전원에게 부여
- **Clara data**는 추후 입력 예정 (Vanguard향). 기존 report 기반 인사이트/주요 관심 포인트는 상대방이 공유 예정
