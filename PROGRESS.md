# CLARA Front Mockup — 진행 상황

> 마지막 업데이트: 2026-09-26 (3차 — Library Report UI 포팅 반영)
> 현재 브랜치: `library-report-ui-port` (HEAD: `f1aa47a`)
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
| 상태 관리 | Pinia 3 (메인 PPA 빌더) · Library Report는 `provide/inject` + `reactive` 스토어(`useReportStore.js`, Pinia 미사용) |
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

**2026-09-26 3차 — UI 전면 포팅 (브랜치 `library-report-ui-port`)**: 화면이 외부 도구로 다시 만들어져 포팅됐다. 컴포넌트가 **props + route query 방식에서 `provide/inject` 중앙 스토어(`useReportStore.js`)로** 교체되고, Library Info 탭 구성과 Final Report 생성 모델이 바뀌었다. **family 스코프 자체는 유지된다** — 스토어가 계속 `FAMILIES`/`findFamily` 기반이고 `GET /clara/family/`·`GET /clara/library-info/`의 존재 이유도 그대로다.

- **상태 관리** — `useReportStore.js`의 `reactive` 하나에 4탭 상태가 모이고 `provide('report')`로 공유된다. 탭을 전환해도 MW 비교 셋·Final Report 영역·release path 입력이 **소실되지 않는다**(이전에는 unmount로 사라짐). Final Report가 다른 탭의 사용자 구성을 읽어 요약해야 해서 생긴 변경이다
- **Library Info** — PDK 버전 표(읽기 전용) + **Library List**(library별 DESCRIPTION 입력) + **Release Path**(리포트 전체에 대한 **편집 가능한 목록**, cell height로 그룹화, 한 height에 행 N개, 행 추가/삭제/수정 + GDS 설명 textarea) + **Cell Design**(**library × 대표 셀 × cell height × bit-width** 카드 뷰 — drive/nanosheet 칩과 VTH 막대). 2차의 `LIBRARY` 열 방식(`library × height`)은 **폐기**. ⚠️ release path·GDS version이 조회 데이터에서 **사용자 입력으로 넘어가** 리포트 소유가 됐다. 대표 셀 Cell Design은 4차 라운드(9/27)에서 **(PDK, library) 스코프로 확정**되어 신규 `GET /clara/cell-design/`([API.md](API.md) §13) 1회 호출로 바뀌었고, 화면이 library 그룹으로 감싸졌다
- **PPA** — 저장된 Chart Preset(메인 PPA 페이지에서 저장한 셋)을 선택 → **열 = library × metric의 2단 헤더 표**(행은 family 전체 cell 합집합). 참조 library는 family 멤버 중에서 고르고 diff%는 그 library의 **실측 행**에서 계산. 특정 library에 없는 cell은 빈칸(0과 구분). library가 1개인 family면 참조 select·Δ 토글을 숨김. 3차에서 **"미리보기로 불러옴"(`ppaSetId`)과 "리포트에 저장"(`ppaLinkedId`)이 분리**됨 — 연결 전에는 배너가 뜨고 Final Report의 PPA 영역을 생성할 수 없다
- **MW** — Cell Height + mw_type(MWD/MWS) 축 선택 → CK Slope별 voltage로 그룹핑된 pivot 테이블. 백엔드는 로우 데이터만 주고 **표 조립(pivot)은 프론트 책임** ([API.md](API.md) `GET /clara/mw/`). 테이블 1개 = library 1개 = `/clara/mw/` 1회 호출이라 **테이블 내부에 library 축을 넣지 않고**, family 선택이 "library마다 테이블 1개"인 비교 셋을 자동 구성한다. 3차에서 **비교 셋 구성 자체가 리포트 소유 사용자 입력**이 됐다(최종 저장 시 확정되는 대상)
- **Final Report** — **PDK+Family당 1개**, "참조형(스냅샷 아님)" 설계([docs/final-report-design.md](docs/final-report-design.md)):
  - 영역 구성: `LIB` / `PPA` / `MW` **3개 고정** + `USER`(자유 입력 영역, 삽입·드래그 재정렬 가능). 2차의 "블록을 library마다 하나씩(`N × 3 + 1`)"은 **폐기** — 세 영역이 각각 family 전체를 한 문단으로 집계한다
  - **영역별 개별 생성·재생성**(`genArea(type)`). 한 영역을 다시 생성해도 나머지는 그대로다. 영역 상태는 `empty → generating → ready`이고, 생성 조건이 영역마다 다르다(PPA는 리포트에 연결된 차트 필요, MW는 테이블 1개 이상)
  - **유효성(낡음) 판정을 프론트가 로컬에서 한다** — `areaSignature`(영역별 입력값 직렬화)를 생성 시점 값과 비교. 2차의 "백엔드가 `stale` 플래그를 계산해 내려줌"과 판정 주체가 반대다. 어느 쪽으로 갈지는 **미결**([docs/final-report-design.md](docs/final-report-design.md) §2-3, §8 #13)
  - **리포트 댓글 스레드**(작성자/시각/수정/삭제) 구현. 2차까지의 "단일 `user` 자유입력 블록으로 대체" 상태는 끝났고 둘은 별개 기능이다. 단 위젯은 최종 저장 이후에만 노출된다
  - 액션은 **edit / save / final-save** 3단. ⚠️ `frSave()`/`frFinalize()`는 **로컬 타임스탬프만 찍는 mock**이며, 저장 시점에 백엔드에 무엇을 보낼지는 **별도 보류 이슈**다([docs/final-report-design.md](docs/final-report-design.md) §5-0)
  - ⚠️ 잠금은 「저장」/「최종 저장」 버튼 숨김까지만 구현됨. `locked` 판정·5일 계산·세 탭의 편집 차단이 없다([docs/final-report-design.md](docs/final-report-design.md) §5-2)
  - `GET /clara/report/`류는 **아직 API.md에 정식 등재되지 않음.** 이번 포팅에 맞춘 API 초안은 [docs/final-report-design.md](docs/final-report-design.md) §7 — 영역 생성용 `POST /clara/report/area-draft/`와 댓글 `PUT`/`DELETE`가 신규다

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
  │       ├── LibraryReportView.vue  탭 컨테이너 + PDK/Family 컨텍스트바 + provide('report')
  │       ├── useReportStore.js      4탭 공유 상태·액션 (createReportStore, fmt)
  │       ├── TabLibraryInfo.vue     inject('report')
  │       ├── TabPpa.vue             inject('report')
  │       ├── TabMw.vue              inject('report')
  │       ├── TabFinalReport.vue     inject('report') + 영역 조립/유효성 판정
  │       ├── data.js          mock 데이터 + 백엔드 응답 shape 시뮬레이션
  │       └── report.css       페이지 전용 스타일
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
- `GET /cell-height/` — Cell Height 목록 (Library Report용). 3차 이후 **Release Path 표의 cell height 그룹 골격**에도 필요
- `GET /library-info/?pdk_id=&family=` — Library Info 탭 집계 (family 멤버 library별 release path + cell design, 1회 호출). ⚠️ 3차 포팅으로 **소비처가 Library Info 탭 → Final Report `LIB` 영역 요약으로 이동**했고 `release_paths`/`cell_design` 블록은 현재 화면에 그려지지 않는다 ([API.md](API.md) §12 주석 참조)
- `GET /cell-design/?pdk_id=&family=` — Cell Design 집계 (library × 대표 셀 × cell height × bit-width 지원 범위 + VTH별 셀 수, 1회 호출)
- `GET /mw/` — MW 테이블 로우 데이터 (pivot은 프론트에서 조립)

**아직 백엔드에 없는 것 — "요청 예정"** (전부 [docs/final-report-design.md](docs/final-report-design.md) §7 초안이며 **API.md 미등재**):

| 메서드 | 경로 | 용도 | 비고 |
|---|---|---|---|
| GET | `/report/?pdk_id=&family=` | 리포트 조회 (입력값 + 영역 + 유효성 재료) | 없으면 `404` |
| POST | `/report/` | 리포트 생성 (**빈 문서** — 2차의 "요약 생성"이 아니다) | |
| PUT | `/report/<id>/` | 저장 — 입력값 + 영역 전량 | **호출 시점은 보류 이슈** (§5-0) |
| POST | `/report/<id>/finalize/` | 최종 저장 | **호출 시점은 보류 이슈** (§5-0) |
| POST | `/report/area-draft/` | **영역(LIB/PPA/MW) AI 초안 생성. 3차 신규** — stateless, 리포트 행 불필요 | 3차 포팅의 "영역별 개별 생성"에 대응 |
| GET / POST | `/report/<id>/comment/` | 댓글 목록 / 작성 | |
| PUT / DELETE | `/report/<id>/comment/<cid>/` | **댓글 수정 / 삭제. 3차 신규** | 프론트에 이미 구현됨 |

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
- **LibraryReportView** — PDK/Family 컨텍스트바 + 4개 탭(Library Info / PPA / MW / Final Report) 전환. 선택 상태는 라우트 쿼리에 실려 딥링크 가능. `createReportStore()`를 만들어 `provide('report')`로 네 탭에 내려준다 (3차 — 이전의 탭별 props 전달을 대체)
- route query: `tab`(`info|ppa|mw|final`) · `pdk`(PDK id) · **`family`(family 이름)** · `set`(PPA 저장 셋 id). `family`는 2026-09-26에 `lib`를 대체했으며, 없거나 존재하지 않는 값이면 첫 family로 방어 fallback (`?lib=` 하위 호환은 두지 않음 — 외부 배포된 고정 링크가 없다). 복원은 mount 시 1회(`pdk` → `family` 순서 — `setFamily()`가 현재 `pdkId`로 MW 셋을 만들기 때문)
- 멤버 library 수는 각 탭 헤더가 `library N종`으로 표시한다 (2차에 있던 컨텍스트바 칩 strip은 3차 포팅에서 제거됨 — [docs/library-report-family-design.md](docs/library-report-family-design.md) §7 #17)
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
- **Library Report 전체 mock** — Library Info/PPA/MW/Final Report 4탭 모두 `data.js` 하드코딩으로 동작. `GET /clara/mw/`·`/clara/family/`·`/clara/library-info/`·`/clara/cell-design/`는 API 스펙 확정([API.md](API.md))되어 있고, 나머지는 백엔드 미연동. `src/api/cells.js`에 네 엔드포인트의 클라이언트가 아직 없다(의도적 — 호출부가 없으면 죽은 코드)
- **`data.js`에 죽은 코드** (3차 포팅 결과, 4차 갱신) — `finalReport()`·`libBlock()`·`ppaBlock()`·`mwBlock()`·`VTH_ALL`/`NANOSHEET_ALL`, 그리고 4차에서 화면 호출부를 잃은 `cellDesignByHeight()`가 남아 있다. `mwFlaggedCells()`/`MW_THRESHOLD`는 4차에서 **되살아났다**(`MW` 영역 요약이 §4 필터 규칙대로 호출). MW 필터 규칙·임계값 상수는 계약으로 유효하므로 **연동 시 어느 것이 되살아나는지 확정한 뒤 정리**한다
- ~~**Final Report 잠금이 미완성** (3차)~~ → **4차(9/27)에서 구현**. 스토어의 `GRACE_DAYS = 5` + 분 단위 `now` ref 기반 `locked`/`graceDaysLeft`를 네 탭이 참조해 편집 컨트롤을 막고, "수정 가능 D-N"은 실제 남은 일수로 계산한다. **남은 것**: `finalizedAt`이 로컬 타임스탬프라 새로고침하면 잠금이 풀린다(저장 트리거 보류 이슈에 묶임) + 백엔드 `403`/`editable_until` 짝맞춤
- ~~**family 전환 시 상태 누수** (3차)~~ → **4차(9/27)에서 수정**. `setFamily()`가 `releaseRows`(cell height별 빈 행으로 리셋, id 카운터는 계속 증가)·`gdsDesc`·`libDesc`·`ppaSetId`·`ppaLinkedId`도 초기값으로 되돌린다. **`setPdk()`는 여전히 리셋하지 않는다** — 세 영역 signature에 `pdkId`가 있어 stale 배지로 알리며, 리셋 여부는 기획 확인 항목 ([docs/final-report-design.md](docs/final-report-design.md) §8 #32)
- **MW 탭 표와 Final Report `MW` 요약의 기준이 다르다** (4차 신규) — 표의 빨간 하이라이트는 `MW_HIGH = 44`(CK Slope 전체), 요약은 `MW_THRESHOLD[mwType]`(CK Slope 40 고정). 요약을 계약(§4)에 맞춘 것이 4차 수정이고, 표를 어디에 맞출지는 결정 항목 ([docs/final-report-design.md](docs/final-report-design.md) §8 #31)

---

## 10. 백로그

### 10-1. 백엔드 협의 필요
- [ ] `chart_preset.group_by` 컬럼 `VARCHAR2(255)`로 길이 확장 (현재 길이 확인 필요)
- [ ] `chart_item.cell_alias` → `cell_tag` 리네임 + 빈 값 허용
- [ ] `chart_preset.x_axis`에서 `__label__` 문자열 허용
- [ ] `/clara/meta/?id=...` 필터 — chart restore 시 cell_id로 정확히 가져오기
- [ ] `/clara/library-info/`의 release path·GDS version 원천 테이블 확정 — ⚠️ **3차 포팅으로 둘 다 리포트 소유 사용자 입력이 되었다.** `library_release`(가칭) 마스터 신설이 불필요해질 수 있으므로 **백엔드 착수 전 확인 필요** ([docs/final-report-design.md](docs/final-report-design.md) §8 #20)
- [ ] `cell_meta`에 `cell_height_id` 추가 (현재 `cell_height` 문자열 ↔ `cell_height_id` int 불일치) — `API.md` **§12·§13이 같은 이름 조인으로 우회 중**
- [x] **대표 셀 기준 Cell Design이 library·PDK와 무관한지 확인** (3차 신규) — **무관하지 않다.** (PDK, library)별로 다르고, 집계는 백엔드가 해서 한 번에 내려준다 → 신규 `GET /clara/cell-design/?pdk_id=&family=` ([API.md](API.md) §13) 등재 완료 (2026-09-27)
- [ ] **`cell_meta`에 `rep_cell`/`bit_width` 원천 컬럼 신설 여부** (4차 신규) — 현재 `cell_meta.cell` 이름 파싱(`JSDFF2X` → `JSDFF` + 2bit)으로 우회. 이름 규칙이 라이브러리마다 다르면 조용히 오집계된다. **응답 shape은 어느 쪽이든 동일** ([API.md](API.md) §13, [docs/final-report-design.md](docs/final-report-design.md) §8 #27)
- [ ] **대표 셀 목록이 마스터 데이터인지** (4차 신규) — 마스터면 표시 순서·라벨을 응답에 실을 수 있고 §13의 "이름 오름차순" 순서 계약이 바뀐다 ([docs/final-report-design.md](docs/final-report-design.md) §8 #28)
- [ ] **`API.md` §12의 `cell_design` 블록 제거 여부** (4차 신규) — 소비처 상실이 확정됐다(§13이 가져갔다). §12 응답 shape 변경이므로 백엔드 합의 필요, `release_paths`와 같은 타이밍 ([docs/final-report-design.md](docs/final-report-design.md) §8 #29)
- [ ] **`GET /clara/report/` 계열 요청** (3차 갱신) — 영역별 생성 `POST /report/area-draft/`, 댓글 `PUT`/`DELETE` 포함 ([docs/final-report-design.md](docs/final-report-design.md) §7)
- [x] **Final Report 유효성(낡음) 판정 주체 결정** — **프론트 로컬 signature로 확정** (2026-09-27). 외부 원본 변경 감지(백엔드 `source_current_at`)는 가산하며 배지는 두 판정의 OR. signature 영속화는 저장 트리거 보류 이슈에 묶임 ([docs/final-report-design.md](docs/final-report-design.md) §2-3, §8 #13)
- [ ] 댓글 수정·삭제 권한 규칙 (작성자 본인만 vs SPiL 전원) — 현재 UI는 구분 없이 전체 노출 ([docs/final-report-design.md](docs/final-report-design.md) §8 #17)

### 10-2. 기술적 개선
- [ ] ECharts tree-shaking + 코드 스플리팅
- [ ] localStorage 스키마 버전 키
- [ ] 반응형 (모바일/태블릿) 검토
- [ ] 로그인 시스템 도입 → `CURRENT_USER` 교체

### 10-3. UX
- [ ] Cell Name 검색도 always-regex로 통일 (현재 substring + debounce)
- [ ] Chart 저장 시 labelTemplate도 함께 영속화 (현재 CSV로 호환 완료, JSONField로 확장 시 고려)

### 10-4. Final Report (Library Report) — 2026-09-17 스펙 산정 미팅 확정

> 2026-09-26 3차(UI 포팅) 기준으로 갱신.

- [x] Final Report 영역별 유효성 체크 (MW/PPA 변경 여부 확인) — **3차에서 프론트 로컬 signature 비교로 재구현**(`areaSignature`). 리포트 소유 입력 변경은 실제로 감지되지만 **외부 원본(ETL·chart) 변경은 감지하지 못한다.** 판정 주체 결정이 §10-1에 남아 있다
- [x] **영역별 AI 초안 생성 분리** — `genArea(type)`으로 영역마다 독립 생성·재생성. 단 생성 **내용**은 여전히 고정 문구 템플릿이며 실제 LLM 호출 없음. 엔드포인트 계약은 [docs/final-report-design.md](docs/final-report-design.md) §7-3
- [x] Library 이름 convention & gds version 설명 입력 기능 — **3차에서 UI 구현됨.** Library Info 탭의 Library List DESCRIPTION 열(library별) + Release Path 하단 GDS 설명 textarea(리포트당 1개). ⚠️ library별 설명의 소유자가 리포트인지 library 마스터인지는 미결([docs/final-report-design.md](docs/final-report-design.md) §8 #21)
- [~] 최종 저장 시 library info/MW/PPA 수정 불가 고정 — **액션 3단(edit/save/final-save)은 구현, 잠금은 미완성.** 5일 경과 판정·`editable_until`·세 탭 편집 차단이 없다 (§9 「알려진 이슈」 참조)
- [x] **Comment 기능 추가** (권한: SPiL 전원) — **3차에서 진짜 댓글 스레드 구현**(작성자·시각·수정·삭제). `USER` 자유입력 영역과는 별개 기능이 되었다. 남은 것: 권한 규칙(§10-1 백엔드 협의), 최종 저장 이전에도 노출할지([docs/final-report-design.md](docs/final-report-design.md) §8 #18), 백엔드 CRUD 4개
- [x] PPA & MW를 F.R.에 작게 요약 표시 — 영역별 `points`(flag/text/value) 3~4줄로 구현. 생성 시점 산출물이라 저장 대상이다
- [ ] PPA 백엔드+프론트 재점검
- [ ] ETL 재공유
- [ ] `GET /clara/report/` 백엔드 구현 + API.md 정식 등재 — 초안은 [docs/final-report-design.md](docs/final-report-design.md) §7. **3차 포팅에 맞춰 다시 씀**: 영역 생성 `POST /report/area-draft/` 신규, 댓글 `PUT`/`DELETE` 신규, 블록 `data` inline 확장 폐기, 블록 참조 키(`library_id`/`cell_height_id`/`mw_type`) 제거
- [ ] **저장/최종저장의 백엔드 연동 방식** — **보류 이슈**(사용자 지시). 현재 `frSave()`/`frFinalize()`는 로컬 타임스탬프만 찍는다. PUT 즉시 저장 vs 최종 저장에만 POST는 별도 논의 ([docs/final-report-design.md](docs/final-report-design.md) §5-0, §8 #12)

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
