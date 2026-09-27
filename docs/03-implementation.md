# Library Report — Family 기반 Library 그룹핑 구현 기록

> 브랜치: `mw-table-height-type-params`
> 작업일: 2026-09-26
> 설계: [library-report-family-design.md](library-report-family-design.md) (API 계약은 [../API.md](../API.md) §11·§12)
> 범위: `src/views/library-report/` 5파일 + 문서 5파일. 의존성 추가 없음
> 2차 라운드: 2026-09-26 — Library Info 집계 API(`GET /clara/library-info/`, `API.md` §12) 반영. 아래 표의 `(2차)` 행 참조
> 4차 라운드: 2026-09-27 (브랜치 `library-report-ui-port`) — Cell Design 집계 API(`GET /clara/cell-design/`, `API.md` §13) 반영 + 승인된 계획의 버그 수정 6건(A · C-1~C-5). 아래 표의 `(4차)` 행과 §11~§14 참조

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
| **(4차)** `src/views/library-report/data.js` | `cellDesignByHeight()` 본문을 내부 함수 `cellDesignHeights(seed)`로 들어냄 — **시드 접두사만 인자화**했으므로 `cellDesignByHeight(rep)`의 반환값은 글자 단위로 이전과 같다. `cellDesignStats(pdkId, family)` **신규** — `GET /clara/cell-design/`(§13) 응답 shape을 mock으로 재현, 시드에 `pdkId`와 `library`를 포함. `BIT_POOL`/`DRIVE_AXIS`/`NS_AXIS`/`REP_CELLS`/`CELL_DESIGN_VTH_AXIS` 및 `libraryInfo`/`releasePaths`/`cellDesign`/Final Report mock **전부 무편집** |
| **(4차)** `src/views/library-report/TabLibraryInfo.vue` | `REP_CELLS`/`cellDesignByHeight` import 제거 → `cellDesignStats`. `repBlocks` computed를 `design`(§13 **1회 호출**) + `designLibs`(펼치기) + `bitCard(b, d)` 헬퍼로 교체. 템플릿에 library 그룹 3겹(`.lib-design-list` > `.lib-design` > `.lib-design-head`) 추가 — **`.rep-block` 내부는 내용 무변경**(들여쓰기만 조정). 부제·footnote 문구 2곳. `<style>` 4줄 추가. **C-2 잠금**: `locked` inject + `editing = infoEditing && !locked` computed, 편집 버튼·DESCRIPTION 입력 `disabled` |
| **(4차)** `src/views/library-report/useReportStore.js` | **A**: `areaSignature`는 컴포넌트에 있어 무관 — 아래 `TabFinalReport` 행 참조. **C-1**: `makeReleaseRows()` 헬퍼 도입(id 카운터 공유) + `setFamily()`에 `releaseRows`/`gdsDesc`/`libDesc`/`ppaSetId`/`ppaLinkedId` 리셋. **C-2**: `GRACE_DAYS = 5` + 분 단위 `setInterval`로 갱신되는 `now` ref + `locked`/`graceDaysLeft` computed(+ `onScopeDispose`로 타이머 정리), `toggleInfoEdit`/`toggleFrEdit`/`frSave`/`frFinalize`에 `locked` 가드, `frFinalize`의 confirm 문구가 `GRACE_DAYS`를 참조. 반환값에 `locked`/`graceDaysLeft`/`GRACE_DAYS` 추가 |
| **(4차)** `src/views/library-report/TabFinalReport.vue` | **A**: `areaSignature.PPA`에 `pdkId` 추가. **C-2**: 편집/저장 버튼을 `v-if="!locked"`로 전환(유예 중 편집 가능), 「최종 저장」은 `finalizedAt`이 없을 때만, 배너의 `수정 가능 D-5` 하드코딩 → `D-{graceDaysLeft}`, `locked`면 「수정 불가」 태그 + 「다시 생성」·「AI 초안 생성」 숨김 + `generate()` 가드. **C-3**: `buildArea('MW')`가 `mwTable().over` 대신 `mwFlaggedCells()`/`MW_THRESHOLD`를 테이블마다 호출해 합산(`FLAGGED`/`NO-SLOPE` 포인트). `mwTable` import 제거. **C-4**: 댓글 위젯의 `v-if="state.finalizedAt"` 제거 |
| **(4차)** `src/views/library-report/TabPpa.vue` | **C-2**: `locked` inject, 「리포트에 저장」 `disabled` + `:disabled` 스타일 1줄 |
| **(4차)** `src/views/library-report/TabMw.vue` | **C-2**: `locked` inject, 「+ 비교 셋 추가」·「복제」·「삭제」(셋/테이블)·「+ 테이블 추가」 `disabled`, 피커 `v-if`에 `&& !locked`, `:disabled` 스타일 3줄 |
| **(4차)** `src/views/library-report/LibraryReportView.vue` | **C-5**: family select 옆에 읽기 전용 멤버 library 칩 스트립 복원 — `MAX_CHIPS = 4` + `shownLibs`/`hiddenLibCount` computed, `.lr-fam-libs`/`.lr-fam-lib`/`.lr-fam-lib.more` CSS 3줄. 2차 구현(`67017df`)과 동일 마크업 |

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
| **(4차)** `API.md` | `## 13. Cell Design 집계` **신규 섹션**(`GET /clara/cell-design/`) + 목차(14~16 번호 밀기)·§12 상단 ⚠️ 주석 2번 항목 교체(확정 + §13 분리)·§12 📌 안내 한 줄·부록 엔드포인트 표·호출 패턴·변경 이력 신규 항목·최종 수정일. **§1~§12 계약 본문과 데이터 모델 관계는 무변경** (신규 테이블 없음) |
| **(4차)** `docs/final-report-design.md` | §2-3 제목 `(⚠️ 미결)` → `(확정 — 프론트 로컬 판정)` + 확정 블록 + "구멍" 2건 해결 표시, **§5-2 전면 재작성**(잠금 구현 내용·상태별 화면 표), §7-8 Cell Design 행 확정, §8 #3 비고 + #7·#11·#11-a·#13·#14·#18·#23 닫기 + #22 부분 해결 + **#27~#32 신규**, §10 표 3행·§10-1 죽은 코드 불릿 갱신, 최종 수정일 |
| **(4차)** `docs/library-report-family-design.md` | 머리말 근거/상태, §0 유효한 것 표에 §13 행, §1 필드명 규칙(snake_case 예외에 `cellDesignStats()`), §4-0에 **4차 델타 소절 신규**, §4-1 3차 표의 Cell Design 행 + 귀결 3번 해결 표시 + **`#### 4차 — Cell Design에 library 축 복원` 절 신규**, §6 상태 전이 맵의 `pdk`/`family` 행 + 경고 해소, §7 #9 참조·#11·#12·#17 닫기 + #14·#16 부분 해결 + **#18 신규**, §8 3차 절 3행 갱신 + **4차 절 신규**, 최종 수정일 |
| **(4차)** `PROGRESS.md` | §3-11 Library Info 불릿의 Cell Design 설명 + ⚠️ 해결, §4-2에 `GET /cell-design/` 추가 + "미등재" 표에서 해당 행 제거, §9 알려진 이슈 4건 갱신(잠금·family 누수 해결, 죽은 코드 목록, MW 기준 불일치 신규), §10-1에 `[x]` 2건 + 신규 협의 3건 |

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

---

# 3차 라운드 (2026-09-26) — Library Report UI 전면 포팅

> 브랜치: `library-report-ui-port` (HEAD `f1aa47a` — `refactor: port Library Report UI to a centralized provide/inject store`)
> 성격: **코드는 외부 도구로 재작성되어 포팅된 상태로 이미 브랜치에 있다.** 이 라운드의 작업은 **문서를 실제 코드에 맞추고, 이번 구현이 백엔드에 요청해야 할 API 스펙을 확정하는 것**이었다. 코드는 건드리지 않았다
> 대상 문서: `docs/final-report-design.md`, `docs/library-report-family-design.md`, `PROGRESS.md`, `API.md`(주석만), 이 파일

## 6. 포팅된 코드의 실제 구조 (문서화 대상)

### 6-1. 파일

| 파일 | 상태 |
|---|---|
| `src/views/library-report/useReportStore.js` | **신규.** `createReportStore()`(state + actions) + `fmt(ts)`. 4탭 상태 전부가 여기 모인다 |
| `src/views/library-report/LibraryReportView.vue` | `createReportStore()` → `provide('report')`. 탭 props 전달 제거. 멤버 library 칩 strip 제거 |
| `src/views/library-report/TabLibraryInfo.vue` | 전면 재작성 — Library List(설명 입력) / Release Path(편집 가능 목록) / Cell Design(대표 셀 뷰) |
| `src/views/library-report/TabPpa.vue` | `inject`로 전환 + "리포트에 저장"(`ppaLinkedId`) 분리 |
| `src/views/library-report/TabMw.vue` | `inject`로 전환. 표 구조·CSV·2단 헤더는 그대로 |
| `src/views/library-report/TabFinalReport.vue` | 전면 재작성 — 영역 3개 + USER 영역, `areaSignature` 유효성 판정, 댓글 위젯 |
| `src/views/library-report/data.js` | `REP_CELLS` / `cellDesignByHeight(rep)` / `CELL_DESIGN_VTH_AXIS` 추가. Final Report 블록 빌더는 남았으나 호출부 소멸 |

### 6-2. 설계에서 실제로 뒤집힌 것

| # | 이전 설계 | 포팅 후 |
|---|---|---|
| 1 | 컴포넌트 간 props + route query | **`provide/inject` 중앙 스토어** — 탭 전환에도 상태 유지 |
| 2 | 리포트 전체를 한 번에 생성 | **영역(LIB/PPA/MW)별 개별 생성·재생성** (`genArea`) |
| 3 | 블록이 library마다 하나씩(`library_id` 필수, N×3+1) | **영역 3개 고정 + USER 영역 N개.** 세 영역이 family 전체 집계 |
| 4 | 백엔드가 `stale`을 계산해 내려줌 | **프론트 로컬 signature 비교**로 자체 판정 |
| 5 | GDS version·cell design = 쿼리 집계 | **release path 행 CRUD · GDS version · GDS 설명 · library별 설명이 전부 사용자 입력**이고 리포트 소유 |
| 6 | Release Path = `library × height` 표 | **리포트 전체 편집 목록** (cell height 그룹, 한 height에 행 N개, library 축 없음) |
| 7 | Cell Design = library별 (drive/vth/nanosheet/cell_count) | **대표 셀 × cell height × bit-width** (`cellDesignByHeight(rep)` — library·pdk 인자 없음) |
| 8 | 댓글 = 단일 `user` 자유입력 블록으로 대체 | **진짜 댓글 스레드**(작성자/시각/수정/삭제). `USER` 영역과 별개 기능 |
| 9 | PPA 블록 = `chart_id` 참조 | **미리보기(`ppaSetId`) vs 리포트 연결(`ppaLinkedId`) 분리.** 연결만 리포트 소유 |
| 10 | MW 블록 = `(library, height, mw_type)` 참조 키 | **MW 비교 셋 구성 자체가 리포트 소유 사용자 입력** |

### 6-3. 뒤집히지 **않은** 것 (문서에 명시함)

- **family 기반 스코프 (PDK × family)** — 스토어가 계속 `FAMILIES`/`findFamily` 기반. `GET /clara/family/`·`GET /clara/library-info/`의 존재 이유는 그대로다. 바뀐 것은 Library Info **탭의 화면 구성**과 Final Report의 **생성 입도**다
- 참조형 대 스냅샷형 원칙, 최종 저장 후 5일 유예, MW 필터 규칙(계약 수준), 원본 삭제 보호, ETL MERGE 전환
- route query 4키(`tab`/`pdk`/`family`/`set`)와 방어 fallback
- PPA 탭의 2단 헤더·실측 diff, MW 탭의 "테이블에 library 축을 넣지 않는다"
- 메인 CLARA PPA 빌더(`src/stores/builderStore.js`, `src/components/builder/*`) — 이번에도 범위 밖

## 7. 이번 라운드의 핵심 산출물 — 백엔드에 요청할 API

`docs/final-report-design.md` §7을 포팅된 구현에 맞춰 다시 썼다. 결정한 것:

1. **영역별 생성은 `POST /clara/report/area-draft/` (신규, stateless).** `PUT /clara/report/<id>/`(blocks 전량 교체)로 대체하지 않는다. 근거: (a) 프론트에 리포트 `id` 개념이 없어 리포트 행을 먼저 만들게 하면 **보류 중인 저장 이슈를 선점**한다, (b) 생성 입력값 중 release path·MW 셋 구성 등이 **아직 저장되지 않은 로컬 값**이라 요청 body에 담아야 하므로 `report_id`가 필요 없다, (c) UI가 한 영역만 재생성하고 700ms 스피너가 도는 비용 있는 호출이라 저장 왕복과 수명이 다르다. 대안(`POST /clara/report/<id>/area/<AREA>/generate/`)도 문서에 남기고 권고하지 않는 이유를 적었다
2. **블록 `data` inline 확장을 폐기**했다. 각 탭이 자기 원천을 직접 조회하고 Final Report는 화면의 값을 로컬 집계하므로, 같은 값을 응답으로 한 번 더 받을 이유가 없다. 대신 `points`(요약 bullet)를 저장·응답 대상으로 승격했다
3. **리포트 소유 입력의 저장 스키마**를 `fr_report`의 JSON/스칼라 컬럼으로 정의했다 — `release_paths`(원소에서 `library_id` 제거, `row_id` 추가, 순서 보존), `gds_desc`(리포트당 1개), `library_desc`(`{library_id: text}`), `chart_id`, `mw_sets`. 자식 테이블로 빼지 않은 이유는 행 단위 PATCH UI가 없다는 것
4. **댓글 CRUD 4개.** `PUT`/`DELETE` 신설 + `updated_at`/`updated_by` 컬럼. hard delete(자리표시자 UI가 없으므로)
5. **PPA 연결 제약을 계약으로 승격.** `PPA` 영역은 `chart_id`(= `ppaLinkedId`)가 있을 때만 생성 가능 → 없으면 `400`. 프론트가 이미 버튼을 막고 백엔드가 2차 방어
6. **`fr_block`에서 참조 키를 전부 제거**하고 `UNIQUE (report_id, block_type)`로 영역 3개를 고정했다. 참조 키는 리포트 레벨로 올라갔다

### 결정하지 않고 오픈 이슈로 남긴 것

- **유효성 판정 주체** (프론트 signature vs 백엔드 `stale` vs 하이브리드) — 장단점 표와 **하이브리드 권고**까지만 쓰고 확정하지 않았다. 저장 방식 보류 이슈와 얽혀 있다 (§2-3, §8 #13)
- **저장·최종저장의 연동 방식** — 사용자가 명시적으로 보류시킨 이슈. 현재 구현(로컬 타임스탬프만)을 그대로 문서화하고 §5-0에 "payload shape까지만 정의, 트리거는 보류"로 못 박았다 (§8 #12)
- **대표 셀 Cell Design의 실체** — mock 한계인지 실제 성질인지 확인 항목으로 §8 #11에 올리고, library별일 경우의 초안 스펙(`GET /clara/cell-design/`)을 #11-a에 함께 제시했다. **(b) library별일 가능성이 높다**고 판단 근거를 적었다 → **4차(2026-09-27)에서 (b)로 확정되어 `API.md` §13으로 승격됐다** (§11~§14)

## 8. 문서별 변경

| 파일 | 변경 |
|---|---|
| `docs/final-report-design.md` | **§0 신규**(포팅 델타 요약 + 유효/무효 구분), §1 범위(Library Info가 순수 원본 소유자가 아님), §2-1(소유 입력 확장 표), **§2-3 전면 재작성**(판정 주체 비교·권고·발견된 구멍), **§2-4 신규**(영역별 생성 모델), §3-1(입력 컬럼 확장), **§3-2 전면 재작성**(참조 키 제거, 영역 3개 고정), §3-3(댓글 수정/삭제), §3-5 전면 재작성(원천 역전), **§3-6 신규**(PPA 연결·MW 셋), §4에 mock 불일치 경고, **§5-0 신규**(보류 이슈 명시), §5-1~§5-3 재작성, **§7 전면 재작성**(엔드포인트 표·7-1~7-9), §8에 3차 신규 #11~#26, §10 + §10-1 신규 |
| `docs/library-report-family-design.md` | **§0 신규**(유효/낡음 구분 표 — family 스코프 유효 명시), §3-1(칩 제거), §3-3에 이력 표시 + **§3-4 신규**(중앙 스토어 계약), §4-0에 3차 델타, **§4-1에 대표 셀 뷰 절 신규**(1·2차는 이력으로 보존), §4-4에 3차 델타, §5-1·§5-2에 폐기 주석, **§6 상태 전이 맵 재작성**, §7에 3차 #11~#17, §8에 3차 절 |
| `PROGRESS.md` | 머리말(브랜치), §2 상태 관리, **§3-11 재작성**, §4-1 파일구조(`useReportStore.js`/`report.css`), **§4-2에 "요청 예정" 엔드포인트 표 신규**, §5-4, §9 신규 이슈 3건, §10-1 협의 항목 4건 추가, **§10-4 재작성** |
| `API.md` | **§12 상단 ⚠️ 소비처 변경 주석 + 변경 이력 1건.** 계약(쿼리·응답 shape) 자체는 **손대지 않았다** — 이유는 아래 |
| `docs/03-implementation.md` | 이 절 (기존 1·2차 기록 보존) |

### `API.md`를 최소로만 고친 이유

`API.md`는 **이미 합의된 계약의 정본**이고, `GET /clara/report/` 계열은 애초에 등재되어 있지 않다(§12까지가 등재분). 따라서 댓글 CRUD 추가·영역별 생성 엔드포인트 같은 이번 신규 항목은 **`API.md`가 아니라 `docs/final-report-design.md` §7(초안)에 쓰는 것이 맞다.**

그럼에도 §12에 주석을 넣은 것은 **백엔드가 헛일을 하는 것을 막기 위해서**다. §12의 `release_paths`는 `library_release`(가칭) 원천 테이블 신설을 전제로 쓰였는데, 3차 포팅이 release path를 리포트 소유 사용자 입력으로 만들면서 **그 테이블이 필요 없어질 가능성이 높아졌다.** 착수 전에 확인해야 하는 사항이라 응답 shape은 그대로 두고 경고만 붙였다.

## 9. 검증

- 문서 작업이므로 코드 검증은 없다. `npm run build`를 돌리지 않았고, 포팅된 코드의 동작도 브라우저에서 확인하지 않았다
- 대신 **코드를 읽어 문서 서술을 대조**했다: `useReportStore.js` 전량, `TabFinalReport.vue`·`TabLibraryInfo.vue`·`TabPpa.vue`·`TabMw.vue`·`LibraryReportView.vue` 전량, `data.js`의 `cellDesignByHeight`/`REP_CELLS`/`libraryInfo` 부분
- `grep`으로 **`data.js` export의 실제 호출부를 전수 확인**해 죽은 코드 목록(`finalReport`/`libBlock`/`ppaBlock`/`mwBlock`/`mwFlaggedCells`/`MW_THRESHOLD`/`VTH_ALL`/`NANOSHEET_ALL`)과 `libraryInfo()`의 유일 소비처(Final Report `LIB` 영역)를 확정했다
- 문서 간 상호 참조(절 번호)가 실제로 존재하는지 대조했다

## 10. 미완료 / 후속 항목 (3차)

11. **코드 정리를 하지 않았다** — `data.js`의 죽은 코드, `setFamily()`의 상태 누수(`releaseRows`/`ppaLinkedId` 미리셋), Library Info의 편집 게이트 불일치, 잠금 UI 미구현. 전부 오픈 이슈로 문서화만 했다. 이번 라운드가 문서 정합화 범위였고, 특히 죽은 코드는 **실 연동에서 어느 것이 되살아나는지 확정한 뒤** 정리하는 것이 맞다
12. **`ai_draft` / `body` 분리가 프론트에 없다** — `state.frAreas[type]`에 `body` 하나뿐이라 편집하면 초안이 사라진다. 스키마는 분리를 유지했으므로 연동 시 프론트가 맞춰야 한다
13. **`PROGRESS.md` §11**(2026-09-17 확정 스펙 회의 기록)의 "Final Report는 PDK & library별 1개씩 생성"이 여전히 남아 있다 — 2차 후속 항목 #4와 동일. 회의 기록이라 고치지 않았다
14. **오픈 이슈 총 16건 신규** — `final-report-design.md` §8 #11~#26, `library-report-family-design.md` §7 #11~#17. 그중 **기획·백엔드 확인이 선결인 것**: 대표 셀 Cell Design의 실체(#11), release path의 library 축 소멸(#19), `library_release` 원천 신설 필요성(#20), library 설명의 소유자(#21), 댓글 권한(#17)·노출 시점(#18)

---

## 11. 4차 라운드 (2026-09-27) — Cell Design 집계 API + 버그 수정

브랜치 `library-report-ui-port`. 설계는 `_workspace/01c_architect_spec.md`, 버그 수정은 승인된 계획(`fancy-soaring-kahan.md`)의 A · C-1~C-5.

### 11-1. 주요 결정 사항

1. **대표 셀 Cell Design의 스코프는 (PDK, library)다.** 3차의 `cellDesignByHeight(rep)`가 인자 하나로 전역 동작한 것은 mock의 한계였고, 화면이 어느 library의 지원 범위인지 말하지 않는 **표시 오류**였다. 그 귀결로 `API.md` §12의 `cell_design` 블록은 **소비처 상실이 확정**됐다(제거 여부는 §13 백엔드 착수 시 함께 결정 — [final-report-design.md](final-report-design.md) §8 #29).
2. **집계는 백엔드가 해서 한 번에 내려준다.** `GET /clara/mw/`류(프론트 pivot)가 아니라 `GET /clara/library-info/`(§12)와 같은 family 단위 집계 1회다. 축이 다르므로 §12를 확장하지 않고 **별도 엔드포인트로 분리**했다 — §12의 `release_paths` 원천 미확정이 이 뷰의 배포를 막지 않게 하는 효과도 있다.
3. **축 3개(`drive_axis`/`nanosheet_axis`/`vth_axis`)를 응답 top-level에 뒀다.** 미지원 항목을 *제자리에 회색으로* 남기는 화면이므로 칩·막대가 family 전체에서 같은 위치여야 library 간 비교가 성립한다. 부수 효과로 컴포넌트가 프론트 상수를 import하지 않게 되어 출처가 하나가 됐다.
4. **`cellDesignByHeight`를 삭제하지 않고 시드 접두사만 인자화**해 `cellDesignHeights(seed)`로 들어냈다. 로직 중복이 0이므로 남겨 둔 함수가 본체와 갈라질 수 없고, 접두사가 `rep`일 때 시드 문자열이 이전과 같아 **기존 값이 글자 단위로 보존**된다(`library-report-family-design.md` §2-4 값 연속성).
5. **잠금 판정을 스토어 한 곳에 뒀다.** `GRACE_DAYS = 5` + 분 단위 `setInterval`로 갱신되는 `now` ref 기반 `locked` computed를 `provide('report')`로 네 탭에 내린다. 판정 규칙이 탭마다 흩어지면 유예 계산이 갈라진다.
6. **MW 요약을 계약에 맞췄다.** `MW` 영역이 `mwTable()`의 `over`(CK Slope 전체 × `MW_HIGH = 44`)를 세던 것을 `mwFlaggedCells()`(CK Slope 40 고정 × `MW_THRESHOLD[mwType]`)로 교체했다 — `docs/final-report-design.md` §4가 정의한 규칙이다. **MW 탭 표의 하이라이트는 통일하지 않았다** (§13).

### 11-2. 설계와 다르게 구현한 부분

| 항목 | 설계 | 구현 | 이유 |
|---|---|---|---|
| `TabLibraryInfo.vue` 템플릿 들여쓰기 | "`.rep-block` 내부는 한 줄도 바뀌지 않는다" (§4-3) | 내용은 동일하나 **들여쓰기를 4칸 깊게 조정**했다 | library 그룹 3겹이 추가되면서 기존 들여쓰기를 유지하면 중첩이 시각적으로 뒤집힌다. 내용(속성·표현식·클래스)은 글자 단위로 같다 |
| 유예기간 중 「최종 저장」 버튼 | 계획: "`locked`가 아닐 때는 편집 가능하도록" (버튼 3개 묶음) | 「편집」·「저장」은 유예 중에도 노출, **「최종 저장」은 `finalizedAt`이 없을 때만** | 다시 누르면 유예 시계가 리셋된다. 계획의 의도는 "편집을 막지 말라"이고 재확정 허용까지는 아니라고 읽었다 |
| `TabLibraryInfo.vue`의 편집 모드 게이트 | 계획에 명시 없음 | `editing = infoEditing && !locked` computed 도입 | 편집 중에 유예기간이 끝나면(`now`가 분 단위로 오르므로 실제로 일어난다) `infoEditing`이 true로 남아 입력이 열린 채 잠긴다 |
| 스토어 액션의 `locked` 가드 | 계획은 "각 탭에서 편집 컨트롤 비활성화" | 템플릿 `disabled` + **`toggleInfoEdit`/`toggleFrEdit`/`frSave`/`frFinalize`/`generate()`에도 가드** | 템플릿만 막으면 `locked`가 시간으로 바뀌는 순간 이미 열린 경로가 남는다 |
| MW 요약의 포인트 구성 | 계획은 "합산하도록 교체" | `OVER` 포인트를 `FLAGGED` + `NO-SLOPE` 두 줄로 나눴다 | `mwFlaggedCells()`는 `slope_present: false`(그 조합에 slope 40 데이터가 없음)를 구분해 돌려준다. "0건"과 "데이터 없음"을 같은 숫자로 뭉개면 요약이 사실을 흐린다 |
| `nextReleaseId` 초기값 | 계획: "카운터는 계속 증가" | `4` → `1`로 바꾸고 초기 상태도 `makeReleaseRows()`로 생성 | 초기 3행이 여전히 id 1·2·3을 받고 카운터가 4가 되므로 **기존 동작과 동일**하다. 초기값을 손으로 쓴 배열과 리셋 함수가 갈라지는 것을 없앤다 |

## 12. 4차 라운드 검증

`npm run build` **통과** (vite 4.5.5, 경고는 기존 chunk-size 경고뿐). 브라우저 조작이 불가하므로 **Node로 함수를 직접 호출한 데이터 레벨 검증 + 코드 리뷰**로 대체했다 (2차 라운드와 같은 방식).

### 12-1. 시드 불변 (설계 §7 작업 2의 검증 기준)

`cellDesignByHeight()`의 반환값을 변경 **전** JSON으로 덤프해 두고 변경 **후**와 문자열 비교했다.

| 대표 셀 | 결과 |
|---|---|
| `JSDFF` / `JSDFFR` / `JSLATCH` / `JSMUX` | **4건 전부 IDENTICAL** (JSON 직렬화 기준 완전 동일) |

### 12-2. 설계 §4-5 회귀 판정 기준

| 확인 | 기대 | 결과 |
|---|---|---|
| FAMA 선택 | library 그룹 2개(LIBA, LIBB), 각 그룹에 대표 셀 4개 | ✅ `libraries: LIBA:4 LIBB:4` |
| FAMB / FAMC | 그룹 3개 / 1개 | ✅ `family.libraries.map()`이 그대로 펼쳐지므로 구조적으로 보장 |
| **library별 값 차이** | 같은 (대표 셀, height, bit)에서 LIBA ≠ LIBB | ✅ `JSDFF/CH120/1bit`에서 nanosheets `[N1,N1P5,N2,N3]` vs `[N1,N2,N3]`, vths 5종(합 780) vs 3종(합 480) |
| **PDK별 값 차이** | `p1` → `p3`으로 바꾸면 값이 바뀐다 | ✅ `libraries` 전체 JSON이 다르고 `pdk_id`도 1 → 3 |
| 축 고정 | 모든 카드에서 drive 4 / nanosheet 4 / VTH 5, 항상 같은 순서 | ✅ `bitCard()`가 `d.*_axis`를 `map`하므로 카드마다 축 길이·순서가 응답과 동일 — 전수 확인됨 |
| `total` | present VTH count 합과 일치 | ✅ mock에서 `cell_count = SUM(vths[].cell_count)`가 불변식 (§3-4 구현 메모) |
| 응답 최상위 shape | `{ family, pdk_id, drive_axis, nanosheet_axis, vth_axis, libraries }` | ✅ 키 순서까지 §8 계약 표와 일치 |
| Release Path / Library List / PDK 표 | 이전과 동일 | ✅ 해당 코드 무편집 (Cell Design 블록만 교체) |

### 12-3. A · C-1 · C-2 (코드 + 데이터 레벨)

`effectScope()` 안에서 `createReportStore()`를 만들어 직접 조작했다.

| 확인 | 결과 |
|---|---|
| **A** PPA signature | `PPA: {"pdkId":"p1","linked":null}` — PDK를 바꾸면 문자열이 바뀐다 (코드 리뷰) |
| **C-1** family 전환 | 전: 행 4개(id 1,4,2,3) + `gdsDesc:"note"` + `libDesc:{LIBA:...}` + `ppaSetId/ppaLinkedId:"s2"` → 후: **행 3개(id 5,6,7, path/gds 전부 `''`, height CH120/CH150/CH180)** + `gdsDesc:""` + `libDesc:{}` + 둘 다 `null` |
| **C-1** id 충돌 | 새 행 id가 옛 행 id와 겹치지 않음 (`false`) |
| **C-2** `locked` | 미확정 `false` / 확정 직후 `false` / 4.9일 `false` / **5.1일 `true`** |
| **C-2** `graceDaysLeft` | 4.9일 경과 시 `1`, 5.1일 경과 시 `0` |
| **C-2** 액션 가드 | `locked`에서 `toggleInfoEdit()`·`toggleFrEdit()` 무효, `frSave()`가 `savedAt`을 바꾸지 않음 |
| **C-2** 타이머 정리 | `scope.stop()`으로 `onScopeDispose` → `clearInterval` 동작 확인 |

### 12-4. C-3 (MW 요약)

기본 셋(FAMA / `p1` / LIBA·CH120·MWD + LIBB·CH150·MWD) 기준.

| 기준 | 값 |
|---|---|
| 기존 `v.over` 합 (모든 CK Slope, `MW_HIGH = 44`) | **0건** — mock의 `mwTable()` 값이 44를 넘지 않아 요약이 항상 "0건"이었다 |
| 신규 `mwFlaggedCells()` 셀 합 (CK Slope 40, `MW_THRESHOLD`) | **19개** (LIBA 9 + LIBB 10), `slope_present` 둘 다 true |
| 임계값 민감도 | 같은 (LIBA, CH120)에서 `MWD`(44) 9개 vs `MWS`(40) 13개 — `MW_THRESHOLD[mwType]`이 실제로 반영된다 |

**값이 달라지는 것이 정상이다** — 세는 규칙 자체가 달라졌고, 기존 값은 필터 규칙(§4)과 무관한 수치였다.

### 12-5. C-4 · C-5 (코드 리뷰)

- **C-4**: 댓글 위젯의 `v-if="state.finalizedAt"` 제거 — DRAFT에서도 렌더된다. 위젯은 `position: fixed`라 레이아웃 영향이 없다.
- **C-5**: 칩 스트립은 2차 커밋(`67017df`)의 마크업·스타일·`MAX_CHIPS = 4` 로직을 그대로 복원했다. CSS 변수(`var(--clara-mono)`)만 이 파일의 관례(`'Roboto Mono',monospace`)로 맞췄다.

### 12-6. 브라우저에서 직접 확인이 남은 항목

- Cell Design의 **시각적 계층** — library 헤더 경계선이 대표 셀 dot과 구분되어 보이는지, 그룹 간 22px / 대표 셀 간 16px 간격이 의도대로 읽히는지
- 카드 수가 늘어난 뒤의 **스크롤 길이** (FAMB = 3 library × 4 대표 셀 × 3 height) — 접기가 필요한 수준인지 ([final-report-design.md](final-report-design.md) §8 #30)
- `disabled` 버튼·입력의 **회색 처리**가 각 탭에서 일관되게 보이는지
- `locked` 전이는 5일이 걸려 실사용 확인 불가 — `finalizedAt`을 과거로 주입한 데이터 레벨 검증으로 대체했다
- 콘솔 경고·에러 0건 여부

## 13. 4차 라운드 미완료 / 후속 항목

1. **MW 탭 표의 하이라이트 기준을 통일하지 않았다** — 요약만 계약(§4)에 맞췄고, 표는 여전히 `MW_HIGH = 44`(CK Slope 전체)다. 표가 slope 전체를 보여주는 뷰이므로 두 기준의 공존이 맞을 수도 있어 결정 항목으로 남겼다 → [final-report-design.md](final-report-design.md) §8 #31
2. **`setPdk()`는 여전히 사용자 입력을 리셋하지 않는다** — `setFamily()`와 대칭이 아니다. release path가 PDK에 의존하는지가 먼저 정해져야 한다 → [final-report-design.md](final-report-design.md) §8 #32
3. **`finalizedAt`이 로컬 타임스탬프다** — 새로고침하면 잠금이 풀린다. 저장 트리거가 보류 이슈이므로 이번에 바꾸지 않았다 ([final-report-design.md](final-report-design.md) §5-0, §8 #12). 백엔드 `403`/`editable_until` 짝맞춤도 남아 있다
4. **`data.js`의 죽은 코드를 정리하지 않았다** — `finalReport()`/`libBlock()`/`ppaBlock()`/`mwBlock()`/`VTH_ALL`/`NANOSHEET_ALL`, 그리고 4차에서 호출부를 잃은 `cellDesignByHeight()`. 후자는 로직이 `cellDesignHeights()`에 있어 갈라질 위험이 0이다. **`mwFlaggedCells()`/`MW_THRESHOLD`는 되살아났다**
5. **`src/api/cells.js`에 `fetchCellDesign()`을 추가하지 않았다** — 호출부가 없는 죽은 코드. 연동 단계에서 `get('/clara/cell-design/', { pdk_id, family })` 한 줄로 추가한다
6. **mock 간 비대칭** — `cellDesignStats()`는 시드에 `pdkId`를 넣고 `libraryInfo()`는 넣지 않는다. 후자는 소비처가 없어 회귀 비교 기준을 잃지 않으려고 일부러 두었다
7. **오픈 이슈 신규 6건** — `final-report-design.md` §8 #27~#32, `library-report-family-design.md` §7 #18. 그중 **백엔드 착수 전 선결**: `rep_cell`/`bit_width` 원천 컬럼(#27), 대표 셀 마스터 여부(#28), §12 `cell_design` 제거 여부(#29)

## 14. 4차 라운드에서 닫힌 오픈 이슈

| 문서 | 항목 |
|---|---|
| `final-report-design.md` §8 | #7(`vth_all`/`nanosheet_all`), #11(대표 셀 Cell Design의 실체), #11-a(초안 스펙), #13(낡음 판정 주체), #14(family 전환 상태 누수), #18(댓글 위젯 노출 시점), #23(잠금 UI) — **7건 해결**, #22(편집 게이트)는 부분 해결 |
| `library-report-family-design.md` §7 | #11(`setFamily()` 리셋), #12(대표 셀 Cell Design의 library·PDK 의존), #17(멤버 library 칩) — **3건 해결**, #14·#16은 부분 해결 |
| `PROGRESS.md` §10-1 | 대표 셀 Cell Design 스코프 확인 `[x]`, 낡음 판정 주체 결정 `[x]` |

