# Library Report — Family 기반 Library 그룹핑 구현 기록

> 브랜치: `mw-table-height-type-params`
> 작업일: 2026-09-26
> 설계: [library-report-family-design.md](library-report-family-design.md) (API 계약은 [../API.md](../API.md) §11·§12)
> 범위: `src/views/library-report/` 5파일 + 문서 5파일. 의존성 추가 없음
> 2차 라운드: 2026-09-26 — Library Info 집계 API(`GET /clara/library-info/`, `API.md` §12) 반영. 아래 표의 `(2차)` 행 참조

Library Report의 컨텍스트 단위를 **library 1개 → family 1개(= library N개)** 로 바꿨다. 메인 CLARA PPA 빌더(`src/stores/builderStore.js`, `src/components/builder/*`)와 `GET /clara/lib/` 스키마는 건드리지 않았다.

---

## 1. 변경 파일 요약

### 코드

| 파일 | 변경 내용 |
|------|----------|
| `src/views/library-report/data.js` | `LIBS` 삭제 → `FAMILIES` + `findFamily()`. `CELL_DESIGN`(상수) → `cellDesign(library)`(함수) + 내부 `CELL_DESIGN_BASE`. `ppaRows()` 삭제 → `PPA_METRICS` + `ppaTable(set, pdkId, libraries, refLibrary)`. Final Report 블록 빌더를 library 스코프로 전환, `finalReport({ pdkId, family, savedSetId })` |
| `src/views/library-report/LibraryReportView.vue` | Library `<select>` → Family `<select>`, route query `lib` → `family`, 멤버 library 칩 strip 신규(`.lr-fam-libs`), 네 탭 props를 `:family`로 통일 |
| `src/views/library-report/TabLibraryInfo.vue` | Release Path / Cell Design 표에 `LIBRARY` 열 추가, 행 = library × height (flatMap + `groupStart` 경계선). grid 열 1개씩 추가, 섹션 subtitle 추가 |
| `src/views/library-report/TabPpa.vue` | 표를 **library × metric 2단 헤더**로 전환. `refLibrary`(family 멤버) + `comparable`, `subCols`/`gridCols`/`cellText()`. 가짜 pseudo-random 참조 제거 |
| `src/views/library-report/TabMw.vue` | `libOptions`(family 멤버) + `makeFamilySet()`(library마다 테이블 1개), family 변경 시 셋 재생성. `mwTable()` 호출부·2단 헤더·CSV는 무변경 |
| `src/views/library-report/TabFinalReport.vue` | `finalReport({ family })`, family 변경 시 `state='idle'` 리셋, 카드 헤드 library 칩(`.fr-lib`), PPA 요약에 `LIBS` 한 줄, `inputSummary` 문구 |
| **(2차)** `src/views/library-report/data.js` | `libraryInfo(pdkId, family)` **신규** — `GET /clara/library-info/` 응답 shape(snake_case)을 mock으로 재현. `releasePaths`/`cellDesign`을 family 멤버 전체로 합치며 **기존 함수는 무편집**(`releasePaths` 호출부 주석 한 줄만 갱신). `cell_height_id`는 인덱스 산술이 아니라 `heightId(height)`로 구한다. `libBlock`/`finalReport`/`mwTable`/`ppaTable`/상수 전부 무변경 |
| **(2차)** `src/views/library-report/TabLibraryInfo.vue` | `<script setup>` 교체 — 집계 **1회 호출**(`info` computed) + `flatRows(libraries, key)`로 중첩 응답을 표 행으로 펼치기. `scopeText`를 응답에서 계산(library별 height 수 차이 견딤). 템플릿 필드명 2개(`r.gds`→`r.gds_version`, `r.cells`→`r.cell_count`). `HEIGHTS` import 제거(내 변경이 만든 orphan). `<style>` 무편집 |

### 문서

| 파일 | 변경 내용 |
|------|----------|
| `API.md` | `## 11. Family` 신규 섹션(`GET /clara/family/`) + 목차·§3 안내 한 줄·부록 엔드포인트 표·호출 패턴·데이터 모델 관계·변경 이력·최종 수정일 |
| `docs/library-report-family-design.md` | **신규** — 이번 기능의 전용 설계 문서 (데이터 모델 / 라우팅 / 탭별 설계 / Final Report 영향 / 상태 전이 맵 / 오픈 이슈) |
| `docs/01-design.md` | §4 페이지·라우팅에 위 신규 문서 링크 한 줄 (그 외 무변경 — 이 문서는 메인 빌더 기준 역작성 문서라 family 절을 끼워 넣으면 성격이 섞인다) |
| `docs/final-report-design.md` | `fr_report`: `library_id` → `family` + `UNIQUE (pdk_id, family)`. `fr_block`: `library_id` 추가 + CHECK. block_type별 조회 키 표, 7-1/7-2/7-3/7-4/7-5 shape, 8장 미확정 #8~#10(member drift) |
| `PROGRESS.md` | §3-11을 family 기준으로 갱신, §4-2에 `GET /family/` 추가, §5-4에 route query 키(`lib`→`family`) 명시 |
| **(2차)** `API.md` | `## 12. Library Info 집계` 신규 섹션(`GET /clara/library-info/`) + 목차(13~15 번호 밀기)·§11 📌 안내 한 줄·부록 엔드포인트 표·호출 패턴 교체·변경 이력 신규 항목. **데이터 모델 관계·§10 MW는 무변경** (신규 테이블 없음) |
| **(2차)** `docs/library-report-family-design.md` | §4-1에 `#### 집계 API로 전환 (2026-09-26 2차)` 절 추가, §4-0 시그니처 표에 `libraryInfo` 행 추가, 머리말 근거/상태, §1 범위 밖·필드명 규칙, §4-3 MW 한 줄, §6 상태 전이 맵, §7 #3 비고 + #7~#10 신규, §8 신규 4행 |
| **(2차)** `docs/final-report-design.md` | **이번 라운드 무편집.** §7-8의 "Library Info 집계 → 신규 쿼리(원천 테이블 미확인)" 문장이 §12 신설로 낡았으나, 해당 파일은 Final Report 저장 흐름 보류와 함께 편집 금지 범위다 (§5 후속 항목) |
| **(2차)** `PROGRESS.md` | §3-11 Library Info 불릿에 집계 1회 전환 문장, §4-2에 `GET /library-info/` 추가, §9 알려진 이슈의 API 스펙 확정 목록, §10-1에 백엔드 협의 2건 |

---

## 2. 주요 결정 사항

1. **family는 마스터 테이블이 아니다.** `library` 테이블의 컬럼이므로 자체 id가 없고, 프론트의 모든 키(route query, `findFamily`, `v-for :key`)는 **family 이름 문자열**이다. `family_id`를 미리 만들지 않았다.
2. **탭 props는 `family` 객체 하나로 통일.** `libraries` 배열을 별도 prop으로 중복 전달하지 않는다. 네 탭에서 `lib: String` prop을 모두 제거했다.
3. **Library Info는 표를 쪼개지 않고 `LIBRARY` 열을 추가**해 한 표에 세로로 쌓았다. family를 묶는 목적이 "같은 height에서 library 간 차이를 보는 것"이므로 표를 나누면 같은 height 행이 서로 다른 y 위치에 놓인다.
4. **PPA의 참조 값은 실측이 되었다.** 기존 `ppaRows`는 존재하지 않는 library를 pseudo-random으로 흉내낸 값을 참조로 썼는데, family 도입으로 비교 대상이 같은 표에 실재하므로 참조 library의 실제 행에서 diff%를 계산한다. 기능 추가가 아니라 가짜 참조의 제거다.
5. **MW는 테이블 내부에 library 축을 넣지 않았다.** 테이블 1개 = `GET /clara/mw/` 1회라는 백엔드 계약 입도를 유지하고, library 간 비교는 이미 "비교 셋"이 하는 일이다. family 선택이 "library마다 테이블 1개"인 기본 셋을 만든다.
6. **Final Report는 블록을 library마다 하나씩** 만든다(`LIB`/`MW`는 library 스코프, `PPA`는 family 스코프). `data`에 library 배열을 밀어 넣으면 사람이 한 library만 고쳐 쓸 수 없고 staleness 입도가 사라진다. 덕분에 `blockSummary()`의 LIB/MW 분기와 `fr-points` 렌더가 그대로 동작한다.
7. **family 변경은 컨텍스트 리셋을 동반한다.** PPA는 `refLibrary`/`diff` 리셋, MW는 셋 전량 재생성, Final Report는 `state='idle'`. 특히 Final Report의 `report`는 `computed`라 리셋하지 않으면 `ready` 상태에서 본문만 조용히 다른 family 것으로 바뀐다(family = 리포트의 UNIQUE 키).
8. **`LIBA`/`LIBB`의 값 연속성을 지켰다.** 모든 seed 문자열에 library 이름을 그대로 쓰고 기존 seed 구성 순서를 바꾸지 않았다 — 검증 결과는 4장.
9. **(2차) Library Info는 집계 API 1회, MW는 library당 1회 — 입도가 다른 이유.** Library Info 탭은 family 멤버 전체를 **한 표에 쌓아** 비교하므로 조립 단위가 family다 → `GET /clara/library-info/` 1회(§12). MW 탭은 library마다 **독립된 테이블**을 나란히 놓고 열 맞춤을 프론트가 하므로 조립 단위가 테이블 = library다 → `GET /clara/mw/` N회(`API.md` §10, 계약 무변경). 즉 입도 차이는 최적화 취향이 아니라 화면의 조립 단위 차이다. MW를 family로 묶을지는 네트워크 실측 뒤에 판단한다(설계 §7 #7).

---

## 3. 설계와 다르게 구현한 부분

| # | 설계 | 실제 구현 | 이유 |
|---|---|---|---|
| 1 | `groupStart: i === 0` | `groupStart: i === 0 && li > 0` (`li` = library 인덱스) | 표의 첫 행에 `.group-start`를 주면 헤더의 `border-bottom`과 겹쳐 2px 선이 된다. "library 전환 지점을 보인다"는 의도는 유지 |
| 2 | 섹션 타이틀 **옆**에 `lr-subtitle` | `.info-sec-head`(flex, baseline) 래퍼를 추가해 옆에 배치 | `.lr-section`이 `flex-direction: column`이라 래퍼 없이는 아래로 쌓인다 |
| 3 | `.ppa-group-row`를 `.mw-group-row`(flex + 고정 px 폭) 구조로 복제 | **grid + `grid-column: span 4`** 로 구현 | MW는 62px 고정 열이라 flex 폭 계산이 되지만 PPA는 `minmax(92px, 1fr)` 가변이다. 본문 행과 **같은 `gridTemplateColumns`** 를 공유해야 그룹 헤더가 정렬된다. "2단 헤더 + MW의 시각 언어 + 공용 CSS 추출 금지"는 그대로 |
| 4 | `REF` 배지는 참조 그룹 상단 헤더에 | `v-if="g.ref && comparable"` — N=1 family에서는 숨김 | library가 1개면 참조할 대상이 없어 배지가 의미를 잃는다. 설계의 "N=1에서 참조 UI를 숨긴다"와 같은 취지 |
| 5 | `cellText(row, col)`를 템플릿에서 직접 호출 | `rowCells(row)`가 `subCols`를 돌며 `cellText`를 호출 | 템플릿에서 셀당 `cellText`를 2번(텍스트·클래스) 호출하지 않기 위함. 기존 `cells(r)` 관용구와 동일한 형태 |

그 밖에는 설계 문서의 코드 스니펫을 그대로 반영했다. 설계에서 "하지 않는다"고 명시한 항목(`fetchFamilies()`, `?lib=` 하위 호환, `unreported_libraries` 배너, MW 테이블 내부 library pivot, 2단 헤더 CSS 공용화)은 전부 하지 않았다.

### 2차 라운드 (2026-09-26)

| # | 설계 | 실제 구현 | 이유 |
|---|---|---|---|
| 1 | `releasePaths()` 주석 "호출부가 `libraryInfo()`와 `libBlock()` 둘"로 보강 (설계 §3-4) | 반영함 — `releasePaths` 위 주석 한 줄 교체 | 기존 주석이 "호출부(Library Info 표, Final Report)가 family 멤버별로 반복 호출한다"였고, Library Info 탭이 이제 직접 호출하지 않으므로 그대로 두면 사실과 어긋난다. 로직·시그니처는 무편집 |

§12 삽입 블록의 `[그 외](#그-외-2)` 앵커는 삽입 후 `#### 그 외` 소제목이 §10·§11·§12 순서로 3개가 되는 것을 확인했다 — GitHub 계열 slug 규칙(`그-외`, `그-외-1`, `그-외-2`)에서 §12의 것이 `#그-외-2`로 맞으므로 설계 문서의 대안(앵커 제거)은 적용하지 않았다.

---

## 4. 검증

`npm run build` **통과** (vite 4.5.5, 2233 modules, 52s). 이 저장소에는 테스트 러너와 타입 체크가 없어 빌드가 유일한 자동 게이트다.

브라우저 수동 확인은 이 작업 환경에서 수행하지 못했고(dev 서버 조작 불가), 대신 **`data.js`를 Node로 직접 호출한 데이터 레벨 검증 + 컴포넌트 코드 리뷰**로 대체했다.

| 항목 | 방법 | 결과 |
|---|---|---|
| `LIBA` PPA Raw 값 연속성 | 변경 전 `ppaRows` vs 변경 후 `ppaTable`을 3 PDK × 3 saved set 전 조합 비교 | 96개 행 × 4 metric **전부 동일**. 단 신규 결측 규칙(`has()`)으로 LIBA에서 2개 (set,cell) 조합이 빈칸이 됨 (s1/NOR2D1, s2/INVD4) — 설계가 정한 동작 |
| MW 값 연속성 | `mwTable`/`mwFlaggedCells`를 3 PDK × 2 lib × 3 height × 2 mwType 전 조합 JSON 비교 | 72개 스냅샷 **전부 동일** (함수 미수정) |
| `releasePaths` 연속성 | LIBA/LIBB 결과 JSON 비교 | 동일 |
| 결정성 | 같은 인자로 `ppaTable`/`finalReport` 2회 호출 | 동일 출력 |
| Final Report 블록 수 | family 3종 × `finalReport()` | FAMA 7 / FAMB 10 / FAMC 4 = `libraries × 3 + 1` ✔. `library_id`·library 칩·제목 접두가 모두 일치, PPA만 `library_id: null` + 칩 없음 |
| `release_paths` 원소 수 | family 3종 | FAMA 6 / FAMB 9 / FAMC 3 = `libraries × heights` ✔, 원소마다 `library_id` 존재 |
| PPA 2단 헤더 열 수 | family 3종의 `groups`/`subCols` | 2→8 / 3→12 / 1→4 = `libraries × 4` ✔ |
| Diff 계산 | 참조 그룹의 `d*`가 `null`(→ `REF` 텍스트), 비참조는 숫자, 참조에 없는 cell은 `null`(→ 빈칸) | 기대대로 |
| `?family=` 방어 | `findFamily` + `FAMILIES.some()` 가드 | 정상값/오타(`FAMX`)/누락/빈 문자열/소문자(`famb`) 모두 첫 family로 fallback (기존 `pdk`/`tab`과 동일한 대문자 정확 일치 정책) |
| `v-for` 키 중복 | 코드 리뷰 | Library Info는 `${r.library}-${r.height}`로 family 안에서 유일. Final Report의 `:key="p.flag"`는 한 블록 = 한 library라 MW cell 이름 flag가 그대로 유일 |
| FAMC(N=1) UI | 코드 리뷰 | 참조 select(`v-if="comparable && diff"`), Raw/Diff 세그먼트(`v-if="comparable"`), REF 배지 모두 숨김. `openPicker`의 library 순환도 길이 1에서 안전(`(0+1)%1=0`) |
| family 전환 시 상태 | 코드 리뷰 | PPA `watch`가 `refLibrary=libraries[0]`, `diff=false`. MW `watch`가 `picking=null`, `sets=[makeFamilySet()]`. Final Report `watch`가 `state='idle'` + 저장 상태 리셋. Vue의 pre-flush watcher라 리렌더 전에 적용된다 |

### 2차 라운드 검증 (2026-09-26)

`npm run build` **통과** (vite 4.5.5, 2233 modules, 50s). 브라우저 조작은 이번에도 불가해 **Node로 `libraryInfo()`를 직접 호출한 데이터 레벨 검증 + 코드 리뷰**로 대체했다. 설계 §4-4 회귀 표 기준:

| 확인 | 방법 | 결과 |
|---|---|---|
| FAMA / FAMB / FAMC 행 수 | 신규 `flatRows(libraryInfo(...))` vs 구 `flatMap(releasePaths/cellDesign)` 결과 비교 | Release Path 6 / 9 / 3, Cell Design 6 / 9 / 3 — **이전과 동일** |
| library 경계선(`groupStart`) 개수 | 같은 비교 | 1 / 2 / 0 — **이전과 동일**, 첫 행은 항상 제외 |
| 행 값 동일성 | 두 경로의 `library`·`height`·`path`·`gds_version`·`drives`·`vths`·`nanosheet`·`cell_count`·`groupStart` 전수 비교 | family 3종 전부 **완전 동일** (seed 재사용 — `libraryInfo`가 `releasePaths`/`cellDesign`을 그대로 호출하고 필드명만 와이어 이름으로 바꾼다) |
| `LIBA` 값 연속성 | `release_paths` = `r4`/`r3`/`r2` + `V1.0.0.0`/`V0.9.5.0`/`V0.9.5.0`, `cell_design.cell_count` = 530/365/289 | 1차 라운드와 동일 |
| `scopeText` | 신규(응답에서 센 height 집합) vs 구(`HEIGHTS.length`) | `2 / 3 / 1 libraries × 3 heights` — **문자열까지 동일** (FAMC는 설계대로 `1 libraries × 3 heights`) |
| `cell_height_id` | `heightId(height)` 결과 | 1/2/3 — `HEIGHTS` 인덱스+1과 일치, `/clara/cell-height/` FK 공간 |
| `pdk_id` 되돌림 | `libraryInfo('p1'/'p3', …)` | 1 / 3 |
| PDK 드롭다운 변경 | 코드 리뷰 | `info`가 `props.pdk.id`에 의존하지만 mock 값은 `pdk_id` 필드만 바꾼다 — 두 집계 표의 값은 불변, PDK 버전 정보 표만 `props.pdk`로 바뀐다 (기존과 같은 동작) |
| `HEIGHTS` orphan | `grep -rn HEIGHTS src/` | `data.js`(`releasePaths`·`heightId`)와 `TabMw.vue`에서 계속 쓰인다 — export 유지가 맞고 `TabLibraryInfo.vue`의 import만 제거됨. orphan 없음 |
| 편집 금지 파일 | 변경 대상 확인 | `TabMw.vue`·`TabPpa.vue`·`TabFinalReport.vue`·`LibraryReportView.vue`·`docs/final-report-design.md`·`API.md` §10 — **무편집** |

### 브라우저에서 직접 확인이 남은 항목

- `group-start` 경계선이 **시각적으로** library 전환 지점에만 보이는지 (논리는 검증, 렌더 확인 필요)
- 콘솔에 duplicate key 경고가 실제로 없는지 (키 유일성은 논리적으로 확인)
- PPA 2단 헤더가 가변 열 폭에서 본문 행과 **픽셀 단위로** 정렬되는지 — 헤더/본문이 같은 `gridTemplateColumns`와 같은 `padding: 0 12px`를 쓰므로 정렬되어야 하지만, library 3개(12 numeric 열)에서 가로 스크롤 시 확인이 필요하다
- family 전환 시 MW 테이블 수가 화면에서 library 수와 맞는지
- (2차) GDS VERSION / CELL COUNT 열이 실제로 값을 렌더하는지 — 필드명이 `gds_version`/`cell_count`로 바뀌었고 Vue 템플릿의 undefined 접근은 조용히 빈칸이 되므로 빌드로는 잡히지 않는다. Node 검증에서 두 필드가 채워진 것은 확인했다
- (2차) 콘솔 경고·에러 0건

---

## 5. 미완료 / 후속 항목

1. **`src/api/cells.js`에 `fetchFamilies()` 없음** — 의도적(설계 §2-3). 백엔드 연동 단계에서 `get('/clara/family/')` 한 줄로 추가한다.
2. **`unreported_libraries` 배너 UI 없음** — 의도적. mock이 절대 채우지 않는 값이라 지금 UI를 붙이면 죽은 코드가 된다.
3. **백엔드 협의 필요** — `LOCKED` 리포트의 family member drift 교착, `UNIQUE (pdk_id, family)`의 revision 확장 여부, family 재분류 정책. [final-report-design.md](final-report-design.md) 8장 #8~#10.
4. **`PROGRESS.md` §11**(2026-09-17 확정 스펙 기록)에 "Final Report는 PDK & library별 1개씩 생성"이라는 문장이 남아 있다. 회의 기록이라 고치지 않았으나, 현재 설계는 (PDK, family)당 1개다 — 다음 회의에서 스펙 갱신으로 정리할 항목.
5. **기존 CSS 이슈(이번 변경과 무관)** — `TabLibraryInfo.vue`의 `.g-design .lr-row { height: auto; ... }`는 `.g-design`이 `.lr-row` 자신이라 선택자가 매칭되지 않는다(자손 선택자). Cell Design 행이 mini-table 높이를 못 받는 원인일 수 있다. 이번 범위가 아니라 손대지 않았다.

### 2차 라운드 후속 (2026-09-26)

6. **오픈 이슈 4건** — [library-report-family-design.md](library-report-family-design.md) §7 #7(MW를 family 단위로 묶을지), #8(release path·GDS version 원천 테이블), #9(`cell_height` 식별자 정규화), #10(release/GDS의 PDK 의존성). #8~#10은 백엔드/기획 확인 대기.
7. **`docs/final-report-design.md` §7-8의 "Library Info 집계 → 신규 쿼리(원천 미확인)" 문장이 §12 신설로 낡았으나, 해당 파일은 이번 라운드 편집 금지 범위여서 보류.** Final Report 저장/최종저장 흐름 보류가 해제되는 라운드에 함께 정리한다.
8. **`src/api/cells.js`에 `fetchLibraryInfo()` 없음** — 의도적(설계 §8). 연동 단계에서 `get('/clara/library-info/', { pdk_id, family })` 한 줄로 추가한다.
9. **`path: null` / 빈 집계 배열의 렌더 분기 없음** — 의도적. mock이 절대 만들지 않는 값이라 지금 UI를 붙이면 죽은 코드가 된다. 계약(§12)은 둘 다 정상 응답으로 열어 두었다.
10. **`libraryInfo()`와 `libBlock()`이 같은 per-library shape을 각자 만든다** — 공용 헬퍼로 추출하려면 Final Report mock을 건드려야 하고 두 엔드포인트는 계약상 독립이므로, 관찰만 기록하고 통합하지 않았다.
