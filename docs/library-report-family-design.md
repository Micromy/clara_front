# Library Report — Family 기반 Library 그룹핑 설계

> 작성일: 2026-09-26
> 대상: `/library-report` 페이지 (`src/views/library-report/*`)
> 근거: [../PROGRESS.md](../PROGRESS.md) 3-11, [../API.md](../API.md) §3/§10/§11/§12/§13, [final-report-design.md](final-report-design.md)
> 상태: 구현 완료 (mock 단계) · 2026-09-26 2차 라운드에서 Library Info 집계 API 반영 · **2026-09-26 3차 UI 포팅 반영** · **2026-09-27 4차 라운드에서 Cell Design 집계 API 반영**. API 계약은 `API.md` §11·§12·§13이 정본

---

## 0. 2026-09-26 3차 (UI 포팅) — 이 문서에서 유효한 것과 낡은 것

브랜치 `library-report-ui-port`에서 화면이 외부 도구로 재작성되어 포팅됐다. **family 기반 그룹핑 설계 자체는 무효화되지 않았다.**

### 유효한 것 (이 문서의 뼈대)

| 절 | 내용 | 상태 |
|---|---|---|
| §2 | family는 `library` 테이블의 컬럼, 자체 id 없음, 이름 문자열이 키 | **유효** — 스토어가 계속 `FAMILIES`/`findFamily(name)` 기반 |
| §2-2 | (PDK, family) 두 축이 페이지 스코프 | **유효** — `state.pdkId` + `state.familyName` |
| §2-3 | 배열 순서 = 표시 순서 계약 | **유효** |
| §3-2 | route query `tab`/`pdk`/`family`/`set` | **유효** — `LibraryReportView.vue`가 같은 4개 키를 읽고 쓴다 |
| §4-2 | PPA 탭의 library × metric 2단 헤더, 실측 기반 diff | **유효** — 구조 그대로 |
| §4-3 | MW 탭은 테이블에 library 축을 넣지 않고 family가 비교 셋을 구성 | **유효** — `makeFamilySet()` 그대로 |
| `GET /clara/family/` (API.md §11) | family별 library 목록 | **유효** |
| `GET /clara/library-info/` (API.md §12) | family 단위 집계 | **계약은 유효, 소비처가 이동** — §4-1 참조 |
| `GET /clara/cell-design/` (API.md §13) | 대표 셀 Cell Design의 family 단위 집계 | **4차 신규** — 3차에서 열린 "library 축 없음" 문제의 답 |

### 낡은 것

| 절 | 낡은 내용 | 실제 |
|---|---|---|
| §3-1 | Family select 오른쪽의 멤버 library 칩 strip | **포팅에서 사라졌다.** 헤더는 PDK 드롭다운 + Family select만 |
| §3-3 | 네 탭에 `:pdk`/`:family` props 전달 | **`provide/inject` 중앙 스토어로 교체** (§3-4 신규) |
| §4-1 | Release Path / Cell Design에 `LIBRARY` 열을 추가해 `library × height`로 쌓는다 | **전면 교체.** Release Path는 리포트 소유 편집 목록, Cell Design은 대표 셀 뷰 (§4-1 3차 절) |
| §4-4 | 블록을 library마다 하나씩 (`library_id`), library N개면 N×3+1 블록 | **영역 3개 고정 + USER 영역.** 세 영역이 family 전체를 집계 |
| §5-1 / §5-2 | `fr_block.library_id` 추가 + CHECK 제약 | **폐기.** → [final-report-design.md](final-report-design.md) §3-2 |

**즉 바뀐 것은 (a) Library Info 탭의 화면 구성, (b) Final Report의 생성 입도와 블록 스코프, (c) 컴포넌트 간 상태 전달 방식이다. family 스코프 자체는 아니다.**

---

## 1. 범위

Library Report의 컨텍스트 단위가 **library 1개 → family 1개(= library N개)** 로 바뀐다. 4개 탭(Library Info / PPA / MW / Final Report)은 "library 하나"를 그리던 구조에서 "family 멤버 library들"을 그리는 구조가 된다.

### 범위 밖

| 대상 | 이유 |
|---|---|
| `src/stores/builderStore.js`, `src/components/builder/*` | 메인 CLARA PPA 빌더. Library 다중선택은 이 변경과 무관 |
| `GET /clara/lib/` 응답 스키마 (`{ id, library }`) | 변경 없음 — family는 `/clara/family/`로만 노출 |
| `GET /clara/mw/`, `GET /clara/cell-height/` 계약 | library 단위 조회 그대로 유효 (§4-3). (family 단위 묶음 여부는 §7 #7 — 이번 라운드 미결) |
| 백엔드 구현 | 이 저장소는 프론트 전용. API 계약(`API.md` §11)까지가 책임 |

### 필드명 규칙

- 와이어(HTTP)는 snake_case, 프론트 코드는 camelCase (`src/api/client.js`의 `toCamel()`).
- 단 `data.js`의 Final Report mock **과 `libraryInfo()` · `cellDesignStats()`** 는 예외 — 백엔드 응답 원형을 그대로 재현하므로 snake_case(`block_type`, `library_id`, `release_paths`, `gds_version`, `cell_count`)를 유지한다.
- §13 응답의 `rep_cells`/`bit_width`/`cell_count`/`*_axis`도 같은 예외다.
- `GET /clara/family/`의 응답 필드(`family`, `libraries`, `id`, `library`)는 언더스코어가 없어 `toCamel()` 전후가 동일하다 — 변환 사고 지점이 없다.

---

## 2. Family 데이터 모델

### 2-1. family의 정체

family는 **`library` 테이블에 추가된 컬럼**이다. 따라서:

- **별도 마스터 테이블이 아니며 자체 id가 없다.** 식별자는 문자열 이름이다.
- 프론트의 키(route query, mock의 `find`, `v-for :key`)는 전부 **family 이름 문자열**을 쓴다.
- 추후 family가 마스터 테이블로 승격되면 `family_id`를 **가산적으로** 추가할 수 있다. 지금 `family_id`를 미리 만들지 않는다.

### 2-2. 관계

```
PDKVersion (GET /clara/pdk/)          ← 컨텍스트 축 1 (변경 없음)
     │
     │  (Library Report는 PDK × Family 두 축으로 스코프가 결정된다)
     │
Family  = library.family 컬럼의 distinct 값 (마스터 테이블 아님, id 없음)
     │
     └─ 1 : N ─→ Library (GET /clara/lib/ 의 { id, library })
                     │
                     ├─ N : M ─→ CellHeight        (release path / cell design / MW 축)
                     ├─ 1 : N ─→ spil_mw_meta      (MW 탭 · MW 블록의 원천)
                     └─ 참조   ─→ Chart/ChartItem   (PPA 탭의 저장 셋)
```

- family ↔ library는 **1:N**. library는 family를 0개 또는 1개 가진다(컬럼이므로).
- `family`가 NULL·빈 문자열인 library는 **Library Report에서 접근할 수 없다.** `GET /clara/family/`가 그런 library를 응답에서 제외하기 때문이다. 메인 PPA 빌더는 계속 `GET /clara/lib/`(전체)를 쓰므로 영향 없음.
- family는 PDK와 독립이다. `GET /clara/lib/`가 PDK 필터를 갖지 않는 현재 구조를 그대로 따른다. 즉 **같은 family를 어느 PDK에서도 선택할 수 있고, 해당 PDK에 데이터가 없으면 각 탭이 빈 결과를 보인다.**

### 2-3. 순서 계약

family 안의 library 순서는 **응답 배열 순서 = 화면 표시 순서**다. 백엔드는 `ORDER BY library.family, library.id`로 안정 정렬해 내려주고, 프론트는 재정렬하지 않는다.

이유: family 도입 후 library는 **PPA 탭의 열 그룹**, **Library Info 표의 행 그룹**, **MW 비교 셋의 테이블 순서**가 된다. 순서가 호출마다 흔들리면 비교 화면이 매번 달라 보인다.

### 2-4. Mock 데이터 (`src/views/library-report/data.js`)

기존 `LIBS = ['LIBA','LIBB']`를 삭제하고 `GET /clara/family/` 응답 shape을 그대로 재현하는 `FAMILIES` + `findFamily(name)`로 대체했다 (기존 `PDKS`가 `GET /clara/pdk/` shape을 재현하는 방식과 동일).

| family | libraries |
|---|---|
| `FAMA` | `LIBA`(1), `LIBB`(2) |
| `FAMB` | `LIBC`(3), `LIBD`(4), `LIBE`(5) |
| `FAMC` | `LIBF`(6) |

- `findFamily`는 기존 `findPdk(id)`와 같은 방어 패턴(없으면 첫 원소)을 따른다.
- **library가 1개인 family(`FAMC`)를 일부러 포함한다.** N=1 경계(참조 비교 불가, diff 토글 무의미)가 리뷰 중에 눈에 보여야 한다.
- library 이름은 기존 `LIBA`/`LIBB` 톤을 유지한다 — 가공 이름이며, 이 페이지는 공개 URL에 게시된다(`data.js` 최상단 주석).
- **기존 `LIBA`/`LIBB`의 값 연속성을 지킨다**: 모든 seed 문자열에 library 이름을 그대로 쓰고 기존 seed의 구성 순서를 바꾸지 않으므로, 이번 변경 후에도 `LIBA`의 숫자는 이전과 동일하게 생성된다. 리뷰어가 "숫자가 왜 바뀌었나"를 묻지 않게 하는 것이 목적이다.

---

## 3. 컨텍스트바와 라우팅 (`LibraryReportView.vue`)

### 3-1. 컨텍스트바 UI

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [PDK  AX5  HSPICE V1.2.0.0 ▾]  [Family  FAMA ▾]  LIBA LIBB              │
└──────────────────────────────────────────────────────────────────────────┘
   └ 기존 커스텀 드롭다운 (변경 없음)  └ 기존 <select> 재사용  └ 신규: 읽기 전용 멤버 칩
```

| 컨트롤 | 변경 |
|---|---|
| PDK 드롭다운 | **변경 없음** (`lr-pdk-*` 마크업/스타일 그대로) |
| Library `<select>` | **Family `<select>` 로 교체.** 라벨 `Library` → `Family`, 옵션은 `FAMILIES`의 `family` 이름. 단일 선택. `width: 112px` 유지 |
| (신규) 멤버 library 칩 | Family select 오른쪽에 읽기 전용 칩 strip (`.lr-fam-libs` / `.lr-fam-lib`). family 선택이 곧 library N개 선택이라는 사실을 화면에 보여야 한다. mono 11px 회색, 4개 초과 시 `+N`으로 접는다 → ⚠️ **3차 포팅에서 제거됨.** 멤버 수는 각 탭 헤더가 `library N종`으로 표시한다(Library Info·PPA·MW·Final Report 전부). 컨텍스트바에서 멤버를 보여주는 affordance는 없어졌다 |

### 3-2. Route query

| 키 | 이전 | 이후 | 비고 |
|---|---|---|---|
| `tab` | `info\|ppa\|mw\|final` | **변경 없음** | |
| `pdk` | PDK id | **변경 없음** | |
| `lib` | library 이름 | **삭제** | |
| `family` | — | **신규** — family 이름 | 없거나 미존재 값이면 `FAMILIES[0].family` (기존 `pdk`/`tab`과 같은 방어 패턴) |
| `set` | saved set id | **변경 없음** | PPA 탭 소유 |

- **딥링크 하위 호환(`?lib=LIBA` → family 자동 해석)은 넣지 않는다.** 이 페이지는 전량 mock이고 외부에 고정 링크를 배포한 적이 없다. 없는 요구에 마이그레이션 코드를 만들지 않는다. 구 링크는 기본 family로 열린다.
- `setQuery({ family })`는 기존 헬퍼를 그대로 쓴다. **`set`은 함께 초기화하지 않는다** — 저장 셋은 library가 아니라 chart에 묶인 개념이고, family를 바꿔도 같은 셋을 다른 family로 다시 그리는 것이 PPA 탭의 자연스러운 동작이다.

### 3-3. 탭 props 계약 (⚠️ 2차까지 — 3차에서 §3-4로 교체)

네 탭 모두 **`family` 객체 하나**로 통일한다. library 배열을 별도 prop으로 중복 전달하지 않는다(`props.family.libraries`로 접근). 기존 `lib: String` prop은 네 탭에서 모두 제거했다.

```html
<TabLibraryInfo v-if="tab === 'info'"   :pdk="pdk"      :family="family" />
<TabPpa         v-else-if="tab==='ppa'" :pdk-id="pdkId" :family="family" />
<TabMw          v-else-if="tab==='mw'"  :pdk-id="pdkId" :family="family" />
<TabFinalReport v-else                  :pdk="pdk"      :family="family" />
```

`family` computed는 `FAMILIES`의 원소 참조를 그대로 반환하므로, family가 실제로 바뀔 때만 참조가 바뀐다 — 각 탭의 `watch(() => props.family, …)`가 `pdk`/`set` 변경에는 반응하지 않는 이유다.

### 3-4. 중앙 스토어 계약 (2026-09-26 3차)

**props가 전부 사라지고 `provide/inject` 하나로 교체됐다.** 네 탭 컴포넌트는 props를 받지 않는다.

```js
// LibraryReportView.vue
const store = createReportStore()   // useReportStore.js
provide('report', store)

// 각 탭
const { state, actions, pdk, family } = inject('report')
const p   = computed(() => pdk())      // findPdk(state.pdkId)
const fam = computed(() => family())   // findFamily(state.familyName)
```

| 항목 | 이전 (props) | 이후 (store) |
|---|---|---|
| 컨텍스트 전달 | `:pdk` / `:family` props | `inject('report')` → `pdk()` / `family()` 함수 |
| 탭 내부 상태 | 각 컴포넌트의 `ref` (탭 전환 시 unmount로 소실) | **`state` 한 곳에 모여 탭 전환에도 유지** |
| 탭 간 의존 | route query(`set`)로만 간접 전달 | `state.ppaLinkedId`/`state.mwSets`/`state.releaseRows`를 Final Report가 직접 읽는다 |
| 컨텍스트 변경 부수효과 | 각 탭의 `watch(() => props.family, …)` | `actions.setFamily()` 하나가 전부 처리 |

**이것이 3차 포팅의 진짜 동기다.** Final Report가 "다른 탭에서 사용자가 만든 구성"(PPA 연결·MW 셋·release path 입력)을 읽어 요약해야 하므로, 탭이 각자 상태를 들고 unmount 시 버리는 구조로는 불가능했다. 그 결과 [final-report-design.md](final-report-design.md) §3-1처럼 **리포트가 세 탭의 사용자 입력을 소유**하게 되었다.

부수 효과:

- **MW 비교 셋과 Final Report 영역이 탭 전환으로 소실되지 않는다** (§6의 이전 동작이 바뀌었다).
- `state`에 화면 상태(`pdkMenuOpen`, `picking`, `dragIndex`, `commentEditDraft` …)와 영속 대상(`releaseRows`, `mwSets`, `frAreas` …)이 **섞여 있다.** 저장 payload를 만들 때 무엇을 보낼지 선별이 필요하다 — [final-report-design.md](final-report-design.md) §3-6이 그 경계를 정리한다.
- `actions.setFamily()`가 리셋 대상을 하드코딩한다. 빠진 것이 있으면 조용히 상태가 새는데, 실제로 `releaseRows`/`gdsDesc`/`libDesc`/`ppaLinkedId`가 빠져 있다 → §7 #11.

---

## 4. 탭별 설계

### 4-0. `data.js` 함수 시그니처 총괄

| 이전 | 이후 | 변경 성격 |
|---|---|---|
| `export const LIBS` | `FAMILIES`, `findFamily(name)` | 교체 |
| `releasePaths(lib)` | `releasePaths(library)` | **유지.** 호출부가 `libraryInfo()`(집계)와 `libBlock()`(리포트 블록) 둘 |
| `export const CELL_DESIGN` | `cellDesign(library)` + 내부 `CELL_DESIGN_BASE` | **상수 → 함수.** cell design은 library별로 다를 수 있다. **유지** — 호출부가 `libraryInfo()`와 `libBlock()` 둘 |
| (신규) | `libraryInfo(pdkId, family)` | 신규 — 위 두 함수를 family 멤버 전체로 합쳐 `GET /clara/library-info/` 응답 shape 반환 |
| `ppaRows(set, pdkId, lib, refLib)` | `ppaTable(set, pdkId, libraries, refLibrary)` | **시그니처·반환 shape 변경** |
| (신규) | `export const PPA_METRICS` | 열 정의를 컴포넌트에서 data.js로 이동 (library마다 반복되므로) |
| `mwTable(pdkId, lib, height, mwType)` | **변경 없음** | 테이블 1개 = library 1개 = `GET /clara/mw/` 1회 |
| `mwFlaggedCells(pdkId, lib, height, mwType)` | **변경 없음** | library 단위 유지 |
| `finalReport({ pdkId, lib, savedSetId })` | `finalReport({ pdkId, family, savedSetId })` | `lib` 문자열 → `family` 객체 |
| `HEIGHTS`, `CK_SLOPES`, `MW_TYPES`, `CELLS`, `VTH_ALL`, `NANOSHEET_ALL`, `SAVED_SETS`, `PDKS`, `MW_THRESHOLD`, `hash`, `mk`, `findPdk`, `findSavedSet` | **변경 없음** | |

결정적(seed 기반) 생성 규칙은 그대로 유지한다. 모든 신규 seed 문자열에 library 이름을 포함시키고, 기존 seed 문자열의 구성 순서는 바꾸지 않는다(§2-4의 값 연속성).

#### 3차 델타 (2026-09-26 UI 포팅)

| 변경 | 내용 |
|---|---|
| **신규** `REP_CELLS`, `cellDesignByHeight(rep)` | 대표 셀 기준 Cell Design 뷰. **library·pdk 인자가 없다** — 대표 셀 이름 1개만 받는다. 축 상수 `CELL_DESIGN_VTH_AXIS`(top-level export) + 내부 `BIT_POOL`/`DRIVE_AXIS`/`NS_AXIS`. ⚠️ **4차에서 인자 없음이 표시 오류로 확정되어 화면 호출부가 `cellDesignStats()`로 옮겨졌다** — 아래 4차 델타 |
| **신규** `useReportStore.js` | `createReportStore()` + `fmt(ts)`. 상태·액션 전부. `data.js`를 import해 쓰고, `PDKS`/`FAMILIES`를 재export한다 |
| **호출부 소멸** `finalReport()`, `libBlock()`, `ppaBlock()`, `mwBlock()`, `mwFlaggedCells()` | 어디서도 호출하지 않는다. 그것들만 쓰던 `MW_THRESHOLD`/`VTH_ALL`/`NANOSHEET_ALL`도 죽었다. **삭제하지 않고 남겨 두었다** — MW 필터 규칙은 계약으로 유효하므로 연동 시 되살아날 수 있다 |
| `libraryInfo(pdkId, family)` | **유지되지만 소비처가 이동.** Library Info 탭이 아니라 **Final Report의 `LIB` 영역 요약**이 유일한 호출부다(§4-1) |
| `cellDesign(library)` / `releasePaths(library)` | `libraryInfo()`를 통해서만 살아 있다. 화면에 직접 그려지지 않는다 |
| `mwTable()` / `ppaTable()` / `PPA_METRICS` / `findSavedSet()` / `SAVED_SETS` | **변경 없음** |

#### 4차 델타 (2026-09-27 Cell Design 집계)

| 변경 | 내용 |
|---|---|
| **신규** `cellDesignStats(pdkId, family)` | `GET /clara/cell-design/`(API.md §13) 응답 shape을 mock으로 재현. 시드에 `pdkId`와 `library`를 포함해 **(PDK, library)마다 다른 값**이 나온다. 축 3개(`drive_axis`/`nanosheet_axis`/`vth_axis`)를 응답에 실어 컴포넌트가 상수를 import하지 않게 한다 |
| **신규(내부)** `cellDesignHeights(seed)` | `cellDesignByHeight()` 본문을 시드 접두사만 인자화해 들어낸 것. 두 함수가 이 규칙 하나를 공유하므로 로직 중복이 없다 |
| `cellDesignByHeight(rep)` | **시그니처·export·반환값 전부 동일** (본문이 `cellDesignHeights(rep)` 한 줄로 축소). 접두사가 `rep`일 때 시드 문자열이 이전과 같아 값이 바뀌지 않는다. **화면 호출부는 없어졌다** — 삭제하지 않은 이유는 `data.js`의 기존 죽은 코드 정책과 같다(§8) |
| `REP_CELLS` / `CELL_DESIGN_VTH_AXIS` | export 유지, 외부 호출부 없음. `REP_CELLS`는 대표 셀이 마스터 데이터로 확정되면 `GET`으로 바뀌는 자리다 |
| `BIT_POOL` / `DRIVE_AXIS` / `NS_AXIS` | **변경 없음.** `bit_width`(int) 변환은 `cellDesignStats()` 안에서만 한다 — `BIT_POOL`을 고치면 `cellDesignByHeight`의 값이 바뀐다 |
| `mwFlaggedCells()` / `MW_THRESHOLD` | **함수 자체는 무변경, 죽은 코드에서 벗어났다** — Final Report `MW` 영역 요약이 §4 필터 규칙대로 이 둘을 호출한다 ([final-report-design.md](final-report-design.md) §8 #31) |
| `libraryInfo()` / `releasePaths()` / `cellDesign()` / Final Report mock 전부 | **변경 없음.** `libraryInfo()`가 `pdkId`를 값에 반영하지 않는 비대칭은 관찰만 기록한다(§12 `cell_design`은 소비처가 없다) |

### 4-1. Library Info 탭

> **이 절은 3차(2026-09-26 UI 포팅)에서 전면 교체됐다.** 아래 `#### 3차 — 대표 셀 뷰로 전환`이 현재 화면이고, 그 뒤의 1·2차 결정은 **이력**으로 남긴다.

#### 3차 — 대표 셀 뷰로 전환 (2026-09-26, 현행)

탭이 네 블록으로 재구성됐다. **family 스코프는 유지되지만, 세 번째·네 번째 블록에서 library 축이 사라졌다.**

| 블록 | 구성 | 데이터 출처 | 편집 |
|---|---|---|---|
| **PDK 버전 정보** | PROCESS / HSPICE / LVS / PEX 1행 | `pdk()` = `GET /clara/pdk/` | 읽기 전용 |
| **Library List** (신규) | 행 = family 멤버 library. `NAME` + `DESCRIPTION` | 이름은 `family().libraries`(= `GET /clara/family/`), 설명은 **사용자 입력** `state.libDesc[lib]` | **항상 편집 가능** (편집 모드와 무관) |
| **Release Path** | 행 = **사용자가 만든 release 행**. cell height로 **그룹화**(`CELL HEIGHT` / `RELEASE PATH` / `GDS VERSION`) + 하단 GDS 설명 textarea | **전부 사용자 입력** — `state.releaseRows`, `state.gdsDesc` | 편집 모드에서 행 추가/삭제/수정 |
| **Cell Design** | **library 그룹 N개** × 대표 셀 블록 × cell height 행 × bit-width 카드. 카드 안에 drive 칩 / nanosheet 칩 / VTH 막대(top-cell 개수) | `cellDesignStats(pdkId, family)` — **library × 대표 셀 스코프** (API.md §13). 4차에서 `cellDesignByHeight(rep)`를 대체 | 읽기 전용 |

```
Release Path (편집 모드)
┌────────────┬──────────────────────────┬─────────────┬───┐
│ CELL HEIGHT│ RELEASE PATH             │ GDS VERSION │   │
├────────────┼──────────────────────────┼─────────────┼───┤
│            │ /proj/lib/…/r4           │ V1.0.0.0    │ × │
│   CH120    ├──────────────────────────┼─────────────┼───┤   ← 같은 height에 행 N개
│            │ /proj/lib/…/r3           │ V0.9.5.0    │ × │
│            ├──────────────────────────┴─────────────┴───┤
│            │ + 행 추가                                   │
├────────────┼──────────────────────────┬─────────────┬───┤
│   CH150    │ …                        │ …           │ × │
└────────────┴──────────────────────────┴─────────────┴───┘
      ↑ 그룹 라벨. 인접한 같은 height를 묶은 것 → 배열 순서가 의미를 갖는다

Cell Design
● JSDFF
  CH120  ┌ 1bit ─────────┐ ┌ 2bit ─────────┐   ← height마다 지원 bit 집합이 다르다
         │ drive  D1 D2  │ │ drive  D1 D3  │
         │ ns     N1 N2  │ │ ns     N1     │      흐린 칩 = 미지원
         │ VTH ▬▬▬▬ 240  │ │ VTH ▬▬   120  │      막대 = top-cell 개수
         └───────────────┘ └───────────────┘
  CH150  ┌ 1bit ─────────┐
● JSDFFR
  …
```

**설계상 중요한 귀결 3가지:**

1. **Release Path와 GDS version이 조회 데이터에서 사용자 입력으로 넘어갔다.** 1·2차 설계는 GDS version을 *쿼리 집계*로 못 박았는데(§4-1 2차 절, `API.md` §12), 지금은 사용자가 타이핑한다. 릴리스 경로에 **library 축도 없다** — family 전체에 대한 목록 1개다. 소유자는 리포트이며 스키마는 [final-report-design.md](final-report-design.md) §3-5에 정리했다.
2. **`GET /clara/library-info/`(API.md §12)는 이 탭의 소비처를 잃었다.** 2차에서 이 탭 = 집계 API 1회였는데, 3차 코드에서 `libraryInfo()`를 호출하는 곳은 **Final Report의 `LIB` 영역 요약**뿐이다(library 수와 GDS version 집합을 세는 데 쓴다). 계약 자체는 유효하지만 **`release_paths` 블록은 아무도 그리지 않으며**, `cell_design` 블록의 축(library × height × drive/vth/nanosheet)은 화면이 그리는 축(대표 셀 × height × bit-width)과 다르다.
3. **Cell Design의 축이 완전히 교체됐다.** `cellDesignByHeight(rep)`에 library·pdk 인자가 없어서, 화면은 "어느 library의 지원 범위인가"를 말하지 않는다. **이것이 mock의 한계인지 실제로 PDK/library 공통 속성인지 확인이 필요하다** — §7 #12, 그리고 필요한 신규 엔드포인트 초안은 [final-report-design.md](final-report-design.md) §8 #11-a.
   → **4차(2026-09-27)에서 해결됐다.** mock의 한계였고 (PDK, library) 스코프가 맞다. 아래 4차 소절 참조.

포팅 후에도 **family 스코프는 그대로다**: 헤더가 `{family} · library N종`을 표시하고 Library List가 family 멤버로 채워지며, 컨텍스트바의 Family select가 그 축을 정한다.

오픈 항목(→ §7):

- Release Path 그룹은 `HEIGHTS` 상수에서 오는 mock 3행으로 시작하고, **기존 그룹 안에만 행을 추가할 수 있다**(`addReleaseRowInGroup(height)`). 그룹의 행을 전부 지우면 그 height를 되살릴 수 없다 → 실 연동에서 `GET /clara/cell-height/`로 골격을 만들어야 한다(#13).
- Library List의 DESCRIPTION은 `infoEditing`과 무관하게 항상 편집 가능하다 — 편집 게이트 불일치(#14).
- 대표 셀 목록(`REP_CELLS`)이 마스터 데이터인지 미확인 — #12는 4차에서 닫혔고 마스터 여부만 [final-report-design.md](final-report-design.md) §8 #28로 남았다.

---

#### 4차 — Cell Design에 library 축 복원 (2026-09-27)

3차의 귀결 3번이 제기한 질문의 답이 나왔다: **대표 셀 기준 지원 범위는 (PDK, library)별로 다르다.** `cellDesignByHeight(rep)`이 인자 하나로 전역 동작한 것은 mock의 한계였고, 화면이 어느 library의 범위인지 말하지 않는 **표시 오류**였다.

집계는 **백엔드가 한 번에** 해서 내려준다 — `GET /clara/cell-design/?pdk_id=&family=` ([../API.md](../API.md) §13). `GET /clara/mw/`류(프론트가 로우 데이터를 pivot)가 아니라 `GET /clara/library-info/`(§12)와 같은 family 단위 집계 1회다.

```
[3차]  REP_CELLS.map(rep => cellDesignByHeight(rep))    ← 호출 4회, library 축 없음
[4차]  design     = cellDesignStats(state.pdkId, fam)   ← 호출 1회
       designLibs = design.libraries.map(…)             ← 펼치기만
```

화면 구조:

```
Cell Design                       ← 부제: "library × 대표 셀 · cell height별 표"
LIBA                 대표 셀 4종  ← .lib-design-head (아래 경계선으로만 구분)
  ● JSDFF
    CH120  ┌ 1bit ┐ ┌ 2bit ┐
    CH150  ┌ 1bit ┐
  ● JSDFFR …
LIBB                 대표 셀 4종  ← library 그룹 사이 간격 22px, 대표 셀 사이 16px
  ● JSDFF …
```

- `.rep-block` 내부(대표 셀 헤더 · height 행 · bit 카드 · VTH 막대)는 **한 줄도 바뀌지 않았다.** 추가된 것은 `.rep-list` 바깥의 `.lib-design-list` > `.lib-design` > `.lib-design-head` 세 겹과 CSS 4줄이다.
- library 헤더에 `.rep-head`의 파란 dot을 재사용하지 않는다 — dot은 대표 셀 마커이고, 상위 계층이 같은 마커를 쓰면 계층이 평평하게 읽힌다.
- **축 3개가 응답 top-level에서 온다.** 컴포넌트가 `DRIVE_AXIS`/`NS_AXIS`/`CELL_DESIGN_VTH_AXIS`를 import하지 않는다 — 축이 계약상 응답 소유가 됐으므로 프론트가 상수로 아는 경로를 남기면 출처가 둘이 된다.
- **PDK 드롭다운을 바꾸면 Cell Design 값이 바뀐다** (이전엔 불변). `cellDesignStats()`의 시드에 `pdkId`가 들어간 결과이며 의도한 변경이다. `libraryInfo()`는 여전히 `pdkId`를 값에 반영하지 않는다 — 그 블록은 소비처가 없어 일부러 두었다(§8).
- `rep_cells: []`인 library는 mock이 만들지 않지만, 이 구조에서는 그 library의 헤더가 `대표 셀 0종`으로 남는다 — §12의 표(행이 사라져 library 자체가 보이지 않았다)보다 계약("데이터 없음" ≠ "library 없음")에 가깝다.
- 카드 수가 library 배수로 늘어나 스크롤이 길어지는 것은 **UX 결정 항목으로 남겼다** → §7 #18.

---

#### (이력) 1·2차 결정: 표를 쪼개지 않고 **LIBRARY 열을 추가해 한 표에 세로로 쌓는다**

| 섹션 | family 도입 후 |
|---|---|
| **PDK 버전 정보** | **변경 없음.** PDK는 family와 직교하는 컨텍스트 축이며 family 멤버 전체에 공통이다 |
| **Release Path** | 행 = `library × height`. **LIBRARY 열을 첫 열로 추가.** 정렬은 library 순서(§2-3) → `HEIGHTS` 순서 |
| **Cell Design** | 행 = `library × height`. **LIBRARY 열을 첫 열로 추가.** 값은 `cellDesign(library)`로 library별 생성 |

library별 별도 `lr-box` N개로 나누지 않는 이유: family를 묶는 목적이 **같은 height에서 library 간 GDS version·지원 범위 차이를 보는 것**이다. 표가 나뉘면 눈이 좌우로 이동해야 하고, 같은 height 행이 서로 다른 y 위치에 놓인다. 한 표에 쌓으면 height가 같은 행끼리 가까이 온다.

```
Release Path
┌─────────┬────────┬───────────────────────────────────────┬─────────────┐
│ LIBRARY │ HEIGHT │ RELEASE PATH                          │ GDS VERSION │
├─────────┼────────┼───────────────────────────────────────┼─────────────┤
│ LIBA    │ CH120  │ /proj/lib/LIBA/ch120/release/r4       │ V1.0.0.0    │
│ LIBA    │ CH150  │ /proj/lib/LIBA/ch150/release/r3       │ V0.9.5.0    │
│ LIBA    │ CH180  │ /proj/lib/LIBA/ch180/release/r2       │ V0.9.5.0    │
├─────────┼────────┼───────────────────────────────────────┼─────────────┤  ← .group-start
│ LIBB    │ CH120  │ …                                     │ …           │
└─────────┴────────┴───────────────────────────────────────┴─────────────┘
```

- **LIBRARY 값은 각 행에 반복 출력한다.** 헤더/본문이 별개 grid div인 현재 구조에서 rowspan은 불가능하고, 값 억제는 CSV/스크린샷에서 정보가 사라진다. 대신 library가 바뀌는 첫 행에 `.group-start`(위쪽 실선)를 줘서 그룹 경계를 보인다. 표의 **첫 행은 제외**한다 — 헤더 경계선이 이미 그 자리에 있다.
- grid 정의: `.g-path` `72px 72px minmax(230px, 1fr) 96px`, `.g-design` `72px 72px 150px 200px 170px 90px` (각각 72px 열 1개 추가). `column-gap`, `.lr-equal-width`, `.mini`, `.lr-note`는 그대로.
- 섹션 타이틀 옆에 스코프를 밝힌다: `N libraries × M heights`.
- `PLACEHOLDER` GDS 안내 note는 그대로 둔다 (미결정 문구, 이번 범위 아님).
- `v-for` 키는 `` `${r.library}-${r.height}` `` — library 간 height가 중복되므로 `r.height` 단독 키는 깨진다.

#### (이력) 집계 API로 전환 (2026-09-26 2차)

- 탭이 family 멤버 library마다 따로 조회하지 않는다. **`GET /clara/library-info/?pdk_id=&family=`([../API.md](../API.md) §12) 1회**로 family 전체의 Release Path + Cell Design을 받는다. mock에서는 `libraryInfo(pdkId, family)` 호출 1개 = `info` computed 1개이며, 실 연동 시 그 우변만 API 호출로 바뀐다.
- 응답이 `family` → `libraries[]` 중첩이므로 **컴포넌트는 표 행으로 펼치기만 한다** — `flatRows(libraries, key)`가 `library` 이름을 각 행에 주입하고 `groupStart`(library 경계선)를 계산한다. 두 표가 같은 규칙으로 LIBRARY 열을 얻는다(이전에는 `cellDesign()`이 행에 `library`를 붙여줬다).
- 템플릿 필드명이 와이어 이름으로 바뀐다: `r.gds` → **`r.gds_version`**, `r.cells` → **`r.cell_count`**. 나머지(`height`/`path`/`drives`/`vths`/`nanosheet`/`library`/`groupStart`)는 이름 동일.
- **표 구성·열·그리드·스타일은 변경 없음** (아래 1차 결정 그대로). 화면 출력이 이전과 동일한 데이터 경로 리팩터다.
- `scopeText`(`N libraries × M heights`)를 **응답에서 센다** — `HEIGHTS` 상수를 쓰지 않으므로 library별 지원 height 수가 달라도 견딘다(§7 #3). `HEIGHTS` import는 이 탭에서 제거됐다(`data.js`·`TabMw.vue`에서는 계속 쓰인다).
- PDK 버전 정보 표는 계속 `props.pdk`를 직접 쓴다 — §12 응답에는 `pdk_id`만 돌아오고 버전 문자열이 없다.

#### (이력) `cellDesign(library)` — 상수 → 함수

기준 행(`CELL_DESIGN_BASE`)에서 library 이름으로 시드한 결정적 규칙으로 일부 축을 빼고 cell 수를 흔든다. 각 축의 첫 항목은 항상 남겨 빈 mini-table이 생기지 않게 한다.

- `VTH_ALL` / `NANOSHEET_ALL`(전체 축)은 그대로 유지 — mini-table이 미지원 항목을 **제자리에서 회색 처리**하는 현재 동작("fixed-position pattern")이 library 비교에서 오히려 더 유용해진다.
- `drives`는 library 간 동일하게 둔다. 축이 3개(vth/nanosheet/cell count)나 흔들리면 mock이 노이즈로 보인다.

### 4-2. PPA 탭

#### 결정: library를 **열 그룹으로 pivot** 하고, 참조 library는 family 안에서 고른다

기존 탭에도 "reference library 대비 diff%"가 있었으나 참조 값이 **실재하지 않는 library를 pseudo-random으로 흉내낸 값**이었다(`ppaRows`의 `rr`/`ref()`). family 도입으로 비교 대상 library들이 같은 표 안에 실재하므로 **참조 값은 그 library의 실제 행에서 가져온다.** 기능 추가가 아니라 기존 가짜 참조의 제거다.

```
행 = family 전체 cell 합집합, 열 = library × metric (2단 헤더)

┌──────────┬───────────────────────────────────┬───────────────────────────────────┐
│          │ LIBA                      [REF]   │ LIBB                              │
│ CELL     ├────────┬───────┬───────┬──────────┼────────┬───────┬───────┬──────────┤
│          │ AREA   │ DELAY │ LEAK  │ CIN      │ AREA   │ DELAY │ LEAK  │ CIN      │
├──────────┼────────┼───────┼───────┼──────────┼────────┼───────┼───────┼──────────┤
│ INVD1    │ 0.2013 │ 12.44 │ 118.3 │ 3.21     │ 0.2101 │ 13.02 │ 121.7 │ 3.30     │
│ INVD2    │ 0.2440 │ 14.10 │  97.5 │ 3.88     │        │       │       │          │ ← 이 library에 없는 cell = 빈칸
└──────────┴────────┴───────┴───────┴──────────┴────────┴───────┴───────┴──────────┘

Diff 모드: 참조 library 그룹은 값 대신 REF, 나머지는 Δ%
```

| 항목 | 결정 |
|---|---|
| 행(row) | family 멤버 전체의 cell **합집합**. 기준 목록은 기존과 같이 `CELLS.slice(0, set.cells)` |
| 결측 | 특정 library에 없는 cell은 **빈칸**(0이 아님). `GET /clara/mw/` 피벗 규칙(`API.md` §10)과 같은 원칙 — "값 0"과 "측정 없음"을 구분한다 |
| 열 | library 그룹(2단 헤더 상단) × metric 4개(하단). library 순서는 §2-3 |
| 참조 library | family 멤버 중 하나. 기본값 = `libraries[0]`. 상단 헤더에 `REF` 배지 |
| Diff 계산 | 같은 cell의 참조 library 실측값 대비 `%`. 참조 library 자신의 그룹은 `REF` 텍스트, 참조 library에 그 cell이 없으면 빈칸 |
| N=1 family | 참조 select·Raw/Diff 세그먼트·`REF` 배지를 **숨긴다** (비교 대상이 없다). 표는 단일 library 그룹으로 그대로 렌더 |
| 차트 자리 | 변경 없음 (`ppa-chart-slot` placeholder 유지 — 차트는 PPA 페이지 소유) |
| 저장 셋 목록 화면 | 변경 없음 |
| `facts` 바 | `libraries: {N}` 항목 1개 추가 |

`ppaTable()`의 반환 shape은 `mwTable`의 `{ groups, subCols, rows }` 관용구에 맞췄다. `subCols`는 `groups × metrics`의 단순 곱이라 data.js에 두지 않고 컴포넌트에서 flatten한다(2단 헤더 렌더에 `groups`가 그대로 필요하므로).

- 삭제: `ppaRows`, `refLib`/`refOptions`, `columns` computed, `cells(r)`, `LIBS` import.
- `diff === true`인데 family가 N=1이 되는 전이는 family watch가 `diff = false`로 막는다.
- 2단 헤더는 `TabMw.vue`의 `.mw-group-row` / `.mw-subhead` 구조를 PPA용 클래스(`.ppa-group-row`, `.ppa-subhead`)로 복제한다. **공용 CSS로 추출하지 않는다** — 두 탭의 열 폭 계산 규칙이 다르고(MW는 62px 고정, PPA는 minmax flex), 지금 추상화하면 단일 사용처 추상화가 된다.
- `ppa-table`의 `overflow-x: auto`는 그대로 유지 (library 3개 = 12 numeric 열).

### 4-3. MW 탭

#### 결정: **테이블 내부에 library 축을 추가하지 않는다.** family 선택이 비교 셋을 자동 구성한다

| 항목 | 결정 | 근거 |
|---|---|---|
| `mwTable()` 시그니처 | **변경 없음** | 테이블 1개 = `(pdk, library, cell_height, mw_type)` 1조합 = `GET /clara/mw/` 요청 1건. 백엔드 계약이 library 단위이므로 이 입도가 계약과 1:1로 대응한다 |
| 테이블 내부 pivot 축 | **추가하지 않음** (CK Slope × voltage 그대로) | library 축을 표 안에 넣으면 `subCols`가 `library × slope × voltage`로 폭증하고, `API.md` §10이 프론트에 위임한 "여러 테이블 간 열 맞춤" 책임과 중복된다. **library 간 비교는 이미 "비교 셋"이 하는 일이다** |
| 기본 비교 셋 | family 멤버 **library마다 테이블 1개** (같은 `HEIGHTS[0]` / `MW_TYPES[0]`) | "family 선택 = 소속 library 전체 선택"을 이 탭에서 문자 그대로 구현한 것 |
| 테이블 헤더의 Library `<select>` | 옵션을 **family 멤버로 제한** | family 밖 library를 끼워 넣으면 컨텍스트바의 스코프가 의미를 잃는다 |
| 테이블 헤더의 PDK `<select>` | **변경 없음** (전체 `PDKS`) | PDK 간 비교는 기존에 지원하던 축이며 family와 직교한다 |
| 「테이블 추가」 picker | Library 옵션을 family 멤버로 제한, prefill은 family 멤버 안에서 순환 | |
| family 변경 시 | `sets`를 **새 family의 기본 셋으로 재생성**, `picking` 해제 | 이전 family의 library를 가리키는 테이블이 남으면 선택 스코프와 화면이 어긋난다 |
| CSV 파일명 | **변경 없음** (`mw_{lib}_{process}_{height}_{mwType}.csv`) | library 이름이 이미 들어 있어 family 접두는 중복 |

`addSet()`도 `makeFamilySet()`을 쓴다(기존의 "빈 셋 1테이블" 대신 family 전체). 2단 헤더, `gridCols`, CSV, set 복제/삭제, 접기는 변경 없음.

API를 family 단위로 묶을지는 네트워크 최적화 이슈로 분리해 **이번 라운드에 결정하지 않는다**(§7 #7). `GET /clara/mw/` 계약·`mwTable()`·`TabMw.vue`는 무변경.

### 4-4. Final Report 탭

| 항목 | 결정 |
|---|---|
| 리포트 스코프 | **(PDK, family) 당 1건** — 기존 (PDK, library) 당 1건에서 변경. 이 화면 전체가 family 단위가 되었으므로 리포트도 같은 단위여야 한다 |
| 블록 스코프 | `LIB`·`MW` 블록은 **library 단위** (블록에 `library_id` 추가), `PPA` 블록은 **family 단위** (chart는 library에 종속되지 않음), `USER`는 무관 |
| mock 블록 구성 | family 멤버 library마다 `[LIB, MW(CH120·MWD), MW(CH150·MWS)]`, 그 뒤에 family 레벨 `PPA` 1개. library 2개면 총 7블록 |
| 초기 seq 순서 | library 그룹 → PPA. 편집 모드에서 드래그 재정렬이 가능하므로 초기 순서는 "생성 규칙"만 정하면 된다 |
| 블록 제목 | library 스코프 블록은 library 접두. `LIBA · PDK 구성과 릴리스 경로`, `LIBA · CH120 · MWD 경고 셀` |
| 카드 UI | 카드 헤드에 library 칩 1개 추가(`.fr-lib`, mono 10px 회색). `SOURCE_LABEL` / `BLOCK_COLOR` / rail / stale 배지 / 드래그 / 삽입 affordance는 **변경 없음** |
| `state` 초기화 | **family 변경 시 `state = 'idle'` 로 되돌린다** (아래 함정) |
| 잠금 로직 | `GRACE_DAYS`, `locked`, `finalize()` 등 **변경 없음** |

⚠️ **현재 코드의 함정**: `report`가 `computed`라서 props가 바뀌면 `state === 'ready'`인 채로 본문이 조용히 다른 family 것으로 바뀐다(편집 중인 `draft`/`blocks`는 이전 family 내용을 유지). family는 리포트의 **정체성(UNIQUE 키)** 이므로 family watch에서 `state`/`editing`/`savedBy`/`savedAt`/`finalizedAt`을 반드시 초기화한다.

블록 빌더 변경:

| 함수 | 변경 |
|---|---|
| `libBlock(pdk, library)` | `library` = `{ id, library }`. `library_id` 추가, 제목에 library 접두, `data.library` 추가, `data.cell_design`은 `cellDesign(library.library)` 사용, `block_id` 하드코딩 제거(호출부에서 부여) |
| `mwBlock(pdkId, library, height, mwType)` | `library_id` 추가, `data.library` 추가, 제목에 library 접두, `blockId` 인자 제거 |
| `ppaBlock(set, libraries)` | `library_id: null` 명시, `data.libraries`/`data.library_count` 추가, prose에 "family 내 library N종" 문구 추가 |
| `mwFlaggedCells()` | **변경 없음** (인자는 library 이름 그대로) |

`blockSummary(b)`는 `LIB`/`MW` 분기가 그대로 동작한다(§5의 핵심 결론). `PPA` 분기에만 `LIBS` 한 줄을 추가했다. `:key="p.flag"`는 MW 블록에서 cell 이름을 flag로 쓰므로 그대로 유효하다 — 한 블록 = 한 library이기 때문이다.

#### 3차 델타 (2026-09-26 UI 포팅) — 블록 스코프가 다시 family로 올라갔다

위 표의 "블록 스코프 = library" 결정이 **뒤집혔다.**

| 항목 | 2차 | **3차 (현행)** |
|---|---|---|
| 영역 개수 | library N개면 `N × 3 + 1` 블록 | **LIB / PPA / MW 3개 고정 + USER 영역 N개** |
| 영역 스코프 | `LIB`·`MW` = library, `PPA` = family | **셋 다 family 전체 집계** |
| 생성 | `finalReport()` 1회가 전체 블록 생성 | **`genArea(type)` — 영역별 개별 생성·재생성**, 나머지 영역은 그대로 |
| 블록 참조 키 | `library_id` / `cell_height_id` / `mw_type` / `chart_id` | **없음.** `block_type`이 곧 식별자. 참조 키는 리포트 레벨로 올라갔다 |
| 유효성 | 백엔드 `stale` 플래그 (`source_saved_at` vs `source_current_at`) | **프론트 로컬 signature 비교** (`areaSignature`) |
| 카드 library 칩 | 카드 헤드에 library 칩 | 없음 — 영역이 family 전체이므로 칩을 붙일 대상이 없다 |
| 리포트 스코프 | (PDK, family) 당 1건 | **동일 — 변경 없음** |

영역 내용은 family 전체를 한 문단으로 집계한다. 예: `LIB` 영역 본문이 "family {FAMA}의 library {2}종에 걸쳐 Release Path와 Cell Design을 정리했습니다"이고, `points`에 `LIBS: 2종` / `GDS: V1.0.0.0 / V0.9.5.0 → 차이 있음`이 들어간다.

이 결정의 대가와 근거는 [final-report-design.md](final-report-design.md) §3-2에 정리했다 — **문서는 단순해졌지만 staleness 입도(어느 library가 바뀌어 낡았는지)를 잃었다.** §5-1이 세운 "블록을 library마다 하나씩" 논거 4개 중 1·2·3은 3차에서 성립하지 않는다(아래 §5-1 주석).

댓글은 이제 별개 기능이다 — 삽입형 `USER` 영역(문서 본문의 자유 블록)과 **작성자·시각·수정·삭제가 있는 리포트 댓글 스레드**가 함께 존재한다([final-report-design.md](final-report-design.md) §3-3).

---

## 5. Final Report "참조형" 설계에 미치는 영향

> [final-report-design.md](final-report-design.md)의 절 번호를 그대로 참조한다.

> ⚠️ **2026-09-26 3차 (UI 포팅) — §5-1·§5-2의 블록 관련 결정은 폐기됐다.** 아래 표는 2차 시점의 판단으로 남긴다. 현행 스키마는 [final-report-design.md](final-report-design.md) §3-1·§3-2가 정본이며, 요약하면: 블록에서 `library_id`/`cell_height_id`/`mw_type`/`chart_id`를 **전부 제거**하고 영역 3개 고정 구조로 갔다. 참조 키는 `fr_report`로 올라갔다.
>
> §5-3(family member drift)과 §5-4(참조형 원칙 유지)는 **유효하다.** 단 §5-3의 해소책 후보였던 "누락 library 블록 추가 허용"은 블록이 library별이 아니게 되어 성립하지 않는다.

### 5-1. (이력, 2차) 결론 먼저 — `block.data` 구조 변경은 최소다

| 대상 | 변경 필요? | 내용 |
|---|---|---|
| `LIB` block `data` (7-3) | **거의 없음** | `data.library` (string) 1개 추가. `pdk`/`release_paths`/`cell_design`/`vth_all`/`nanosheet_all` shape **그대로** |
| `MW` block `data` (7-5) | **거의 없음** | `data.library` 1개 추가. `cell_height_id`/`height`/`mw_type`/`threshold`/`slope_present`/`cells[]` **그대로** |
| `PPA` block `data` (7-4) | **소폭** | `libraries: ["LIBA","LIBB"]`, `library_count: 2` 추가. chart는 family 스코프이므로 블록이 쪼개지지 않는다 |
| block 공통 필드 (7-2) | **있음** | `library_id` (int, nullable) 추가 — `LIB`/`MW`는 필수, `PPA`/`USER`는 `null` |
| report 레벨 (7-1) | **있음** | `library_id` → **`family`** (string) + `libraries: [{id, library}]`. `release_paths[]` 원소에 `library_id`/`library` 추가. `unreported_libraries: [{id, library}]` 신설 |
| `stale` / `source_saved_at` / `source_current_at` | **없음** | 블록 단위 그대로. 오히려 library별로 블록이 나뉘어 **staleness 입도가 좋아진다** |

**즉 "library 목록으로 바뀐다"를 `data` 안에 배열로 밀어 넣지 않는다. 블록을 library마다 하나씩 만든다.** 이유:

1. Final Report는 **산문 블록의 문서**다. 사람이 쓰는 글과 AI 초안은 "LIBA의 릴리스 경로"처럼 library 단위로 쓰인다. `data`에 library 배열을 넣으면 블록 하나의 `body`가 N개 library를 뭉개서 서술해야 하고, 사람이 그중 한 library만 고쳐 쓸 수 없다.
2. `source_updated_at`이 **library별로 갈린다.** 설계 2-3은 블록의 갱신시각을 `MAX(updated_at)`로 압축하는데, N개 library를 한 블록에 담으면 어느 library가 바뀌어 낡았는지 알 수 없어 경고의 실행 가능성이 사라진다.
3. 프론트 변경이 최소다. `blockSummary()`의 LIB/MW 분기와 `fr-points` 렌더가 **그대로 동작**한다.
4. 설계 3-2가 이미 이 형태를 지원한다 — MW 블록이 `(cell_height_id, mw_type)`로 여러 개 존재하는 구조이므로, 참조 키에 `library_id`가 하나 더 붙는 것과 동형이다.

### 5-2. (이력, 2차) 스키마 델타

```sql
-- fr_report (3-1)
- library_id     NUMBER  NOT NULL  FK -> library(id)
+ family         VARCHAR2(100) NOT NULL          -- library.family 값. family는 마스터 테이블이 아니므로 FK 없음
- UNIQUE (pdk_id, library_id)
+ UNIQUE (pdk_id, family)
  release_paths  CLOB   -- 원소에 library_id 추가: [{library_id, cell_height_id, path, gds_desc}, ...]

-- fr_block (3-2)
+ library_id     NUMBER  NULL  FK -> library(id)  -- LIB/MW 필수, PPA/USER NULL
  CHECK: block_type IN ('LIB','MW') => library_id IS NOT NULL
         block_type IN ('PPA','USER') => library_id IS NULL
```

block_type별 조회 키:

| block_type | 조회에 쓰는 키 | 변경 |
|---|---|---|
| `LIB` | `report.pdk_id` + **`block.library_id`** | `report.library_id` → `block.library_id` |
| `PPA` | `chart_id` | 변경 없음 |
| `MW` | `report.pdk_id` + **`block.library_id`** + `cell_height_id` + `mw_type` | library 출처만 이동 |
| `USER` | — | 변경 없음 |

`fr_comment`, MW 임계값 상수(3-4), 상태 전이·잠금(5장), 원본 삭제 보호(6장), ETL MERGE(9장)는 **영향 없음**.

### 5-3. 새로 생기는 위험 — family 멤버 변동 (member drift)

설계 3-1의 근거는 *"변경점이 생기면 library가 새로 생성되므로 리포트에 버전 축이 필요 없다 — 버저닝은 library 테이블이 이미 갖고 있다"* 였다. **리포트를 family 단위로 올리면 이 논리가 깨진다.** family는 시간이 지나며 library가 추가되는 컨테이너이고, `UNIQUE (pdk_id, family)`는 그 시점마다 새 리포트를 만들 수 없게 한다.

파손 시나리오:

1. family `FAMA` = {LIBA, LIBB} 상태에서 리포트를 작성하고 **최종 저장(FINAL)** 한다.
2. 6일 후 리포트가 `LOCKED` 된다.
3. `LIBC`가 `FAMA`에 추가된다.
4. 리포트는 `LIBC`에 대한 블록이 없다. 그런데 `LOCKED`이라 블록을 추가할 수 없고, `UNIQUE (pdk_id, family)` 때문에 새 리포트도 만들 수 없다. → **막힌다.**

대응(단계별):

| # | 조치 | 상태 |
|---|---|---|
| 1 | GET 응답에 `unreported_libraries: [{id, library}]` — family 멤버 중 블록이 없는 library 목록. 참조형의 `stale`과 같은 층위의 "리포트가 낡음" 신호 | **이번 설계에 포함** (mock은 빈 배열, 프론트 배너는 백로그) |
| 2 | `LOCKED` + `unreported_libraries` 비어있지 않음 → 재생성 허용 여부 | **백엔드 협의 필요** |
| 3 | `UNIQUE (pdk_id, family)`를 `(pdk_id, family, revision)`으로 확장할지 | **백엔드 협의 필요.** 지금은 컬럼을 만들지 않는다 |

프론트는 mock 단계에서 `unreported_libraries` **필드만 보유**하고 배너 UI는 만들지 않는다 — mock이 절대 채우지 않는 값에 UI를 붙이면 죽은 코드가 된다(`stale`이 항상 `false`인 것과 같은 처리).

### 5-4. 참조형 원칙 자체는 유지된다

- 값을 복사하지 않고 조회 시점에 조인한다(2-1) — **유지**. 조인 키에 `library_id`가 하나 붙을 뿐이다.
- "최종 저장 시 고정되는 것은 매핑·글·블록 구성, 고정되지 않는 것은 숫자"(2-2) — **유지**. 단 **family 멤버십도 고정되지 않는다**는 항목이 하나 늘어난 것이고, 그게 §5-3의 위험이다.
- 유효성 경고는 값 비교(2-3) — **유지**, 입도만 library별로 세분화.

---

## 6. 컨텍스트 변경 시 탭 상태 전이 맵

**family = 문서의 정체성이므로 이 표가 가장 깨지기 쉬운 부분이다.**

3차 포팅으로 상태가 중앙 스토어로 모이면서(§3-4) **탭 unmount에 의한 소실이 사라졌다.** 아래는 `useReportStore.js`의 실제 동작이다.

| 트리거 | Library Info | PPA | MW | Final Report | route query |
|---|---|---|---|---|---|
| `pdk` 변경 (`setPdk`) | PDK 표 재계산 + **Cell Design 재계산 — 값이 바뀐다** (4차: §13 집계가 `pdk_id`에 의존). release 입력·설명은 유지 | 표 재계산, `refLibrary`/`diff`/`ppaSetId`/`ppaLinkedId` 유지 | 기존 테이블의 `pdkId`는 **그대로**(테이블마다 자기 PDK를 갖는다). 새로 추가되는 테이블만 새 PDK | **`frAreas` 유지.** LIB/PPA/MW 세 영역 전부 signature에 `pdkId`가 들어 있어 자동으로 `stale` (4차에서 PPA signature 누락을 고쳤다 — [final-report-design.md](final-report-design.md) §2-3) | `pdk` |
| `family` 변경 (`setFamily`) | **재계산 (stateless — 집계 API 2회 재호출: §12 요약 + §13 Cell Design).** `releaseRows`는 cell height별 빈 행으로, `gdsDesc`/`libDesc`는 초기값으로 리셋 (4차) | `refLibrary = libraries[0]`, `diff = false`, **`ppaSetId`/`ppaLinkedId` 리셋** (4차) | **셋 전량 재생성**(library당 테이블 1개), `picking = null` | **`frAreas = {}`**, 편집/저장/확정 상태·영역 순서·USER 영역·댓글 전부 리셋 | `family` |
| `tab` 변경 | 상태 유지 | 상태 유지 | **셋 유지** (이전: unmount로 소실) | **영역 유지** (이전: unmount로 소실) | `tab` |
| `set` 변경 (PPA 미리보기) | — | 표 재계산 | — | 영향 없음 — **`ppaLinkedId`만 영역에 반영된다**(미리보기는 리포트 밖) | `set` |
| 「리포트에 저장」 (`saveChartToReport`) | — | 배너 사라짐 | — | PPA 영역 생성 가능해짐 / 이미 생성됐으면 `stale` | — |

~~⚠️ 표의 두 번째 행에 붙은 경고 2개가 현재 구현의 상태 누수다.~~ **해결 (2026-09-27, §7 #11)** — `setFamily()`가 `releaseRows`/`gdsDesc`/`libDesc`/`ppaSetId`/`ppaLinkedId`를 초기값으로 되돌린다. release 행 id 카운터는 계속 증가하므로 새 행이 옛 행과 id를 다투지 않는다. **`setPdk()`도 2026-09-27에 사용자 확인을 거쳐 Library Info 입력값(`releaseRows`/`gdsDesc`/`libDesc`)을 같은 방식으로 리셋하도록 갱신했다** — `ppaSetId`/`ppaLinkedId`/`frAreas`/댓글 등은 PDK 전환으로는 리셋하지 않는다 ([final-report-design.md](final-report-design.md) §8 #32).

Final Report 문서 상태(`DRAFT → FINAL → LOCKED`)는 [final-report-design.md](final-report-design.md) §5 그대로이며 **전이 규칙 자체는 바뀌지 않는다.** 2026-09-27에 잠금의 프론트 구현이 들어왔다 — 스토어의 `GRACE_DAYS = 5` + `locked` computed를 네 탭이 참조해 편집 컨트롤을 막는다(§5-2). `finalizedAt`이 로컬 타임스탬프라는 점과 백엔드 `403` 짝맞춤은 저장 트리거 보류 이슈에 묶여 남아 있고, §5-3의 `LOCKED` + member drift 교착도 여전히 백엔드 협의 항목이다.

영역 단위 상태(`empty → generating → ready`, `stale`)는 위 표와 별개 축이다 — [final-report-design.md](final-report-design.md) §2-4.

---

## 7. 백엔드/기획 확인 필요

| # | 항목 | 막히는 것 | 제안 |
|---|---|---|---|
| 1 | `LOCKED` 리포트의 family에 library가 추가될 때 | 블록 추가 불가 + `UNIQUE(pdk_id, family)`로 새 리포트도 불가 (§5-3) | 잠금 예외로 "누락 library 블록 추가"만 허용, 또는 #2 |
| 2 | `fr_report` UNIQUE를 `(pdk_id, family, revision)`으로 확장할지 | family 단위 리포트는 library 테이블의 버저닝을 물려받지 못한다 | 지금은 컬럼을 만들지 않고 #1의 예외로 처리, 실 운영에서 재검토 |
| 3 | family 안에서 library마다 지원 `cell_height`가 다를 수 있는지 | 현재 mock은 `HEIGHTS` 3종을 모든 library에 공통 적용. 다르면 Release Path/Cell Design 표의 행 수가 library마다 달라진다 | 백엔드 집계 쿼리 확정 시 확인. **§12 응답이 library별 배열이고 프론트는 배열 길이를 가정하지 않으므로(`flatRows` + 응답에서 센 `scopeText`) 이미 견딘다** — 계약상 허용으로 명시됨 |
| 4 | family가 PDK와 정말 독립인지 | 특정 PDK에 데이터가 없는 family를 골랐을 때 4개 탭이 전부 빈 결과가 된다 | 필요하면 `/clara/family/?pdk_id=` 필터를 **추후** 추가 (지금은 만들지 않음) |
| 5 | library의 `family`가 변경될 수 있는지(재분류) | 기존 리포트의 `family` 문자열이 고아가 된다 | family 이름 rename/재분류 정책 확인 필요 |
| 6 | `library.family` 컬럼의 길이·정규화 | `VARCHAR2(100)` 가정으로 스키마 델타를 썼다 | 실 컬럼 정의 확인 |
| 7 | **MW 조회를 family 단위로 묶을지** (2026-09-26 2차) | 현재 MW 탭은 family 멤버 library마다 `GET /clara/mw/`를 N회 호출한다. Library Info는 §12로 1회가 됐으나 MW는 그대로 | **이번 라운드에 결정하지 않는다.** 네트워크 최적화 이슈이고 테이블 1개 = 요청 1개라는 현재 입도가 백엔드 계약과 1:1로 맞아 있다(§4-3). 실측 지연이 문제가 될 때 `?library_id=1,2,3` 멀티값(공통 사항의 콤마 구분 관례)으로 확장 검토. **UX·프론트 코드는 이 결정과 무관하게 이미 확정 구현 상태** |
| 8 | **release path / GDS version의 원천 테이블** (2026-09-26 2차) | §12의 `path`·`gds_version`을 어디서 집계하는지 미확정. `final-report-design.md` §3-5는 release path를 *리포트별 사용자 입력*으로 정의했다 — library 마스터 원천이 없으면 Library Info 탭의 PATH 열은 항상 빈칸이 된다 | §12는 `path`를 nullable로 두고 계약을 열어 두었다. 원천이 없다면 (a) 탭에서 PATH 열을 빼고 리포트에서만 입력받거나 (b) library 단위 마스터를 신설해야 한다 — **기획 확인 필요** |
| 9 | **`cell_height` 식별자 정규화** (2026-09-26 2차) | `cell_meta.cell_height`는 문자열(`"12T"`), `spil_mw_meta.cell_height_id`는 int, `/clara/cell-height/`는 `{ id, height }`. **§12·§13의 cell design 집계는 이름 조인으로 우회 중** | `cell_meta`에 `cell_height_id`를 추가하는 것이 정석. 추가 전까지 이름 조인 결과를 `cell_height_id`로 내려주는 것을 계약으로 명시(§12) |
| 10 | **release/GDS가 PDK에 의존하는지** (2026-09-26 2차) | §12는 `pdk_id`를 필수로 두었다. release가 PDK와 무관하면 파라미터 하나가 의미 없이 필수가 된다 | 응답 shape은 어느 쪽이든 동일하므로 계약 변경 없이 쿼리 조건만 조정 가능. #8과 함께 확인 |

### 3차 (2026-09-26 UI 포팅) 신규

| # | 항목 | 막히는 것 | 제안 |
|---|---|---|---|
| 11 | ~~`setFamily()`가 리포트 소유 입력을 리셋하지 않는다~~ (§3-4, §6) | **해결 (2026-09-27)** — `setFamily()`가 `releaseRows`(cell height별 빈 행)·`gdsDesc`·`libDesc`·`ppaSetId`·`ppaLinkedId`를 리셋한다 | `setPdk()`도 같은 날 Library Info 입력값만 같은 방식으로 리셋하도록 갱신 → [final-report-design.md](final-report-design.md) §8 #32 |
| 12 | ~~대표 셀 기준 Cell Design이 library·PDK와 무관한지~~ (§4-1) | **해결 (2026-09-27)** — (PDK, library)별로 다르다. 신규 `GET /clara/cell-design/`([../API.md](../API.md) §13)로 분리하고 화면을 library 그룹으로 감쌌다 | 대표 셀·bit-width의 **원천 컬럼**과 `REP_CELLS`의 마스터 여부는 [final-report-design.md](final-report-design.md) §8 #27 / #28로 넘긴다 |
| 13 | **Release Path의 cell height 그룹 골격** (§4-1) | 그룹이 `HEIGHTS` 상수 mock 3행에서 시작하고, 기존 그룹 안에만 행을 추가할 수 있다. 그룹을 비우면 되살릴 수 없다 | `GET /clara/cell-height/`(API.md §9)로 골격을 만든다. 계약 변경 없음 — 클라이언트만 추가 |
| 14 | **Library Info의 편집 게이트가 일관되지 않는다** (§4-1) | **부분 해결 (2026-09-27)** — 잠금 차단은 들어갔다(`locked`면 편집 버튼과 DESCRIPTION 입력이 모두 `disabled`). 남는 것은 `infoEditing` 게이트의 범위 불일치 하나 — release path 행은 편집 모드에서만, DESCRIPTION은 (잠기지 않았다면) 항상 열려 있다 | 설명의 소유자([final-report-design.md](final-report-design.md) §8 #21)가 정해진 뒤 결정 |
| 15 | **`GET /clara/library-info/`(§12)의 `release_paths`를 백엔드가 만들 필요가 있는가** (§4-1) | 3차에서 release path·GDS version이 리포트 소유 사용자 입력이 되어 이 응답의 해당 블록을 아무도 그리지 않는다. #8이 제시한 선택지 (a)를 코드가 택한 셈 | **백엔드 착수 전 확인.** 확정되면 §12에서 `release_paths`를 빼거나 "GDS version 집계만" 남기고, `library_release`(가칭) 마스터 신설 계획을 폐기한다 |
| 16 | **`GET /clara/library-info/`(§12)의 `cell_design` 축이 화면과 다르다** (§4-1) | **부분 해결 (2026-09-27)** — 화면 소비처는 §13이 가져갔다. §12의 `cell_design` 블록을 유지·제거할지만 남는다 → [final-report-design.md](final-report-design.md) §8 #29 | §13 백엔드 착수 시 #15(`release_paths`)와 함께 결정 |
| 17 | ~~멤버 library 칩이 사라진 것이 의도인지~~ (§3-1) | **해결 (2026-09-27)** — 의도가 아니었다. 컨텍스트바 Family select 옆에 2차의 읽기 전용 칩 스트립(`.lr-fam-libs`, 4개까지 + `+N`)을 복원했다 | — |
| 18 | **Cell Design이 library 축을 얻으면서 카드 수가 library 배수가 된다** (2026-09-27 신규, §4-1 4차 절) | family 5 library면 최대 180장(5 × 대표 셀 4 × height 3 × bit 3). 접기/탭/필터 중 무엇을 쓸지 UX 결정 필요 | 4차 라운드는 구조만 바꾸고 접기를 넣지 않았다 → [final-report-design.md](final-report-design.md) §8 #30 |

---

## 8. 의도적으로 하지 않은 것

| 하지 않는 것 | 이유 |
|---|---|
| `src/api/cells.js`에 `fetchFamilies()` 추가 | 호출부가 없는 죽은 코드. Library Report는 전부 mock 단계이고 `/clara/mw/`·`/clara/cell-height/`도 클라이언트가 없다. 백엔드 연동 단계에서 `get('/clara/family/')` 한 줄로 추가한다 |
| `src/api/cells.js`에 `fetchLibraryInfo()` 추가 | 호출부가 없는 죽은 코드. Library Report는 전부 mock 단계다 (`fetchFamilies()`와 같은 이유). 연동 단계에서 `get('/clara/library-info/', { pdk_id, family })` 한 줄로 추가한다 |
| 집계 결과가 빈 library의 empty-state UI | mock이 절대 빈 배열을 내지 않는다. 계약상 빈 배열은 정상 응답이므로 **행 0개인 library는 표에서 사라진다** — 실 연동 시 처리 (§7 #8) |
| `path: null` 빈칸 렌더 분기 | 위와 같은 이유. mock은 항상 문자열을 돌려준다 |
| `libraryInfo()`와 `libBlock()`의 공용 헬퍼 추출 | 같은 per-library shape을 두 곳에서 만드는 중복이 있지만, 통합하면 Final Report mock을 건드려야 하고 두 엔드포인트는 계약상 독립이다 |
| `?lib=` 딥링크 하위 호환 | 외부에 배포된 고정 링크가 없다 (§3-2) |
| `unreported_libraries` 배너 UI | mock이 절대 채우지 않는 값 (§5-3) |
| MW 테이블 내부에 library 축 pivot | 비교 셋이 이미 그 역할 (§4-3) |
| PPA/MW의 2단 헤더 CSS 공용화 | 열 폭 규칙이 달라 단일 사용처 추상화가 된다 (§4-2) |
| `CURRENT_USER` 단일화 | 별개 백로그 (`PROGRESS.md` §9) |
| 메인 PPA 빌더의 Library 다중선택 | 범위 외 |

### 3차 (2026-09-26 UI 포팅)에서 하지 않은 것

| 하지 않는 것 | 이유 |
|---|---|
| `data.js`의 죽은 코드 삭제 (`finalReport`/`libBlock`/`ppaBlock`/`mwBlock`/`mwFlaggedCells`/`MW_THRESHOLD`/`VTH_ALL`/`NANOSHEET_ALL`) | MW 필터 규칙([final-report-design.md](final-report-design.md) §4)과 임계값 상수(§3-4)는 계약으로 여전히 유효하다. 실 연동에서 어느 것이 되살아나는지 확정한 뒤 정리하는 것이 맞다. **4차 후기: `mwFlaggedCells`/`MW_THRESHOLD`는 되살아났다** — `MW` 영역 요약이 호출한다 |
| ~~`setFamily()`에 `releaseRows`/`ppaLinkedId` 리셋 추가~~ | 3차는 문서 정합화 범위였다. **4차(2026-09-27)에서 구현했다** (§7 #11 해결) |
| `API.md` §12의 `release_paths`/`cell_design` 수정 | §7 #15·#16의 답이 나오기 전에 이미 합의된 계약을 흔들지 않는다. 소비처 이동 사실만 §12에 주석으로 남겼다 |
| ~~잠금(LOCKED) UI 복구~~ | **4차(2026-09-27)에서 구현했다** — 스토어 `GRACE_DAYS`/`locked` + 네 탭 편집 컨트롤 차단. 백엔드 `403`·`editable_until` 짝맞춤과 `finalizedAt`의 영속화만 남았다 ([final-report-design.md](final-report-design.md) §5-2, §8 #23) |
| `frSave()`/`frFinalize()`의 저장 방식 결정 | **사용자가 명시적으로 보류시킨 이슈.** 재개하지 않는다 ([final-report-design.md](final-report-design.md) §5-0) |

### 4차 (2026-09-27 Cell Design 집계)에서 하지 않은 것

| 하지 않는 것 | 이유 |
|---|---|
| `cellDesignByHeight(rep)` 삭제 | 로직은 `cellDesignHeights()`에 있어 중복이 0이고, `data.js`의 기존 죽은 코드 정책(실 연동에서 무엇이 되살아나는지 확정한 뒤 정리)과 일관된다. 삭제하려면 `export function` 4줄만 지우면 된다 |
| `API.md` §12의 `cell_design` 블록 제거 | 이미 합의된 계약이므로 소비처 상실만 ⚠️ 주석에 기록하고, 제거는 §13 백엔드 착수 시 함께 결정한다 ([final-report-design.md](final-report-design.md) §8 #29). §12 `release_paths`(#15)와 같은 타이밍 |
| `src/api/cells.js`에 `fetchCellDesign()` 추가 | 호출부가 없는 죽은 코드. 연동 단계에서 `get('/clara/cell-design/', { pdk_id, family })` 한 줄로 추가한다 (`fetchFamilies()`/`fetchLibraryInfo()`와 같은 이유) |
| library 그룹 접기·대표 셀 탭 | 카드 수가 library 배수로 늘어나는 것은 사실이지만 UX 결정 항목이다 (§7 #18) |
| `libraryInfo()`의 시드에 `pdkId` 추가 | §12의 `cell_design`은 소비처가 없다. 소비처 없는 mock의 값을 흔들면 회귀 비교 기준만 잃는다 |
| `bit_width`가 비숫자 토큰일 경우의 분기 | 원천 미확정 상태에서 만들면 죽은 코드가 된다. 계약은 int로 두고, string으로 바뀌면 프론트의 라벨 조립 한 줄만 고친다 |
| 유예기간 중 「최종 저장」 버튼 재노출 | 다시 누르면 유예 시계가 리셋된다. 유예 중에는 「편집」·「저장」만 남긴다 |

**2026-09-27에 결정되어 이 표에서 빠진 항목**: MW 탭 표의 `over` 하이라이트를 `MW_THRESHOLD`(CK Slope 40 + mw_type별 임계값)로 통일했고, `setPdk()`도 Library Info 입력값(`releaseRows`/`gdsDesc`/`libDesc`)을 리셋하도록 갱신했다 — [final-report-design.md](final-report-design.md) §8 #31 / #32 참조.

---

문서 최종 수정: 2026-09-27 (4차 — Cell Design 집계 API + 버그 수정 반영)
