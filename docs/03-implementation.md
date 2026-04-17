# UI 개선 구현 기록

> 브랜치: `claude/ui-improvements`  
> 작업 기간: 2026-04-16 ~ 2026-04-17  
> 기준: PROGRESS.md 섹션 10 백로그 (10-5 기술적 개선 제외)

---

## 1. 변경 파일 요약

| 파일 | 변경 내용 |
|------|----------|
| `src/stores/builderStore.js` | PDK/Library 필터, 단계적 선택, 컬럼필터 범위 제한 |
| `src/views/BuilderView.vue` | 액션바 (↓↑ + alias), 버튼 스타일 |
| `src/components/builder/CellSearchTable.vue` | PDK/Library 드롭다운, 즉시 검색, 컬럼 헤더 레이아웃 |
| `src/components/builder/SelectedCellsPanel.vue` | 체크박스 선택, Ratio 백분율, 드래그 선택 |
| `src/components/chart/ChartDisplay.vue` | 범례 우측, 축 스케일, 하이라이트 API |
| `src/components/chart/SourceDataTable.vue` | 컬럼 정렬, 호버 이벤트 |
| `src/views/ChartView.vue` | 라벨 토글, Export PNG 제거, 호버 하이라이트 |
| `src/composables/useDragSelect.js` | **신규** — 드래그 체크/언체크 컴포저블 |
| `public/data/column-config.json` | Temperature→Temp (°C), Nanosheet→Nano Sheet |

---

## 2. 백로그 항목별 구현 상세

### 10-1. 셀 검색 & 선택 (상단)

#### AND 조합 검색
- `builderStore.js`의 `filteredCells` computed에서 Cell Name 텍스트 검색과 컬럼 필터를 **모두 만족**하는 결과만 반환
- 순환 참조 방지를 위해 `preColumnFilteredCells` (cellType + pdk + libraries + query 필터만 적용) 와 `filteredCells` (+ columnFilters) 2단계로 분리

#### PDK / Library 드롭다운
- `CellSearchTable.vue`에 PDK (단일 선택, 360px) + Library (다중 선택, collapse-tags) 추가
- `builderStore.js`에 `setPendingPdk`, `setPendingLibraries`, `pdkOptions`, `libraryOptions` computed 추가
- PDK 변경 시 Library 자동 초기화 (cascading)
- `libraryOptions`는 선택된 PDK 기준으로만 옵션 표시

#### 즉시 검색 (Search 버튼 제거)
- 기존 Search 버튼 제거
- Cell Name 입력 시 300ms 디바운스 후 `store.applySearch()` 자동 호출
- PDK / Library 변경 시 즉시 `applySearch()`

#### 필수 조건 (3개 모두 선택 전 테이블 비우기)
- `canSearch`: cellType + pdk + libraries 모두 있어야 `true`
- `filteredCells`: 3개 미선택 시 빈 배열 반환
- `empty-text`를 "Select Cell Type, PDK, and Library to search"로 변경

#### 컬럼 헤더 레이아웃
- `.col-header` 내부: 좌측에 컬럼명 (최대 2줄, `-webkit-line-clamp: 2`), 우측에 필터/정렬 아이콘 세로 배치
- 단일 단어 (FEOL, BEOL 등)는 줄바꿈 없이 한 줄 표시 (`word-break: normal; overflow-wrap: normal`)

#### 컬럼 필터 범위 제한
- `columnFilterOptions`를 `allCells` 기준에서 `preColumnFilteredCells` 기준으로 변경
- 현재 테이블에 없는 값은 필터 옵션에 표시되지 않음

#### Diff / Ratio 백분율, 자릿수 정렬
- Ratio 모드: `x1.05` → `+5.00%` 형식으로 변경
- CSS `font-variant-numeric: tabular-nums`로 숫자 자릿수 정렬

#### 팝업 페이지당 표시 개수
- 이미 메인과 동일한 컴포넌트 공유로 자동 적용됨

#### 컬럼 너비
- `column-config.json`의 `:width` 사용 (fixed width)
- Temperature → Temp (°C) (90px), Nanosheet → Nano Sheet (90px) 등 약어 적용으로 공간 절약

---

### 10-2. Cell 선택 & Aliasing

#### 단계적 선택 (체크 → 화살표 → 추가)
- **이전**: 체크 시 즉시 store에 반영
- **이후**: 체크는 el-table 내부 상태만 변경, ↓ 버튼 클릭 시에만 `store.selectCells()` 호출
- `reserve-selection`으로 페이지 간 체크 상태 유지
- ↓ 클릭 후 검색 테이블 체크 자동 해제 (`clearChecks()`)

#### 액션바 UI
- 검색 테이블과 선택 패널 사이에 액션바 배치: `[↓] [alias input] [↑]`
- ↓: 체크된 셀을 하단에 추가 + alias 일괄 적용 (`store.batchSetAlias`)
- ↑: 하단에서 체크된 셀 제거 (`store.deselectCells`)
- 버튼 스타일: `text` 타입, 회색 (#909399), 경계선 없음

#### Alias 초기화
- `store.deselectCells` 시 해당 셀의 alias도 함께 삭제

---

### 10-3. Selected Cells (하단)

#### 체크박스 + 일괄 제거
- 우측 X 버튼 제거, 좌측에 `type="selection"` 컬럼 추가
- `handleSelectionChange`로 체크 상태 추적
- ↑ 버튼으로 체크된 항목 일괄 제거

#### 드래그 선택
- `useDragSelect` 컴포저블 적용
- 체크박스 열에서 마우스 누르고 드래그하면 연속 체크/언체크

---

### 10-4. 차트 탭

#### 범례 우측 배치
- `legend`: `orient: 'vertical'`, `right: 0`, `top: 80`, `width: 140`
- 텍스트 overflow truncate, 스크롤 페이지네이션
- `grid.right` 증가: secondary Y축 있을 때 240px, 없을 때 180px

#### 테이블 호버 → 차트 하이라이트
- `ChartDisplay.vue`에 `highlightCells(cellIds)` / `unhighlightAll()` expose
- 내부적으로 `_cellMap` (cellId → seriesIndex + dataIndex) 매핑 빌드
- `SourceDataTable.vue`에서 `row-hover` emit → `ChartView.vue`에서 `chartDisplayRef.highlightCells()` 호출
- ECharts `emphasis: { focus: 'self' }` + `blur: { itemStyle: { opacity: 0.3 } }` — 다른 시리즈는 살짝 흐려지는 효과

#### 라벨 고정 토글
- `ChartView.vue` 상단에 `el-switch` (active-text="Labels", inline-prompt)
- `showLabels` prop → `ChartDisplay.vue`의 모든 series `label.show` 제어
- Primary + Secondary 시리즈 모두 적용

#### Export PNG 제거
- `ChartView.vue` 좌상단 Export PNG 버튼 삭제
- ECharts toolbox의 Save Image (우상단) 유지

#### 차트 초기 줌
- `dataZoom` start/end: 5~95% → 0~100%로 변경 (데이터 잘림 방지)
- X/Y 축에 `scale: true` 추가 (0 기준 강제 포함 방지, 데이터 범위에 맞게 자동 스케일)

---

## 3. 신규 모듈

### `src/composables/useDragSelect.js`

el-table의 체크박스 열에서 클릭 & 드래그로 여러 행을 선택/해제하는 컴포저블.

**동작 방식:**
1. `onMounted`에서 테이블의 `.el-table__body-wrapper`에 네이티브 `mousedown` 리스너 부착
2. mousedown 시 클릭 위치가 selection 컬럼(체크박스)인지 DOM 탐색으로 판단
3. 현재 행의 선택 상태를 확인하여 target state (check/uncheck) 결정
4. `toggleRowSelection(row, targetState)` 호출
5. Element Plus의 후속 `click` 이벤트를 `capture: true, once: true`로 차단 (더블 토글 방지)
6. `cell-mouse-enter` 이벤트로 드래그 중 지나가는 행에 동일 target state 적용
7. `mouseup`에서 드래그 종료

**사용법:**
```javascript
const tableRef = ref(null)
const { onCellMouseEnter } = useDragSelect(tableRef)
// template: <el-table ref="tableRef" @cell-mouse-enter="onCellMouseEnter">
```

---

## 4. 커밋 이력

| # | 해시 | 내용 |
|---|------|------|
| 1 | `162e530` | 액션바 (↓↑) 위치 변경 — 검색/선택 테이블 사이 배치 |
| 2 | `efbba54` | 회색 버튼, 단계적 선택, 필수 필터 3개, 컬럼 필터 범위 제한 |
| 3 | `6b57b94` | getSelectionRows API 수정 (Element Plus 올바른 메서드명) |
| 4 | `3764458` | alias 초기화, 테이블 정렬, 범례 수정, 라벨 토글, 헤더 정리 |
| 5 | `40e87ff` | 추가 후 체크 해제, 컬럼 헤더 레이아웃, 차트 호버 하이라이트 |
| 6 | `a3eb911` | cell type 재선택 수정, 컬럼 사이징, 라벨 약어, 호버 블러 |
| 7 | `6365f21` | 드래그 선택 컴포저블, 컬럼 헤더 word-break |
| 8 | `b7d26ec` | 차트 초기 줌 범위 수정 (0~100%) |
| 9 | `d093f3c` | 축 scale:true 추가 (데이터 잘림 방지) |
| 10 | `032d3a9` | 체크박스 클릭 더블 토글 수정 |

---

## 5. 주요 기술 결정

| 결정 | 이유 |
|------|------|
| `preColumnFilteredCells` 분리 | columnFilters → columnFilterOptions → filteredCells 순환 참조 방지 |
| 네이티브 mousedown 리스너 | Element Plus에 `cell-mousedown` 이벤트 없음. `cell-click`은 mouseup 후 발생하여 드래그에 부적합 |
| click 이벤트 capture 차단 | mousedown에서 toggleRowSelection 후 Element Plus click이 다시 토글하는 더블 토글 문제 해결 |
| `emphasis.focus: 'self'` | `'series'` 사용 시 다른 시리즈가 완전히 사라져서 과한 효과. `'self'` + `blur.opacity: 0.3`으로 부드러운 페이드 |
| `scale: true` on axes | ECharts 기본 Y축은 0부터 시작. 데이터가 0.3~0.5 범위이면 상단에 압축됨 |

---

## 6. 미구현 / 남은 항목

| 항목 | 상태 | 비고 |
|------|------|------|
| 컬럼 너비 auto (콘텐츠 기준 자동 축소) | 미구현 | column-config.json의 fixed width 유지. 콘텐츠 기반 auto-fit은 가상 스크롤과 충돌 가능 |
| 10-5. 기술적 개선 전체 | 범위 외 | 백엔드 연동, tree-shaking, preset, localStorage 마이그레이션, 반응형 |
