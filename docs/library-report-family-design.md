# Library Report — Family 기반 Library 그룹핑 설계

> 작성일: 2026-09-26
> 대상: `/library-report` 페이지 (`src/views/library-report/*`)
> 근거: [../PROGRESS.md](../PROGRESS.md) 3-11, [../API.md](../API.md) §3/§10/§11/§12, [final-report-design.md](final-report-design.md)
> 상태: 구현 완료 (mock 단계) · 2026-09-26 2차 라운드에서 Library Info 집계 API 반영. API 계약은 `API.md` §11·§12가 정본

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
- 단 `data.js`의 Final Report mock **과 `libraryInfo()`** 는 예외 — 백엔드 응답 원형을 그대로 재현하므로 snake_case(`block_type`, `library_id`, `release_paths`, `gds_version`, `cell_count`)를 유지한다.
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
| (신규) 멤버 library 칩 | Family select 오른쪽에 읽기 전용 칩 strip (`.lr-fam-libs` / `.lr-fam-lib`). family 선택이 곧 library N개 선택이라는 사실을 화면에 보여야 한다. mono 11px 회색, 4개 초과 시 `+N`으로 접는다 |

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

### 3-3. 탭 props 계약

네 탭 모두 **`family` 객체 하나**로 통일한다. library 배열을 별도 prop으로 중복 전달하지 않는다(`props.family.libraries`로 접근). 기존 `lib: String` prop은 네 탭에서 모두 제거했다.

```html
<TabLibraryInfo v-if="tab === 'info'"   :pdk="pdk"      :family="family" />
<TabPpa         v-else-if="tab==='ppa'" :pdk-id="pdkId" :family="family" />
<TabMw          v-else-if="tab==='mw'"  :pdk-id="pdkId" :family="family" />
<TabFinalReport v-else                  :pdk="pdk"      :family="family" />
```

`family` computed는 `FAMILIES`의 원소 참조를 그대로 반환하므로, family가 실제로 바뀔 때만 참조가 바뀐다 — 각 탭의 `watch(() => props.family, …)`가 `pdk`/`set` 변경에는 반응하지 않는 이유다(§6).

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

### 4-1. Library Info 탭

#### 결정: 표를 쪼개지 않고 **LIBRARY 열을 추가해 한 표에 세로로 쌓는다**

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

#### 집계 API로 전환 (2026-09-26 2차)

- 탭이 family 멤버 library마다 따로 조회하지 않는다. **`GET /clara/library-info/?pdk_id=&family=`([../API.md](../API.md) §12) 1회**로 family 전체의 Release Path + Cell Design을 받는다. mock에서는 `libraryInfo(pdkId, family)` 호출 1개 = `info` computed 1개이며, 실 연동 시 그 우변만 API 호출로 바뀐다.
- 응답이 `family` → `libraries[]` 중첩이므로 **컴포넌트는 표 행으로 펼치기만 한다** — `flatRows(libraries, key)`가 `library` 이름을 각 행에 주입하고 `groupStart`(library 경계선)를 계산한다. 두 표가 같은 규칙으로 LIBRARY 열을 얻는다(이전에는 `cellDesign()`이 행에 `library`를 붙여줬다).
- 템플릿 필드명이 와이어 이름으로 바뀐다: `r.gds` → **`r.gds_version`**, `r.cells` → **`r.cell_count`**. 나머지(`height`/`path`/`drives`/`vths`/`nanosheet`/`library`/`groupStart`)는 이름 동일.
- **표 구성·열·그리드·스타일은 변경 없음** (아래 1차 결정 그대로). 화면 출력이 이전과 동일한 데이터 경로 리팩터다.
- `scopeText`(`N libraries × M heights`)를 **응답에서 센다** — `HEIGHTS` 상수를 쓰지 않으므로 library별 지원 height 수가 달라도 견딘다(§7 #3). `HEIGHTS` import는 이 탭에서 제거됐다(`data.js`·`TabMw.vue`에서는 계속 쓰인다).
- PDK 버전 정보 표는 계속 `props.pdk`를 직접 쓴다 — §12 응답에는 `pdk_id`만 돌아오고 버전 문자열이 없다.

#### `cellDesign(library)` — 상수 → 함수

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

---

## 5. Final Report "참조형" 설계에 미치는 영향

> [final-report-design.md](final-report-design.md)의 절 번호를 그대로 참조한다.

### 5-1. 결론 먼저 — `block.data` 구조 변경은 최소다

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

### 5-2. 스키마 델타

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

| 트리거 | Library Info | PPA | MW | Final Report | route query |
|---|---|---|---|---|---|
| `pdk` 변경 | 재계산 (stateless) | 표 재계산, `refLibrary`/`diff` 유지 | 테이블 데이터 재계산, 셋 구성 유지 | **현행 유지** (`state` 그대로 — 기존 동작) | `pdk` |
| `family` 변경 | 재계산 (stateless — 집계 API 1회 재호출) | `refLibrary = libraries[0]`, `diff = false`, `set` 유지 | **셋 전량 재생성** (library당 테이블 1개), `picking = null` | **`state = 'idle'`**, editing/saved/finalized 리셋 | `family` |
| `tab` 변경 | — | — | 컴포넌트 unmount로 셋 소실 (기존 동작, 변경 없음) | 컴포넌트 unmount로 `state` 소실 (기존 동작) | `tab` |
| `set` 변경 (PPA) | — | 표 재계산 | — | 재계산 (`route.query.set` 참조, 기존 동작) | `set` |

Final Report 문서 상태(`DRAFT → FINAL → LOCKED`)는 [final-report-design.md](final-report-design.md) §5 그대로이며 **이번 변경으로 전이 규칙이 바뀌지 않는다.** 단 §5-3의 `LOCKED` + member drift 교착은 백엔드 협의 항목이다.

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
| 9 | **`cell_height` 식별자 정규화** (2026-09-26 2차) | `cell_meta.cell_height`는 문자열(`"12T"`), `spil_mw_meta.cell_height_id`는 int, `/clara/cell-height/`는 `{ id, height }`. §12의 cell design 집계는 이름 조인으로 우회 중 | `cell_meta`에 `cell_height_id`를 추가하는 것이 정석. 추가 전까지 이름 조인 결과를 `cell_height_id`로 내려주는 것을 계약으로 명시(§12) |
| 10 | **release/GDS가 PDK에 의존하는지** (2026-09-26 2차) | §12는 `pdk_id`를 필수로 두었다. release가 PDK와 무관하면 파라미터 하나가 의미 없이 필수가 된다 | 응답 shape은 어느 쪽이든 동일하므로 계약 변경 없이 쿼리 조건만 조정 가능. #8과 함께 확인 |

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

---

문서 최종 수정: 2026-09-26
