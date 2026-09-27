# Final Report — 데이터 구조 설계

> 작성일: 2026-09-21 (2026-09-26 family 단위 전환 / **2026-09-26 3차 UI 포팅 반영**)
> 근거: 2026-09-17 Clara Final Report 스펙 산정 미팅 (확정 사항은 [../PROGRESS.md](../PROGRESS.md) 11장)
> 상태: 설계 초안 — 테이블/컬럼 이름은 전부 **가칭**, 백엔드 협의 후 확정
> 연계: 리포트 스코프가 (PDK, library) → (PDK, family)로 바뀐 근거는 [library-report-family-design.md](library-report-family-design.md) §5
> 대상 코드: `src/views/library-report/useReportStore.js`(상태·액션 전부) + `TabFinalReport.vue`(영역 조립·유효성 판정) + `TabLibraryInfo.vue`(리포트 소유 입력값)

---

## 0. 2026-09-26 3차 — UI 포팅이 이 설계에 준 변경

브랜치 `library-report-ui-port`에서 Library Report 화면이 외부 도구로 재작성되어 포팅됐다. 컴포넌트 구조(props + route query → `provide/inject` 중앙 스토어 `useReportStore.js`)뿐 아니라 **데이터 소유 관계와 리포트 생성 모델이 바뀌었다.** 이 문서에서 실제로 뒤집힌 것만 먼저 모아 둔다.

| # | 이전 설계 | 포팅 후 실제 코드 | 영향 절 |
|---|---|---|---|
| 1 | 리포트 전체를 한 번에 생성 (`finalReport()` 1회 → blocks 전량) | **영역(LIB/PPA/MW)별 개별 생성·재생성** (`genArea(type)`), 나머지 영역은 그대로 유지 | §2-4, §7 |
| 2 | 블록이 **library마다** 하나씩 (`fr_block.library_id` 필수, library N개면 N×3+1 블록) | **영역은 LIB/PPA/MW 3개 고정 + USER 영역 N개.** 세 영역 모두 **family 전체를 한 문단으로 집계**한다 (`buildArea()`가 family 멤버 전부를 훑는다) | §3-2, §7-2 |
| 3 | `stale`을 백엔드가 `source_saved_at` vs `source_current_at`로 계산해 내려줌 | **프론트가 로컬 signature 비교로 자체 판정** (`areaSignature` vs `area.signature`) | §2-3, §7, §8 |
| 4 | GDS version / cell design = **쿼리 집계**, release path만 사용자 입력 | **release path 행 CRUD · GDS version · GDS 설명 · library별 설명이 전부 사용자 입력**이고 리포트가 소유한다 | §3-1, §3-5 |
| 5 | Release Path 표는 `library × height` (LIBRARY 열) | **리포트 전체에 대한 편집 가능한 목록 1개.** cell height로 그룹화, 한 height에 행 N개 가능, library 축 없음 | §3-5 |
| 6 | Cell Design = library별 (drive/vth/nanosheet/cell_count) 집계 | **대표 셀(REP_CELLS) × cell height × bit-width** 뷰. mock 함수 `cellDesignByHeight(rep)`에 **library·pdk 인자가 없다** | §8 #11 |
| 7 | 댓글 = 리포트 전체 스레드 (`GET`/`POST`만) | 작성자·시각·**수정·삭제**가 있는 실제 스레드. 단 위젯은 `finalizedAt` 이후에만 노출 | §3-3, §7-7 |
| 8 | MW 블록이 `(library_id, cell_height_id, mw_type)` 참조 키로 식별 | **MW 비교 셋 구성(셋 × 테이블의 pdk/lib/height/mw_type) 자체가 리포트 소유 사용자 입력**이 되었다 | §3-1, §3-6 |
| 9 | PPA 블록 = `chart_id` 참조 | **"미리보기로 불러옴"(`ppaSetId`)과 "리포트에 연결"(`ppaLinkedId`)이 분리.** 연결된 것만 리포트 소유 | §3-6, §7-4 |

**바뀌지 않은 것**(오해 방지):

- **family 기반 스코프는 유효하다.** 스토어는 여전히 `FAMILIES`/`findFamily` 기반이고 컨텍스트는 (PDK, family) 두 축이다. `GET /clara/family/`(API.md §11)와 `GET /clara/library-info/`(§12)의 존재 이유는 그대로다. 바뀐 것은 **Library Info 탭의 화면 구성**과 **Final Report의 생성 입도**이지 family 스코프가 아니다.
- 참조형 대 스냅샷형(§2-1), 최종 저장 후 5일 유예(§5), MW 필터 규칙(§4), 원본 삭제 보호(§6), ETL MERGE 전환(§9)은 영향 없음.
- **`frSave()`/`frFinalize()`가 저장 시점에 무엇을 백엔드에 보낼지는 이전에 사용자가 명시적으로 보류시킨 이슈**다. 이번 라운드에서 재개하지 않는다 — §5-0과 §8 #12 참조.

---

## 1. 범위

Library Report 페이지의 **Final Report 탭**과, 그 탭이 소유하게 된 입력값을 mock에서 실제 영속화로 전환하기 위한 데이터 구조.

PPA / MW 두 탭은 **원본 수치 데이터의 소유자이며 이 설계의 대상이 아니다** — Final Report는 그 값을 참조만 한다. 단 두 탭에서 사용자가 만든 **구성**(PPA에서 어떤 chart를 리포트에 연결했는지, MW에서 어떤 비교 셋·테이블을 만들었는지)은 리포트 소유다.

**Library Info 탭은 더 이상 순수한 원본 소유자가 아니다.** release path 행·GDS version·GDS 설명·library별 설명이 이 탭에서 편집되고 리포트에 귀속된다(§3-5). PDK 버전 정보와 Cell Design만 조회 전용이다.

---

## 2. 핵심 설계 결정

### 2-1. 스냅샷이 아니라 참조형

Final Report는 원본 값을 복사해 보관하지 않는다. **참조 메타데이터만 저장하고, 열람할 때마다 원본을 조회해 렌더한다.**

이 테이블 그룹이 소유하는 데이터는 **AI 초안, 사람이 작성한 글, 그리고 지금까지 어디에도 저장되지 않던 사용자 입력값** 이다. MW 임계값은 DB에 두지 않고 **시스템 코드 상수**로 고정한다 — 값이 자주 바뀔 이유가 없다는 판단이라 config 테이블 없이 하드코딩으로 충분하다.

3차 포팅으로 **"사용자 입력값"의 범위가 크게 넓어졌다.** 이제 리포트가 소유하는 입력은 다음 전부다 (§3-1 / §3-5 / §3-6):

| 입력 | 소유 위치 | 편집 화면 | 이전 |
|---|---|---|---|
| release path 행 (cell height · path · gds version) | `fr_report.release_paths` | Library Info 탭 | path만 사용자 입력, gds version은 집계였다 |
| GDS version 해석 설명 (리포트당 1개) | `fr_report.gds_desc` | Library Info 탭 | 행별 `gds_desc`였다 |
| library별 설명 | `fr_report.library_desc` | Library Info 탭 | library 마스터 후보였다(§3-5) |
| 리포트에 연결한 chart | `fr_report.chart_id` | PPA 탭 | 블록의 참조 키였다 |
| MW 비교 셋 구성 | `fr_report.mw_sets` | MW 탭 | 블록의 참조 키였다 |
| 제목 · 리드 문단 | `fr_report.title` / `lead_body` | Final Report 탭 | 동일 |
| 영역 순서 · USER 영역 · 영역 본문 | `fr_block` | Final Report 탭 | 동일 |

즉 **리포트는 "세 탭을 가리키는 얇은 문서"에서 "세 탭의 사용자 입력을 담는 그릇"으로 무게가 옮겨갔다.** 참조형 원칙(수치를 복사하지 않음)은 그대로다 — 복사하지 않는 대상이 *수치*로 좁아진 것이다.

### 2-2. "최종 저장 시 고정"의 의미 = 참조 고정

참조형이므로 값은 얼릴 수 없다. 최종 저장(FINAL) 시 고정되는 것은:

- **고정됨** — 어떤 데이터를 참조할지(매핑), 사람이 쓴 글, 블록 구성과 순서
- **고정되지 않음** — 렌더되는 숫자. 원본이 바뀌면 최신 값이 보인다

확정된 리포트를 나중에 열었을 때 그때의 숫자가 그대로 보여야 하는 요구(감사 기록 성격)가 생기면, 이 설계는 성립하지 않고 스냅샷형으로 되돌려야 한다.

### 2-3. 유효성 경고 — 판정 주체가 갈렸다 (확정 — 프론트 로컬 판정)

본문이 낡는 원인이 이제 **두 갈래**다.

| 갈래 | 예 | 누가 감지할 수 있는가 |
|---|---|---|
| (i) **리포트 소유 입력의 변경** | release path 행 추가/삭제/수정, GDS 설명, library 설명, MW 셋 구성 변경, PPA 연결 변경, PDK 전환 | **프론트만.** 저장 전 브라우저 안에서만 존재하는 변경이라 백엔드는 모른다 |
| (ii) **외부 원본 데이터의 변경** | `spil_mw_fail_count` 재적재, chart meta 수정, cell design 집계 변화 | **백엔드만.** 브라우저는 다른 세션의 ETL을 알 수 없다 |

**현재 구현은 (i)만 본다.** `TabFinalReport.vue`의 `areaSignature` computed가 영역별로 입력값을 JSON 문자열로 직렬화하고, `genArea()`가 생성 시점의 그 문자열을 `area.signature`에 저장한 뒤, 렌더할 때 `stale = area.signature !== areaSignature[type]`으로 비교한다.

```
LIB  ← { pdkId, releaseRows, gdsDesc, libDesc }
PPA  ← { linked: ppaLinkedId }
MW   ← mwSets.map(s => s.tables.map({ pdkId, lib, height, mwType }))
```

즉 예전 설계(`source_saved_at` vs `source_current_at`를 백엔드가 비교해 `stale` 플래그를 내려줌)와 **판정 주체가 반대**다.

> **확정 (2026-09-27)** — **판정 주체는 프론트 로컬 signature다** (아래 (A)). 현재 구현이 이미 그 방향이므로 코드 변경은 아래 "구멍" 항목의 버그 수정 하나뿐이었다. (ii) 외부 원본 감지는 백엔드 `source_current_at`이 생기면 **가산**한다 — 그때 배지는 두 판정의 OR가 된다(아래 권고 그대로). 저장 시 signature를 `fr_block.source_signature`로 영속화하는 부분은 저장 트리거(§5-0 · §8 #12)가 보류 상태이므로 함께 보류다.

아래는 비교와 권고안이다.

#### 두 방식의 장단점

| | (A) 프론트 로컬 signature (현재) | (B) 백엔드 `stale` 플래그 (기존 설계) |
|---|---|---|
| 리포트 행이 없어도 동작 | ✅ 생성 전·저장 전에도 판정된다 | ❌ `fr_block.source_saved_at`이 있어야 비교할 것이 생긴다 |
| 사용자 입력(i) 감지 | ✅ 즉시. 저장 안 해도 배지가 바뀐다 | ❌ 저장 왕복 후에만. 편집 중에는 감지 불가 |
| 외부 원본(ii) 감지 | ❌ 불가 | ✅ 본래 목적 |
| 새로고침 내구성 | ❌ signature가 메모리에만 있어 소실 | ✅ DB에 있다 |
| 판정 규칙의 단일 출처 | ❌ 프론트/백엔드 이중 구현 위험 | ✅ 백엔드 한 곳 |
| 선결 조건 | 없음 | MW ETL의 MERGE 전환(§9) 완료 |

#### 권고 — 하이브리드, 원천에 따라 분담

원천이 갈렸으므로 판정도 갈라야 한다는 것이 이 문서의 권고다.

- **(i) 리포트 소유 입력** → **프론트 signature 유지.** 백엔드가 알 수 없는 값이므로 구조적으로 프론트밖에 할 수 없다. 저장 시에는 signature 문자열을 `fr_block.source_signature`에 함께 보내 새로고침 내구성을 얻는다. 계산 규칙(직렬화 순서)이 계약이 되므로 **백엔드는 이 문자열을 비교만 하고 재계산하지 않는다** — 이중 구현을 피하는 방법이다.
- **(ii) 외부 원본** → **백엔드 `source_current_at` 비교 유지.** GET 응답에 블록별 `source_current_at`을 실어 보내고, 프론트가 `source_saved_at`과 비교한다.
- 배지는 두 판정의 **OR**. 사용자에게는 똑같이 "유효하지 않음 · 재생성 필요"다.

> 비교는 **값**으로 한다. 설정을 바꿨다가 같은 값으로 되돌리는 경우 시각 비교는 오탐이 나지만 값 비교는 나지 않는다. signature 방식은 이 성질을 자동으로 만족한다.

#### 현재 signature 구현에서 발견된 구멍

- ~~**PPA signature에 `pdkId`가 없다.**~~ **해결 (2026-09-27)** — `PPA: JSON.stringify({ pdkId: state.pdkId, linked: state.ppaLinkedId })`로 고쳤다. PPA 표의 수치는 `ppaTable(set, state.pdkId, …)`로 PDK에 의존하는데 signature가 `{ linked }`만 보던 탓에 PDK를 바꿔도 PPA 영역이 "유효"로 남았다. 요약 문장이 chart meta만 인용하는 동안은 실질 오류가 아니었지만, 수치가 들어가는 순간 오탐이 될 자리였다.
- **`setPdk()`는 `frAreas`를 비우지 않는다**(`setFamily()`만 비운다). PDK 전환 시 LIB/MW는 signature에 `pdkId`가 들어 있어 자연히 stale이 되지만, 이는 "signature가 정확했기 때문"이지 설계된 리셋이 아니다.
- ~~**`releaseRows`/`gdsDesc`/`libDesc`가 family 전환 시에도 유지된다.**~~ **해결 (2026-09-27)** — `setFamily()`가 `releaseRows`(cell height별 빈 행으로 리셋)·`gdsDesc`·`libDesc`·`ppaSetId`·`ppaLinkedId`를 초기값으로 되돌린다. 행 id 카운터는 계속 올라가므로 새 행이 옛 행과 id를 다투지 않는다 → §8 #14 (해결). **PDK 전환 시의 리셋은 여전히 하지 않는다** — LIB/MW/PPA signature 전부에 `pdkId`가 들어 있어 영역이 stale로 표시되며, 사용자 입력을 지우는 것이 맞는지는 별개 결정이다.

#### 갱신시각의 입도 — (ii)를 채택하는 경우에만 유효

`spil_mw_meta`의 갱신시각은 **meta 행 단위**이고, MW 영역 하나가 참조하는 범위에는 이제 비교 셋 × 테이블 × 셀이 전부 들어간다. 따라서 영역의 갱신시각은 단일 값이 아니라 집합이다.

- 영역이 참조하는 모든 테이블 키로 필터한 meta 행들의 **`MAX(updated_at)`** 를 단일 값으로 압축해 `source_saved_at`에 저장한다.
- 셀이 추가되면 새 행의 시각이 최신이므로 `MAX`로 감지된다. 셀이 삭제되면 `MAX`가 안 변해 놓칠 수 있으나, **ETL이 삭제 대신 업데이트 방식으로 가므로** 행 수(count)를 별도로 저장할 필요는 없다.
- ⚠️ 영역이 family 전체를 집계하게 되면서 `MAX`의 범위가 넓어졌다 — 어느 library가 바뀌어 낡았는지는 배지로 알 수 없다. 이전 설계(블록=library)가 가졌던 staleness 입도의 이점이 사라진 것이며, 그 대가로 문서가 영역 3개로 단순해졌다.

### 2-4. 생성 모델 — 영역별 개별 생성

예전에는 "요약 생성" 1번이 리포트 전체 블록을 만들었다. 지금은 **영역마다 독립된 생성 버튼**이 있고, 한 영역을 재생성해도 다른 영역은 그대로다(`genArea(type)`가 `state.frAreas[type]`만 교체).

```
영역 상태:  empty ──(AI 초안 생성)──> generating ──> ready
              ↑                                        │
              └────────(family 변경으로 frAreas 초기화)──┘

ready 상태에서 입력이 바뀌면 stale 배지 → "다시 생성"으로 generating 재진입
```

생성 가능 조건(`areaDisabled`)이 영역별로 다르다. 이것이 API 제약이 된다(§7-3).

| 영역 | 생성 가능 조건 | 불가 시 문구 |
|---|---|---|
| `LIB` | 없음 — 항상 생성 가능 | — |
| `PPA` | `ppaLinkedId`가 있어야 한다 (미리보기만으론 불가) | 선택되지 않았습니다 — PPA 탭에서 셋을 저장하세요 |
| `MW` | 비교 셋의 테이블이 1개 이상 | 선택되지 않았습니다 — MW 탭에 테이블을 추가하세요 |

---

## 3. 테이블

Oracle 기준. 기존 CLARA 컨벤션(`<table>_id` PK, `created_at`/`created_by`, `Y`/`N` CHAR(1), FK CASCADE)을 따른다.

### 3-1. `fr_report` — 리포트 본체

```sql
report_id      NUMBER          PK
pdk_id         NUMBER          NOT NULL  FK -> pdk_version(id)
family         VARCHAR2(100)   NOT NULL  -- library.family 값. family는 마스터 테이블이 아니므로 FK 없음
title              VARCHAR2(400)   NOT NULL
lead_body          CLOB            NULL      -- 리드 문단

-- ↓ 리포트 소유 사용자 입력 (2026-09-26 3차에서 확장)
release_paths      CLOB            NULL      -- [{row_id, cell_height_id, height, path, gds_version}, ...] JSON, 배열 순서 = 표시 순서
gds_desc           CLOB            NULL      -- GDS version 해석 안내. 리포트당 1개 (행별 아님)
library_desc       CLOB            NULL      -- {"<library_id>": "설명", ...} JSON. Library Info 탭의 Library List DESCRIPTION 열
chart_id           NUMBER          NULL  FK -> chart(chart_id)  -- 리포트에 연결한 PPA 저장 셋 (ppaLinkedId)
mw_sets            CLOB            NULL      -- MW 비교 셋 구성 JSON (3-6)
input_updated_at   TIMESTAMP       NULL      -- 위 입력들의 마지막 수정 시각

status             VARCHAR2(10)    NOT NULL  -- DRAFT | FINAL
created_by     VARCHAR2(100)
created_at     TIMESTAMP
updated_by     VARCHAR2(100)
updated_at     TIMESTAMP
finalized_by   VARCHAR2(100)   NULL
finalized_at   TIMESTAMP       NULL

UNIQUE (pdk_id, family)
```

- **PDK & family 조합당 1건.** 2026-09-26 변경 — Library Report 페이지 전체가 family 단위가 되었으므로(→ [library-report-family-design.md](library-report-family-design.md) §5) 리포트 스코프도 (pdk, library) → (pdk, family)로 올라갔다. **3차 포팅도 이 스코프를 유지한다**(스토어가 계속 `findFamily` 기반).
- 재생성은 **영역 단위**다(§2-4). `report_id`를 유지한 채 블록을 전량 교체하는 모델은 더 이상 UI와 맞지 않는다.
- **사용자 입력은 전부 `fr_report`의 JSON/스칼라 컬럼에 둔다. 자식 테이블로 빼지 않는다.** 리포트가 (pdk, family)당 1건이므로 조인해서 얻을 것이 없고, 저장 단위가 "리포트 1건 통째"이기 때문이다(행 단위로 PATCH하는 UI가 없다 — release path 행 추가/삭제는 전부 로컬 배열 조작이다).
- **`release_paths` 원소에서 `library_id`가 빠졌다.** 포팅 후 Release Path 표는 library 축이 없는 리포트 전체 목록이다(§3-5). 대신 한 cell height에 행이 **여러 개** 올 수 있어 `row_id`(리포트 내 유일)가 필요하고, **배열 순서가 화면 그룹 순서**라 순서를 보존해야 한다.
- `release_updated_at` → `input_updated_at`으로 넓혔다. release path뿐 아니라 GDS 설명·library 설명·MW 셋 구성·chart 연결이 모두 같은 "리포트 소유 입력"이고, 각각에 타임스탬프를 두면 LIB 영역의 갱신시각 계산이 `MAX` 5개가 된다.
- ⚠️ **"변경점이 생기면 library가 새로 생성되므로 버전 축이 필요 없다"는 기존 근거가 family 단위에서는 성립하지 않는다.** family는 library가 추가되는 컨테이너이므로 `UNIQUE (pdk_id, family)`가 member drift와 충돌한다 — 8장 #8/#9 참조.
- ⚠️ **`chart_id`를 `fr_report`에 두면 리포트당 연결 chart가 1개로 고정된다.** 현재 UI가 정확히 그렇다(`ppaLinkedId`는 스칼라). PPA 영역을 여러 개 갖고 싶어지면 `fr_block.chart_id`로 되돌려야 한다 — §8 #15.

### 3-2. `fr_block` — 영역

```sql
block_id            NUMBER          PK
report_id           NUMBER          NOT NULL  FK -> fr_report ON DELETE CASCADE
seq                 NUMBER          NOT NULL  -- 표시 순서 (areaOrder 배열 인덱스)
block_type          VARCHAR2(20)    NOT NULL  -- LIB | PPA | MW | USER
title               VARCHAR2(400)   NULL      -- USER만 사용자 입력. LIB/PPA/MW는 프론트 상수(아래)
ai_draft            CLOB            NULL      -- AI 생성 원문 (보존, 편집하지 않음)
body                CLOB            NULL      -- 사람이 편집한 본문
points              CLOB            NULL      -- [{flag, text, value}, ...] JSON. 생성 시점 산출물 (7-9)
ai_generated_at     TIMESTAMP       NULL

-- 유효성 판정용 (2-3 — 어느 쪽을 채택하느냐에 따라 한쪽만 쓸 수도 있다)
source_signature    CLOB            NULL  -- 생성 시점 리포트 입력값 signature (프론트 계산 문자열)
source_updated_at   TIMESTAMP       NULL  -- 생성 시점 외부 원본 갱신시각 (MAX 집계)

INDEX (report_id, seq)
CHECK block_type IN ('LIB','PPA','MW','USER')
UNIQUE (report_id, block_type) WHERE block_type IN ('LIB','PPA','MW')  -- 영역 3개는 리포트당 1개씩
```

- **`library_id` / `cell_height_id` / `mw_type` / `chart_id`를 블록에서 **전부 제거**한다** (2026-09-26 3차 변경, 2차의 결정을 되돌림). 포팅 후 세 영역은 각각 **family 전체를 하나의 문단으로 집계**한다:
  - `LIB` — `libraryInfo(pdkId, family)` 전체 + 리포트 입력값. "family 내 library N종에 걸쳐 …"
  - `PPA` — 연결된 chart 1개 + family 멤버 수
  - `MW` — 비교 셋 전부를 훑어 임계값 초과 건수 합계
  
  즉 블록은 더 이상 library/height/mw_type으로 식별되는 단위가 아니다. `block_type` 하나가 곧 식별자다. 2차에서 세웠던 `CHECK (block_type IN ('LIB','MW') => library_id IS NOT NULL)` 제약은 **폐기**한다.
- **`pdk_id`는 블록에 두지 않는다.** `fr_report`가 이미 갖고 있다.
- **`ai_draft`와 `body`를 분리**한다. 영역별로 AI 초안을 재생성해도 사람이 쓴 글이 날아가지 않고, 둘을 비교해 보여줄 수도 있다. ⚠️ **현재 구현은 이 분리를 하지 않는다** — `state.frAreas[type]`에 `body` 하나만 있고 편집하면 초안이 덮어써진다. 스키마는 분리를 유지하고, 프론트가 연동 시 `ai_draft`를 별도로 보관하도록 맞춘다(§10).
- **`LIB`/`PPA`/`MW`의 `title`은 사용자 입력이 아니다.** 프론트의 `AREA_META` 상수(`Library Info 요약` / `PPA 요약` / `MW 요약`)이며 편집 UI가 없다. 저장할 필요가 없으므로 **백엔드는 이 세 타입의 `title`을 무시하거나 NULL로 둔다.** `USER` 영역만 제목이 사용자 입력이다.
- `USER` 블록은 참조 메타와 `ai_draft`/`points`가 전부 NULL이며 `title` + `body`만 갖는다.
- `(report_id, seq)`에 UNIQUE를 걸지 않는다. 드래그 재정렬 중간 상태에서 충돌한다.
- ⚠️ **영역 3개가 "없음" 상태로도 존재하는가?** 프론트에서 `frAreas[type]`이 없으면 `status: 'empty'`이고 화면에는 오버레이 카드로 자리를 차지한다. 즉 **`seq`(영역 순서)는 생성 여부와 무관하게 존재한다.** 빈 영역의 순서를 저장하려면 `body`가 NULL인 행을 만들어야 하므로, `areaOrder`를 `fr_block` 행으로 표현할지 `fr_report`에 순서 배열로 둘지 결정이 필요하다 — §8 #16.

#### block_type별 조회·판정 키

| block_type | 조회에 쓰는 키 | 유효성 비교 대상 |
|---|---|---|
| `LIB` | `report.pdk_id` + `report.family` + 리포트 입력값 전부 | `source_signature`(입력) / `source_updated_at`(cell design 집계) |
| `PPA` | `report.chart_id` | `source_signature`(연결 변경) / `source_updated_at`(chart meta) |
| `MW` | `report.pdk_id` + `report.mw_sets`가 나열하는 조합 전부 | `source_signature`(셋 구성) / `source_updated_at`(MAX fail_count 갱신) |
| `USER` | — | — (경고 없음) |

**참조 키가 블록에서 리포트로 올라갔다**는 것이 3차 변경의 핵심이다. 블록은 "무엇을 참조하는가"를 스스로 모르고, 리포트의 입력값을 읽어 집계한다.

### 3-3. `fr_comment` — 코멘트

3차 포팅으로 **진짜 댓글 스레드가 구현됐다.** 2차까지의 "삽입 가능한 단일 `user` 자유입력 블록으로 대체" 상태는 끝났다 — `USER` 영역(문서 본문의 자유 블록)과 댓글은 이제 별개 기능이다.

```sql
comment_id    NUMBER          PK
report_id     NUMBER          NOT NULL  FK -> fr_report ON DELETE CASCADE
body          VARCHAR2(4000)  NOT NULL
created_by    VARCHAR2(100)   NOT NULL
created_at    TIMESTAMP
updated_at    TIMESTAMP       NULL      -- 3차 신규: 수정 시각. 미수정이면 NULL
updated_by    VARCHAR2(100)   NULL      -- 3차 신규

INDEX (report_id, created_at)
```

- 대상은 **리포트 전체**다. 블록 단위 앵커는 현재 스펙에 없다.
- **권한 컬럼을 두지 않는다.** 작성 권한이 SPiL 전원이고, 실무자/TL 구분은 작성 내용의 성격 차이일 뿐이다. SPiL 소속 판정은 외부 시스템 연동이 필요하므로 **당분간 권한 체크 없이 전체 허용**하고 `created_by`만 기록한다.
- 유효기간이 없다. **최종 확정(FINAL) 이후에도 열람과 신규 작성이 모두 가능하다** — `fr_report.status`와 무관하게 동작한다.
- **수정·삭제가 필요해졌다** (3차). `updated_at`/`updated_by` 컬럼을 추가하고 엔드포인트 2개를 신설한다(§7-7).
  - **삭제는 hard delete**로 둔다. `removeComment(id)`가 배열에서 제거하고 목록에서 즉시 사라지며, "삭제된 댓글입니다" 자리표시자 UI가 없다. soft delete 컬럼을 두면 응답에서 걸러야 하고 그 분기를 쓸 화면이 없다.
  - 대댓글(`parent_comment_id`)은 여전히 **없다.** UI가 평면 목록이다.
  - ⚠️ **수정·삭제 권한 규칙이 미정.** 현재 UI는 `CURRENT_USER`와 무관하게 **모든 댓글에 수정/삭제 버튼을 노출한다**(로그인 시스템이 없어서 구분할 근거가 없다). 작성자 본인만 허용할지 전체 허용할지는 §8 #17.
- ⚠️ **댓글 위젯은 `finalizedAt`이 있을 때만 화면에 나타난다**(`v-if="state.finalizedAt"`). 즉 *UI 게이트*는 "최종 저장 이후"다. 백엔드 규칙(상태 무관 허용)과 다르지만 모순은 아니다 — 백엔드가 더 넓게 허용하고 프론트가 좁게 노출하는 형태다. 이 게이트가 의도된 스펙인지는 §8 #18.

### 3-4. MW 임계값 — 테이블 없음, 시스템 상수

DB config 테이블을 두지 않는다. **코드 상수로 고정**한다. MWD/MWS는 물리적으로 다른 측정이므로 상수는 `mw_type`별로 둔다 (예: 백엔드 설정에 `{MWD: 44, MWS: ...}`).

- 배포 없이 바꿀 수 있는 유연성은 포기한다 — 값이 자주 바뀔 이유가 없다는 판단.
- ⚠️ **프론트(`data.js`의 `MW_HIGH`)와 백엔드가 각자 상수를 들고 있게 된다.** 두 곳이 어긋나면 MW 탭 하이라이트와 Final Report 셀 리스트가 서로 다르게 보일 수 있다. 어느 한쪽을 단일 출처로 삼을지는 8장에 열어둔다.

### 3-5. Library Info의 원천 — 대부분이 사용자 입력으로 넘어왔다

3차 포팅으로 이 표가 크게 뒤집혔다. **GDS version이 집계 → 사용자 입력이 되었고, release path는 library 축을 잃었다.**

| 항목 | 2차까지 | **3차 (현재 코드)** | 근거 |
|---|---|---|---|
| PDK 버전 정보 (process/hspice/lvs/pex) | 조회 | **조회** (변경 없음) | `PDKS` = `GET /clara/pdk/` |
| library 목록 | 조회 | **조회** (변경 없음) | `family.libraries` = `GET /clara/family/` |
| library별 설명 | (없음 / library 마스터 후보) | **사용자 입력** → `fr_report.library_desc` | `state.libDesc[lib]` |
| release path | 사용자 입력 (`library × height` 1행) | **사용자 입력** — 리포트 전체 목록, height 그룹당 행 N개, **library 축 없음** | `state.releaseRows` |
| gds version | 쿼리 집계 | **사용자 입력** (release path 행의 열) | `releaseRows[].gds` |
| gds 설명 | 행별 `gds_desc` | **사용자 입력, 리포트당 1개** | `state.gdsDesc` |
| cell design 지원 범위 | library별 쿼리 집계 | **조회 — 단 축이 완전히 바뀜**: 대표 셀 × cell height × bit-width (§8 #11) | `cellDesignByHeight(rep)` |

#### Release Path 표의 새 구조

```
┌────────────┬──────────────────────────┬─────────────┐
│ CELL HEIGHT│ RELEASE PATH             │ GDS VERSION │   ← 편집 모드에서 행 추가/삭제
├────────────┼──────────────────────────┼─────────────┤
│            │ /proj/lib/…/r4           │ V1.0.0.0    │
│  CH120     ├──────────────────────────┼─────────────┤   ← 같은 height에 행 N개
│            │ /proj/lib/…/r3           │ V0.9.5.0    │
│            ├──────────────────────────┴─────────────┤
│            │ + 행 추가                               │
├────────────┼──────────────────────────┬─────────────┤
│  CH150     │ …                        │ …           │
└────────────┴──────────────────────────┴─────────────┘
```

- 그룹화는 **배열의 연속성**으로 한다(`releaseGroups`가 인접한 같은 `height`를 묶는다). 따라서 **배열 순서가 의미를 갖고, 저장·복원 시 순서를 보존해야 한다.**
- 행 추가는 `addReleaseRowInGroup(height)` — **기존 그룹 안에만** 추가된다. 즉 화면에 없는 cell height 그룹은 새로 만들 수 없고, 어떤 그룹의 행을 전부 삭제하면 그 height는 화면에서 사라져 되살릴 방법이 없다 → §8 #19.
- 초기 3행(`CH120`/`CH150`/`CH180`)은 `data.js`의 `HEIGHTS` 상수에서 오는 mock이다. 실 연동에서는 **`GET /clara/cell-height/`(API.md §9)로 그룹 골격을 만들어야 한다** — 이것이 위 제약의 해소책이기도 하다.
- `library_id`가 없으므로 "이 release path가 어느 library의 것인지"는 이제 데이터에 없다. family 전체에 대한 릴리스 경로 목록이라는 해석이다. **이 해석이 실제 업무와 맞는지는 기획 확인 대상** → §8 #19.

#### 파급

- **`GET /clara/library-info/`(API.md §12)의 `release_paths` 블록은 소비처를 잃었다.** Library Info 탭이 이 값을 그리지 않고 리포트 입력값을 그린다. `path`·`gds_version`의 원천 테이블(`library_release` 가칭)을 백엔드가 만들 필요가 **없어졌을 가능성이 높다** — [library-report-family-design.md](library-report-family-design.md) §7 #8이 제시한 선택지 (a)를 코드가 택한 셈이다. 확정은 기획 확인 후 → §8 #20.
- **`library_desc`를 리포트에 두면 리포트마다 같은 설명을 다시 입력한다.** 2차 설계가 "library 마스터에 두는 게 맞다"고 판단한 항목인데, 포팅된 UI는 리포트 안에서 편집한다. 지금은 **UI를 따라 `fr_report.library_desc`로 두고**, library 마스터 컬럼이 확인되면 그쪽을 기본값으로 쓰고 리포트 값을 오버라이드로 해석하는 방향을 권고한다 → §8 #21.
- `LIB` 영역의 갱신시각은 **cell design 집계 원천의 갱신시각과 `fr_report.input_updated_at` 중 `MAX`**. 사용자가 release path만 고쳐도 본문이 낡을 수 있으므로 둘 다 봐야 한다(프론트 signature 방식을 택하면 입력 쪽은 signature가 담당 — §2-3).
- ⚠️ **Library List의 DESCRIPTION 입력은 `infoEditing` 플래그와 무관하게 항상 편집 가능하다**(release path 행만 편집 모드로 게이트됨). 잠금(LOCKED) 상태에서 이 입력을 막는 처리도 현재 없다 → §8 #22.

### 3-6. PPA 연결과 MW 셋 구성 — 리포트 소유가 된 "구성"

#### PPA — 미리보기와 연결의 분리

```
PPA 탭에서 저장 셋 클릭  →  ppaSetId  (미리보기: 표를 그린다. route query `set`에 실린다)
        "리포트에 저장"  →  ppaLinkedId = ppaSetId  (리포트 소유)
```

- `ppaSetId !== ppaLinkedId`면 "이 차트는 아직 리포트에 저장되지 않았습니다" 배너가 뜨고, PPA 페이지로 이동할 때 확인 대화상자가 뜬다.
- **`fr_report.chart_id`에 저장되는 것은 `ppaLinkedId`뿐이다.** `ppaSetId`는 route query에만 있는 화면 상태이며 리포트에 속하지 않는다.
- 이 분리가 `PPA` 영역 생성 제약의 근거다 — `chart_id`가 NULL이면 생성 불가(§2-4, §7-3).

#### MW — 비교 셋 구성이 저장 대상

`fr_report.mw_sets` JSON. 프론트 `state.mwSets`의 영속 형태다.

```json
[
  { "set_seq": 0,
    "tables": [
      { "table_seq": 0, "pdk_id": 1, "library_id": 1, "cell_height_id": 1, "mw_type": "MWD" },
      { "table_seq": 1, "pdk_id": 1, "library_id": 2, "cell_height_id": 2, "mw_type": "MWD" }
    ] }
]
```

- 프론트 상태는 `{ id, open, tables: [{ id, pdkId, lib, height, mwType }] }`다. **`id`/`open`은 저장하지 않는다** — `id`는 세션 내 임시 카운터이고 `open`은 접기 상태다. 순서는 `set_seq`/`table_seq`로 보존한다.
- **`lib`(이름 문자열) → `library_id`, `height`(`"CH120"`) → `cell_height_id`로 변환해 저장한다.** 와이어에서는 FK가 정본이어야 하고, `GET /clara/mw/`(API.md §10)도 id를 받는다.
- **테이블의 `pdk_id`는 리포트의 `pdk_id`와 다를 수 있다.** MW 탭의 테이블별 PDK select가 전체 `PDKS`를 옵션으로 주므로, PDK 간 비교 테이블이 리포트에 들어갈 수 있다. 원소마다 `pdk_id`를 갖는 이유다.
- `state.picking`/`pickPdk`/`pickLib`/… 는 picker의 임시 상태이며 저장 대상이 아니다.

---

## 4. MW 필터 규칙

F.R.에 표시되는 MW는 전체 테이블이 아니라 **필터된 셀 리스트**다.

| 항목 | 규칙 | 근거 |
|---|---|---|
| slope | `ck_slope = 40` **고정** | 라이브러리 간 비교가 목적이므로 "가장 낮은 slope"로 두면 기준이 달라져 비교가 깨진다 |
| 임계값 | **시스템 상수** (`mw_type`별 고정값, 3-4 참조) | 값이 자주 바뀔 이유가 없다는 판단 — config 테이블 대신 코드 상수 |
| 셀 판정 | slope 40 아래 voltage 중 **하나라도** `fail_count >= threshold`면 리스트에 포함 | 목적이 문제 셀을 눈에 띄게 하는 것 |
| 표시 | 셀 이름 + 걸린 voltage + 값 | 셀 이름만으로는 요약의 정보량이 없다 |
| 예외 | slope 40이 없는 조합은 "해당 없음"을 명시 | `ck_slope`는 `NUMBER(3)`이라 조합마다 slope 집합이 다를 수 있다 |

임계값은 **`fail_count`(정수) 기준**이다. mock(`data.js`)이 그리는 소수점 margin 값은 실제 데이터와 무관하다.

`spil_mw_fail_count`가 `meta_id`로 `spil_mw_meta`를 참조하므로 **fail_count는 meta를 거쳐 셀 단위로 식별된다.** 셀 리스트 추출에 문제가 없다.

> ⚠️ **2026-09-26 3차 — 이 규칙은 계약으로 유효하지만 현재 프론트 mock이 따르지 않는다.** `buildArea('MW')`는 비교 셋의 모든 테이블을 훑어 `mwTable()`의 `values[].over`(= margin 값 > `MW_HIGH` 44)를 **모든 CK Slope에 걸쳐** 세어 "임계값을 초과한 셀이 N건"이라고 쓴다. 즉 (a) slope 40 고정이 아니고, (b) `fail_count`(정수)가 아니라 mock의 margin 소수값 기준이며, (c) 셀 단위가 아니라 값 단위 카운트다. `POST /clara/report/area-draft/`(§7-3)를 구현할 때 **백엔드는 이 절의 규칙을 따르고, 프론트 mock 문구가 그에 맞게 바뀐다**고 본다. 다만 "MW 요약이 셀 리스트인지 초과 건수인지"는 문구 설계 항목으로 남는다(§8 #26).

---

## 5. 상태 전이와 잠금

### 5-0. ⚠️ 저장·최종저장의 백엔드 연동 방식은 보류 이슈다

`frSave()`/`frFinalize()`가 **저장 시점에 실제로 무엇을 백엔드에 보낼지는 이전에 사용자가 명시적으로 보류시킨 이슈이며, 이번 라운드에서 결정하지 않는다.** (PUT으로 매 편집을 즉시 저장할지, 로컬에서 확인 후 최종 저장에만 POST할지 등)

현재 구현을 있는 그대로 기록하면:

```js
frSave()     { state.savedAt = Date.now(); state.savedBy = CURRENT_USER }
frFinalize() { window.confirm(요약) → savedAt/savedBy/finalizedAt = now; frEditing = false }
```

- **둘 다 네트워크 호출이 없다.** 로컬 타임스탬프와 작성자 이름만 찍는 mock이다.
- `frFinalize()`는 확인 대화상자에 `finalizeSummary`(PPA 연결 여부 · MW 셋/테이블 수 · release path 입력 행 수 · GDS 설명 작성 여부)를 보여주고 "5일 후에는 수정할 수 없습니다"를 고지한다.
- 새로고침하면 전부 소실된다. 리포트 `id`라는 개념 자체가 프론트에 없다.

따라서 §7의 API 초안은 **"무엇을 보낼 수 있어야 하는가"(payload shape)** 까지만 정의하고, **"언제 보내는가"(저장 트리거)** 는 비워 둔다. §8 #12에 보류 항목으로 남긴다.

### 5-1. 문서 상태 전이

```
DRAFT ──(최종 저장)──> FINAL ──(5일 경과)──> LOCKED
```

| 대상 | DRAFT | FINAL (유예 중) | LOCKED |
|---|---|---|---|
| `fr_block` insert/update/delete | 가능 | 가능 | 불가 |
| `fr_report.title` / `lead_body` | 가능 | 가능 | 불가 |
| **리포트 소유 입력**(release path / gds / library desc / chart 연결 / mw 셋) | 가능 | 가능 | 불가 |
| AI 초안 재생성 (영역 단위) | 가능 | 가능 | 불가 |
| `fr_comment` 열람 | 가능 | 가능 | **가능** |
| `fr_comment` 신규 작성 / 수정 / 삭제 | 가능 | 가능 | **가능** |

- **최종 저장 후 5일간 수정 가능, 이후 잠금**으로 간다. 이 정책 자체는 3차 포팅에서도 유지된다.
- `LOCKED`는 **별도 상태 컬럼이 아니다.** `finalized_at` + 서버 정책(5일)으로 판정한다. 유예 기간이 바뀌어도 마이그레이션이 없고, 리포트마다 유예가 달라야 할 때만 `editable_until` 컬럼을 추가하면 된다.
- 코멘트는 어느 상태에서도 열람·작성·수정·삭제가 가능하다. 본문 잠금과 코멘트가 별도 테이블이라 자연히 분리된다.
- **"리포트 소유 입력"이 잠금 대상에 추가됐다.** 최종 저장의 확인 문구가 "PPA 연결·MW 테이블 구성·Library Info가 모두 확정되었습니다"라고 말하는 그대로다 — 세 탭의 *구성*이 잠긴다.

### 5-2. 잠금 UI가 실제로 하는 일 (2026-09-27 구현)

잠금 판정은 스토어 한 곳에 있다 — `useReportStore.js`의 `GRACE_DAYS = 5` + `locked` computed. `Date.now()`를 그대로 쓰면 재계산되지 않으므로 **분 단위 `setInterval`로 갱신되는 `now` ref**를 기준으로 계산하고, 스토어가 속한 effect scope가 사라질 때 `onScopeDispose`로 타이머를 정리한다.

```
locked = finalizedAt !== null && now - finalizedAt > GRACE_DAYS * 86400000
graceDaysLeft = finalizedAt ? ceil((finalizedAt + GRACE_MS - now) / 86400000) : 0
```

`locked` / `graceDaysLeft`는 `provide('report')`로 네 탭에 함께 내려간다.

| 상태 | 화면 |
|---|---|
| `finalizedAt === null` (DRAFT) | 편집·저장·최종 저장 전부 가능 |
| `finalizedAt` 있고 유예 중 (`!locked`) | **편집·저장 계속 가능** (「최종 저장」만 사라진다 — 유예 시계를 다시 감지 않는다). 확정 배너에 `수정 가능 D-{graceDaysLeft}` — 하드코딩이 아니라 실제 남은 일수 |
| `locked` | Final Report 헤더가 「수정 불가」 태그로 바뀌고 영역 「다시 생성」·「AI 초안 생성」이 사라진다. Library Info 편집 버튼·library 설명 입력, MW 셋/테이블 추가·삭제·피커, PPA 「리포트에 저장」이 모두 `disabled` |

이중 방어를 둔다 — 템플릿에서 컨트롤을 `disabled`로 만들고, 스토어의 `toggleInfoEdit`/`toggleFrEdit`/`frSave`/`frFinalize`와 컴포넌트의 `generate()`도 `locked`면 즉시 반환한다. Library Info는 `editing = infoEditing && !locked` computed를 써서 **편집 중에 유예기간이 끝나도** 입력이 열린 채 남지 않게 했다.

**§5-1의 표는 여전히 백엔드 규칙이다.** 연동 시 백엔드 `403`과 짝을 맞춰야 하고, `editable_until`을 응답으로 내려주면 프론트는 `finalizedAt + GRACE_MS` 계산을 그 값으로 대체한다. `finalizedAt`이 **로컬 타임스탬프**라는 점은 이번에 바꾸지 않았다 — 저장 트리거가 보류 이슈(§5-0 · §8 #12)이기 때문이며, 새로고침하면 잠금이 사라진다.

### 5-3. 영역 상태와 문서 상태는 별개다

§2-4의 영역 상태(`empty → generating → ready`, 그리고 `stale`)는 **문서 상태(`DRAFT/FINAL/LOCKED`)와 직교한다.** 특히:

- `FINAL`인 리포트의 영역이 `stale`이 될 수 있다 — 참조형이므로 원본이 바뀌면 그렇다(§2-2). 유예 중이면 재생성으로 해소, `LOCKED`면 해소 불가하고 배지만 남는다.
- 영역 3개가 전부 `empty`인 상태로도 최종 저장이 가능하다. `frFinalize()`에 영역 생성 여부 검사가 없다. 이것이 의도인지는 §8 #24.

---

## 6. 원본 삭제 보호

참조형은 원본이 사라지면 리포트가 깨진다. 원본을 향한 FK에 **`ON DELETE CASCADE`를 걸지 않는다**(Oracle 기본 동작인 삭제 차단을 사용).

- **MW는 ETL이 삭제 대신 업데이트 방식으로 가므로** 재적재로 인한 파손 위험은 낮다. 다만 그 전환이 완료되기 전까지는 오탐·파손이 모두 발생할 수 있다.
- 리포트가 참조 중인 chart는 삭제가 막힌다. 의도된 동작이며, 막는 대신 soft delete로 갈지는 별도 결정이 필요하다.

---

## 7. API 초안 — 엔드포인트와 Response shape

기존 컨벤션을 따른다: **와이어는 snake_case**(프론트 `toCamel()` `src/api/client.js:20`이 camel로 변환), list는 페이지네이션 없이 배열, 없는 값은 `null`, 시각은 ISO8601.

| Method | 엔드포인트 | 용도 | 상태 |
|---|---|---|---|
| GET | `/clara/report/?pdk_id=&family=` | 리포트 조회 (입력값 + 영역 + staleness) | 요청 예정 |
| POST | `/clara/report/` | 리포트 생성 (빈 문서) | 요청 예정 |
| PUT | `/clara/report/<id>/` | 저장 — 입력값 + 영역 전량 | 요청 예정 · **트리거 보류**(§5-0) |
| POST | `/clara/report/<id>/finalize/` | 최종 저장 | 요청 예정 · **트리거 보류**(§5-0) |
| **POST** | **`/clara/report/area-draft/`** | **영역 AI 초안 생성 (stateless)** | **3차 신규** |
| GET | `/clara/report/<id>/comment/` | 코멘트 목록 | 요청 예정 |
| POST | `/clara/report/<id>/comment/` | 코멘트 작성 | 요청 예정 |
| **PUT** | **`/clara/report/<id>/comment/<cid>/`** | **코멘트 수정** | **3차 신규** |
| **DELETE** | **`/clara/report/<id>/comment/<cid>/`** | **코멘트 삭제** | **3차 신규** |

> **모두 백엔드에 아직 없다.** `GET /clara/report/`류는 `API.md`에 정식 등재되지 않은 초안이다(API.md §12까지가 등재분). 이 절이 백엔드에 요청할 계약의 초안이다.

네 가지 결정:

- **생성과 저장을 분리한다 (3차 신규).** 영역 AI 초안 생성은 `POST /clara/report/area-draft/` 하나로 처리하고, **리포트 행을 요구하지 않는다.** 근거는 §7-3.
- **블록 데이터는 백엔드 inline 확장을 하지 않는다 (3차 변경).** 2차 설계는 GET 응답의 블록 `data`에 원본을 조인해 실어 보냈다. 3차 포팅에서 각 탭이 자기 데이터를 스스로 조회하고 Final Report는 **그 결과를 로컬에서 집계해 문장을 만든다**(`buildArea()`가 `libraryInfo()`/`findSavedSet()`/`mwTable()`을 직접 호출). 리포트가 같은 값을 `data`로 한 번 더 받을 이유가 없다. → `blocks[].data`는 **응답에서 제거**한다(§7-2).
- **유효성 판정은 §2-3이 미결이므로 응답에 두 축을 모두 싣는다.** 블록별 `source_signature`(프론트가 저장한 문자열 되돌림)와 `source_current_at`(백엔드 계산). 프론트가 어느 쪽을 쓸지는 채택안에 따른다. 별도 `/validate/` 호출은 없다.
- 임계값 lookup 엔드포인트는 없다 — DB/config가 없으므로 내려줄 것이 없다. 프론트·백엔드가 각자 코드 상수로 맞춘다(3-4).

### 7-1. `GET /clara/report/?pdk_id=&family=`

없으면 `404`. 프론트는 이때 "새 리포트" 상태로 열고, 화면 입력은 전부 로컬에서 시작한다(현재 mock과 같은 초기 상태).

```json
{
  "report_id": 12, "pdk_id": 3,
  "family": "FAMA",
  "libraries": [ { "id": 1, "library": "LIBA" }, { "id": 2, "library": "LIBB" } ],
  "title": "[AX5] FAMA 리포트 요약",
  "lead_body": "Library Info · PPA · MW 세 탭의 값을 영역별로 요약합니다. ...",
  "status": "DRAFT",
  "finalized_at": null, "finalized_by": null,
  "locked": false, "editable_until": null,
  "created_by": "demo.user", "created_at": "2026-08-31T09:42:00",
  "updated_by": "demo.user", "updated_at": "2026-09-02T14:05:00",

  "release_paths": [
    { "row_id": 1, "cell_height_id": 1, "height": "CH120",
      "path": "/proj/lib/ch120/release/r4", "gds_version": "V1.0.0.0" },
    { "row_id": 4, "cell_height_id": 1, "height": "CH120",
      "path": "/proj/lib/ch120/release/r3", "gds_version": "V0.9.5.0" },
    { "row_id": 2, "cell_height_id": 2, "height": "CH150", "path": null, "gds_version": null }
  ],
  "gds_desc": "V1.0.0.0은 tape-out 기준 릴리스입니다.",
  "library_desc": { "1": "고밀도 표준 셀", "2": "저전력 변형" },
  "chart_id": 1,
  "mw_sets": [ /* 3-6 */ ],
  "input_updated_at": "2026-09-02T14:05:00",

  "unreported_libraries": [],
  "blocks": [ /* 7-2 */ ],
  "comment_count": 4
}
```

- `locked`: 백엔드가 `finalized_at` + 정책(5일)으로 계산한 파생 bool. **프론트에 대응 구현이 없다**(§5-2) — 연동 시 이 필드로 UI를 잠근다.
- `editable_until`: `finalized_at + 5일`. "수정 가능 D-n" 표시용(현재는 "D-5" 하드코딩). FINAL 아니면 null.
- `family` / `libraries`: 리포트의 스코프. `family`가 UNIQUE 키이고 `libraries`는 조회 시점의 family 멤버 목록이다(3-1). **family 스코프는 3차에서도 유지된다.**
- `release_paths`: **배열 순서가 화면 그룹 순서**다(§3-5). `path`/`gds_version`은 nullable — 행을 추가하고 비워 둔 상태가 정상이다.
- `library_desc`: 키가 `library_id`의 문자열 형태. 프론트 상태는 library **이름**으로 키를 잡으므로(`state.libDesc[lib]`) 변환이 필요하다 — 와이어에서 이름을 키로 쓰면 library rename에 깨지므로 id를 정본으로 둔다.
- `generated_at`을 리포트 레벨에서 **제거**했다. 생성이 영역 단위가 되어 리포트 전체의 생성 시각이라는 값이 없다 — 영역별 `ai_generated_at`이 대체한다.
- `unreported_libraries`: family 멤버 중 **리포트가 다루지 않는 library** 목록 `[{id, library}]`. ⚠️ **3차에서 판정 근거가 약해졌다** — 이전에는 "블록이 없는 library"로 정의했는데 이제 블록에 `library_id`가 없다. 백엔드가 family 멤버 목록과 리포트 생성 시점을 비교하는 정도만 가능하다 → §8 #25. 프론트는 여전히 필드만 보유하고 배너 UI를 만들지 않는다.

### 7-2. 영역 shape (`blocks[]`)

`block_type`별 참조 키와 `data`가 **사라졌다**(§3-2, §7 결정 2). 남는 것은 문서 내용과 유효성 판정 재료뿐이다.

```json
{
  "block_id": 101, "seq": 0,
  "block_type": "LIB",                      // LIB | PPA | MW | USER
  "title": null,                            // USER만 사용자 입력. LIB/PPA/MW는 프론트 상수
  "ai_draft": "PDK는 AX5 기준이며 ...",        // AI 생성 원문(보존)
  "body": "PDK는 AX5 기준이며 ...",            // 사람 편집본 (미편집 시 ai_draft와 동일)
  "points": [
    { "flag": "LIBS",   "text": "family 내 library", "value": "2종" },
    { "flag": "GDS",    "text": "GDS version V1.0.0.0 / V0.9.5.0", "value": "차이 있음" },
    { "flag": "DESIGN", "text": "Cell Height별 Drive/VTH/Nanosheet 지원 범위", "value": "3 heights" }
  ],
  "ai_generated_at": "2026-08-31T09:42:00",
  "source_signature": "{\"pdkId\":\"p1\",\"rows\":[...],\"gdsDesc\":\"\",\"libDesc\":{}}",
  "source_saved_at": "2026-08-30T...",      // 생성 시점 외부 원본 갱신시각
  "source_current_at": "2026-08-31T..."     // 현재 원본 MAX(updated_at). 다르면 낡음
}
```

- **`points`를 응답에 싣는다 (3차 변경).** 2차는 "블록 `data`에서 프론트가 파생"을 전제했는데, `data`를 없앴으므로 파생할 원천이 응답에 없다. 현재 구현도 `genArea()`가 `points`를 생성 시점에 만들어 `state.frAreas[type].points`에 **박아 둔다**(입력이 바뀌어도 재생성 전까지 옛 값이 남는다 — 그래서 stale 배지가 필요하다). 저장 대상이 맞다.
- `source_signature`는 **프론트가 만든 문자열을 백엔드가 그대로 보관·반환**한다. 백엔드는 내용을 해석하지 않는다(§2-3 권고).
- `USER` 영역은 `ai_draft`/`points`/`source_*`가 전부 `null`이고 `title`+`body`만 갖는다.
- ⚠️ `block_id`가 없는 영역이 있을 수 있다 — 프론트의 `userAreas` id는 `u-<timestamp>` 로컬 문자열이고, AI 영역은 아직 생성되지 않았으면 행이 없다(§8 #16).

### 7-3. `POST /clara/report/area-draft/` — 영역 AI 초안 생성 (3차 신규, 핵심)

**리포트 행을 요구하지 않는 stateless 생성 엔드포인트**를 권고한다.

**근거:**
1. 현재 프론트에는 리포트 `id`라는 개념이 없다. `genArea()`는 화면 상태만 읽어 초안을 만든다. `/clara/report/<id>/generate/`로 두면 **초안을 보려고 먼저 빈 리포트를 만들어야 하고**, 그 "먼저 만든다"가 곧 §5-0의 보류 이슈(저장 트리거)를 선점해 버린다.
2. 생성 대상 입력값 중 **release path·GDS 설명·library 설명·MW 셋 구성은 아직 저장되지 않은 로컬 값**일 수 있다. 서버가 DB만 보고 초안을 만들 수 없으므로 **입력을 요청 body에 담아 보내는 수밖에 없다.** 그러면 `report_id`는 어차피 필요하지 않다.
3. `PUT /clara/report/<id>/`(blocks 전량 교체)로 대체하는 것은 **맞지 않는다.** UI가 한 영역만 재생성하고 나머지는 건드리지 않으며, 생성은 700ms 스피너가 도는 **비용 있는 AI 호출**이라 저장 왕복과 수명이 다르다. 전량 교체 PUT은 "저장"의 payload로 남긴다(§7-4).

```
POST /clara/report/area-draft/
```

```json
{
  "area": "LIB",                       // LIB | PPA | MW
  "pdk_id": 3,
  "family": "FAMA",
  "report_id": 12,                      // nullable — 있으면 감사 로그용으로만 쓴다
  "inputs": {
    "release_paths": [ { "row_id": 1, "cell_height_id": 1, "path": "...", "gds_version": "V1.0.0.0" } ],
    "gds_desc": "...",
    "library_desc": { "1": "..." },
    "chart_id": 1,
    "mw_sets": [ /* 3-6 */ ]
  },
  "source_signature": "{\"pdkId\":\"p1\",...}"
}
```

응답:

```json
{
  "area": "LIB",
  "ai_draft": "PDK는 AX5 기준이며 HSPICE V1.2.0.0 / LVS ... family FAMA의 library 2종에 걸쳐 ...",
  "points": [ { "flag": "LIBS", "text": "family 내 library", "value": "2종" } ],
  "ai_generated_at": "2026-09-26T11:20:00",
  "source_signature": "{\"pdkId\":\"p1\",...}",   // 요청값 되돌림 (프론트가 area.signature에 저장)
  "source_current_at": "2026-08-30T09:00:00"     // 이 영역이 인용한 외부 원본의 MAX(updated_at)
}
```

**영역별 필수 입력과 거부 조건** (§2-4의 `areaDisabled`를 계약으로 승격):

| `area` | 필수 | 없을 때 |
|---|---|---|
| `LIB` | `pdk_id`, `family` | — (항상 생성 가능) |
| `PPA` | `inputs.chart_id` | `400 { "error": "chart_id is required for PPA area" }` |
| `MW` | `inputs.mw_sets`에 테이블 1개 이상 | `400 { "error": "mw_sets must contain at least one table" }` |

- **`PPA` 영역은 `chart_id`(= `ppaLinkedId`)가 있을 때만 생성된다.** 미리보기(`ppaSetId`)는 리포트에 속하지 않으므로 이 엔드포인트에 실리지 않는다(§3-6). 프론트가 이미 버튼을 막고 있고, 백엔드는 같은 규칙을 2차 방어로 검증한다.
- `inputs`에서 그 영역이 쓰지 않는 키는 생략 가능하다. 다만 **`source_signature`는 프론트 계산값이므로 항상 그대로 실어 보낸다** — 서버가 계산하지 않는다.
- 영역별 문구 생성에 필요한 외부 원본(cell design 집계 / chart meta / MW fail_count)은 **백엔드가 자기 DB에서 읽는다.** `inputs`에 수치를 담지 않는다.
- ⚠️ **AI 생성 로직 자체는 여전히 미구현이다**(PROGRESS.md §10-4). 현재 mock은 고정 문구 템플릿을 조립한다. 이 엔드포인트는 그 자리를 백엔드에 내주는 계약일 뿐이고, 실제 LLM 호출 설계는 별도 항목이다.

**대안 (백엔드가 stateless를 원하지 않는 경우):** `POST /clara/report/<id>/area/<AREA>/generate/`. 같은 body에서 `pdk_id`/`family`가 빠지고 경로에서 온다. 이 경로를 택하면 §5-0의 보류가 해제될 때까지 프론트가 초안을 볼 수 없으므로 **권고하지 않는다.**

### 7-4. `PUT /clara/report/<id>/` — 저장 payload (트리거는 보류)

**무엇을 보낼 수 있어야 하는가**만 정의한다. **언제 보내는가는 §5-0의 보류 이슈**다.

```json
{
  "title": "[AX5] FAMA 리포트 요약",
  "lead_body": "...",
  "release_paths": [ { "row_id": 1, "cell_height_id": 1, "path": "...", "gds_version": "..." } ],
  "gds_desc": "...",
  "library_desc": { "1": "...", "2": "..." },
  "chart_id": 1,
  "mw_sets": [ /* 3-6 */ ],
  "area_order": ["LIB", "PPA", "u-1764140000000", "MW"],
  "blocks": [
    { "block_type": "LIB", "body": "...", "ai_draft": "...", "points": [ ... ],
      "ai_generated_at": "...", "source_signature": "...", "source_saved_at": "..." },
    { "block_type": "USER", "client_key": "u-1764140000000", "title": "추가 확인 사항", "body": "..." }
  ],
  "updated_by": "demo.user"
}
```

- **전량 교체(PUT)가 맞다.** 리포트 1건이 통째로 한 화면이고, 부분 PATCH를 필요로 하는 UI가 없다.
- **`area_order`를 별도 필드로 둔다.** 드래그 재정렬 결과이며 **아직 생성되지 않은 영역(`empty`)도 순서를 갖는다.** `blocks[]`의 `seq`만으로는 행이 없는 영역의 위치를 표현할 수 없다(§8 #16). 원소는 `"LIB"|"PPA"|"MW"` 또는 USER 영역의 `client_key`.
- **`client_key`**: USER 영역은 프론트에서 `u-<timestamp>`로 생겨 `block_id`가 없다. 저장 응답에서 `client_key` → `block_id` 매핑을 돌려줘야 프론트가 재정렬 상태를 유지한다.
- 응답은 `200` + §7-1과 동일 shape. `LOCKED`면 `403`.
- ⚠️ **`ai_draft`와 `body`가 현재 프론트에서 분리되어 있지 않다**(§3-2). 연동 시 프론트가 생성 응답의 `ai_draft`를 별도로 보관해야 이 payload를 채울 수 있다.

### 7-5. `POST /clara/report/` / `POST /clara/report/<id>/finalize/`

| 엔드포인트 | Request | Response |
|---|---|---|
| `POST /clara/report/` | `{ pdk_id, family, created_by }` | `201`, §7-1 shape. **영역은 전부 비어 있다** — 생성은 §7-3이 따로 한다. 중복 시 `409` vs 기존 반환 **미확정**(§8 #4) |
| `POST /clara/report/<id>/finalize/` | `{ finalized_by }` | `200`, `status:"FINAL"` + `finalized_at`/`editable_until` 채워짐, `locked:false`(유예 중) |

- `POST /clara/report/`가 더 이상 "요약 생성"이 아니다 — **빈 문서 생성**이다. 2차에서는 이 호출 하나가 AI 블록을 전부 채웠다.
- `finalize`의 선행 조건(영역이 하나도 없어도 최종 저장 가능한지)은 §8 #24.

### 7-6. USER 영역

`title` + `body`만. `ai_draft`/`points`/`source_*` 필드 `null` 또는 미포함. 삽입 위치는 `area_order`가 갖는다.

### 7-7. 코멘트 — CRUD 4개

| 엔드포인트 | Request | Response |
|---|---|---|
| `GET /clara/report/<id>/comment/` | — | `created_at` 순 배열. 상태 무관 항상 반환 |
| `POST /clara/report/<id>/comment/` | `{ body, created_by }` | `201`, 코멘트 단건. FINAL/LOCKED에서도 허용 |
| **`PUT /clara/report/<id>/comment/<cid>/`** | `{ body, updated_by }` | `200`, 코멘트 단건(`updated_at` 채워짐). 빈 `body`는 `400` |
| **`DELETE /clara/report/<id>/comment/<cid>/`** | — | `204`. hard delete |

코멘트 원소 shape:
```json
{ "comment_id": 501, "report_id": 12, "body": "다음 개발 때 CH180 확인 필요",
  "created_by": "eng.user", "created_at": "2026-09-01T10:00:00",
  "updated_by": null, "updated_at": null }
```

- **`PUT`/`DELETE`가 3차 신규**다. 프론트에 `startEditComment`/`saveEditComment`/`removeComment`가 구현되어 있다.
- `PUT`은 **부분 수정이 없다** — 편집 UI가 본문 textarea 하나뿐이다. `body`만 받는다.
- 빈 문자열 저장은 프론트가 이미 막는다(`saveEditComment`가 `trim()` 후 빈 값이면 아무것도 하지 않는다). 백엔드도 `400`으로 막는다.
- 네 엔드포인트 모두 **`fr_report.status`와 무관하게 동작한다**(§5-1). 단 프론트는 최종 저장 이후에만 위젯을 노출한다(§3-3).
- 수정·삭제 **권한 규칙은 미정**(§8 #17). 현재 계약은 `created_by`만 기록하고 검사하지 않는 것으로 둔다.

### 7-8. 각 탭이 직접 쓰는 기존 엔드포인트

Final Report는 이제 탭 데이터를 `data`로 받지 않으므로(§7 결정 2), **각 탭이 자기 원천을 직접 조회하고 Final Report는 화면에 이미 있는 값을 집계한다.**

| 탭 | 엔드포인트 | 상태 |
|---|---|---|
| Library Info — PDK 표 | `GET /clara/pdk/` (API.md §2) | 기존 |
| Library Info — library 목록 | `GET /clara/family/` (API.md §11) | 계약 확정, 클라이언트 미작성 |
| Library Info — release path 그룹 골격 | `GET /clara/cell-height/` (API.md §9) | 기존, 클라이언트 미작성. **§3-5의 그룹 제약 해소에 필요** |
| Library Info — Cell Design | `GET /clara/cell-design/` (API.md §13) | **계약 확정 (2026-09-27)** — 대표 셀 기준, (PDK, library) 스코프. family 1건으로 소속 library 전체를 1회에 (§8 #11 / #11-a 해결). 클라이언트 미작성 |
| Library Info — 집계 | `GET /clara/library-info/` (API.md §12) | 계약 확정. ⚠️ **탭의 소비처가 사라졌다**(§3-5). 현재 유일한 소비처는 `LIB` 영역 요약의 library 수·GDS 집계 |
| PPA | `GET /clara/chart/` · `GET /clara/chart/<id>/` (API.md §8) | 기존 |
| MW | `GET /clara/mw/` (API.md §10) | 계약 확정, 클라이언트 미작성 |

### 7-9. 스키마에 반영된 / 사라진 mock 산출물

| 항목 | 2차 상태 | 3차 처리 |
|---|---|---|
| `points`(flag/text/value 요약 bullet) | 프론트 파생 전제, 저장 미정 | **저장 대상으로 확정** — `fr_block.points` (§7-2) |
| `disclaimer` | 저장 여부 미정 | **저장하지 않는다.** 프론트 고정 문구이고 편집 UI가 없다 |
| `actions`("짚어볼 지점") | 저장 여부 미정 | **UI에서 사라졌다.** 폐기 |
| `lead_body` | 저장 | **저장 유지.** 편집 가능(`draftLead`), 미편집 시 프론트 기본 문구 |
| `title` | 저장 | **저장 유지.** 편집 가능(`draftTitle`), 미편집 시 `[{process}] {family} 리포트 요약` |
| `blockSummary()` 파생 요약 | 프론트 파생 | 함수가 사라지고 `points`가 그 역할을 흡수 |

---

## 8. 미확정 / 백엔드 확인 필요

| # | 항목 | 막히는 것 |
|---|---|---|
| 1 | **MW ETL의 MERGE 전환 작업 자체** — 9장에서 방향은 정했지만 실제 구현·배포는 아직 | 전환 전까지 유효성 오탐 가능 (값이 안 바뀌어도 경고) |
| 2 | **ETL에서 사라진 조합의 처리 정책** — soft delete 컬럼을 둘지, 행을 그냥 남겨둘지 | `MAX(updated_at)` 집계 시 죽은 행이 섞여 들어갈 수 있음 |
| 3 | ~~**MW 임계값 상수의 단일 출처**~~ | **해결 (2026-09-27, #31)** — 사용자 확인: MW 탭 표의 강조도 Final Report 요약과 같은 규칙(CK Slope 40 고정 + `MW_THRESHOLD[mw_type]`)으로 통일한다. `mwTable()`의 `over` 계산이 `MW_HIGH`(전체 slope, 고정 44) 대신 `c.slope === '40%' && v > MW_THRESHOLD[mwType]`를 쓰도록 수정했다. `MW_HIGH`는 fallback 상수로만 남는다 |
| 4 | **POST 중복 시 정책** — 이미 `(pdk_id, family)` 리포트가 있을 때 `409`로 막을지 기존 반환할지 | 재생성=덮어쓰기이므로 PUT로 유도가 자연스러움 (7-7) |
| 5 | ~~`actions`·`disclaimer` 저장 여부~~ | **해결** — `actions`는 UI에서 사라져 폐기, `disclaimer`는 프론트 고정 문구로 저장하지 않는다 (7-9) |
| 6 | ~~`points` 요약 bullet 출처~~ | **해결** — `data`가 응답에서 사라졌으므로 파생 원천이 없다. `fr_block.points`로 저장한다 (7-2, 7-9) |
| 7 | ~~`vth_all`/`nanosheet_all`~~ | **해결 (2026-09-27)** — 대표 셀 뷰의 축은 [../API.md](../API.md) §13이 **응답 top-level에 싣는다**(`drive_axis`/`nanosheet_axis`/`vth_axis`). 프론트 상수(`DRIVE_AXIS`/`NS_AXIS`/`CELL_DESIGN_VTH_AXIS`)는 mock 안에만 남는다. §12의 `vth_all`/`nanosheet_all`은 그 블록이 소비처를 잃은 상태이므로 계속 미포함 — 싣기로 확정되면 §13과 같은 `*_axis` 이름으로 통일한다 → #29 |
| 8 | **family member drift — `LOCKED` 리포트의 family에 library가 추가될 때** (2026-09-26 신규) | `LOCKED`이라 편집 불가 + `UNIQUE(pdk_id, family)`로 새 리포트도 불가 → **교착**. ⚠️ **3차에서 성격이 바뀌었다** — 블록이 library별이 아니므로 "누락 library 블록 추가"라는 해소책이 성립하지 않는다. 남는 해소책은 영역 재생성 허용 또는 #9 |
| 9 | **`fr_report` UNIQUE를 `(pdk_id, family, revision)`으로 확장할지** (2026-09-26 신규) | family 단위 리포트는 library 테이블의 버저닝을 물려받지 못한다(3-1의 기존 근거가 깨짐). 지금은 컬럼을 만들지 않고 #8의 예외로 처리, 실 운영에서 재검토 |
| 10 | **library의 `family` 재분류(rename/이동) 정책** (2026-09-26 신규) | `fr_report.family`가 FK 없는 문자열이므로 family 이름이 바뀌면 기존 리포트가 고아가 된다 |

#8~#10의 상세 시나리오와 단계별 대응은 [library-report-family-design.md](library-report-family-design.md) §5-3에 있다.

### 2026-09-26 3차 (UI 포팅)에서 새로 열린 항목

| # | 항목 | 막히는 것 / 필요한 결정 |
|---|---|---|
| 11 | ~~대표 셀 기준 Cell Design의 실체~~ | **해결 (2026-09-27)** — 가설 **(b)가 확정**됐다. 대표 셀 기준 지원 범위는 **(PDK, library)별로 다르다.** mock이 library 축을 잃어버린 것이었고, 화면이 어느 library의 범위인지 말하지 않는 표시 오류였다. 신규 `GET /clara/cell-design/`([../API.md](../API.md) §13)로 분리하고 화면을 library 그룹으로 감쌌다. **남은 것은 원천 스키마** → #27 |
| 11-a | ~~위가 (b)라면 필요한 초안 스펙~~ | **해결 (2026-09-27)** — [../API.md](../API.md) §13으로 승격됐다. 초안과 달라진 점 3개: (1) drive/nanosheet를 `[{label, supported}]`가 아니라 **지원분만 담은 문자열 배열**로 둔다(축이 top-level이므로 노드마다 전체 축을 반복하지 않는다), (2) VTH 원소 키를 원천 컬럼 이름에 맞춰 `{ vth, cell_count }`로 둔다, (3) bit 노드에 `cell_count`를 추가해 프론트가 합산하지 않게 한다. 축 3개를 top-level에 둔 초안의 판단은 **그대로 채택**했다. 대표 셀 마스터 여부는 → #28 |
| 12 | **저장·최종저장의 백엔드 연동 방식** (§5-0) | **보류 — 이번 라운드에서 재개하지 않는다.** PUT으로 매 편집 즉시 저장 vs 로컬 확인 후 최종 저장에만 POST. §7-4는 payload shape까지만 정의했다 |
| 13 | ~~staleness 판정 주체~~ (§2-3) | **해결 (2026-09-27)** — **프론트 로컬 signature로 확정.** 현재 구현이 이미 그 방향이었고, 검토 중 발견된 버그(PPA signature에 `pdkId` 누락)만 고쳤다. 백엔드 `source_current_at` 비교는 (ii) 외부 원본 감지용으로 **가산**하며 배지는 두 판정의 OR가 된다. signature를 `fr_block.source_signature`로 영속화하는 부분은 저장 트리거(#12)에 묶여 함께 보류 |
| 14 | ~~family 전환 시 리포트 소유 입력이 초기화되지 않는다~~ (§2-3) | **해결 (2026-09-27)** — `setFamily()`가 `releaseRows`(cell height별 빈 행으로 리셋, id 카운터는 계속 증가)·`gdsDesc`·`libDesc`·`ppaSetId`·`ppaLinkedId`도 초기값으로 되돌린다 |
| 32 | ~~`setPdk()`가 리포트 소유 입력을 초기화하지 않는다~~ | **해결 (2026-09-27)** — 사용자 확인: PDK 전환도 Library Info의 사용자 입력(`releaseRows`/`gdsDesc`/`libDesc`)을 리셋한다. 단 `ppaSetId`/`ppaLinkedId`/`frAreas`/댓글 등 나머지 상태는 PDK 전환 시 유지한다(`setFamily()`처럼 리포트 전체를 새로 시작하지 않음) — 범위를 Library Info 입력값으로 한정한 것은 사용자의 명시적 결정 |
| 15 | **리포트당 PPA 연결이 1개로 고정된다** (§3-1) | `ppaLinkedId`가 스칼라라 `fr_report.chart_id` 단일 FK로 충분하다. PPA 영역을 여러 개(차트 여러 개) 갖고 싶어지면 `fr_block.chart_id`로 되돌려야 한다 |
| 16 | **`empty` 영역의 순서를 어디에 저장하는가** (§3-2, §7-4) | 생성되지 않은 영역도 `areaOrder`에서 자리를 갖는다. 제안: `fr_report.area_order` JSON 배열(§7-4)로 두고 `fr_block.seq`는 파생. 대안: `body`가 NULL인 placeholder 행을 만든다 |
| 17 | **댓글 수정·삭제 권한** (§3-3, §7-7) | 현재 UI는 작성자 구분 없이 모든 댓글에 수정/삭제를 노출한다(로그인 시스템 부재). 작성자 본인만 vs SPiL 전원. 전자면 프론트도 버튼 조건을 걸어야 한다 |
| 18 | ~~댓글 위젯이 최종 저장 이후에만 보이는 것이 스펙인가~~ (§3-3) | **해결 (2026-09-27)** — 스펙이 아니었다. 확정 스펙("유효기간 없음, 최종 확정 이후에도 열람 가능")은 *이후에만*을 뜻하지 않으므로 `v-if="state.finalizedAt"`를 제거해 **항상 보이게** 했다. DRAFT에서도 댓글을 쓸 수 있다 |
| 19 | **Release Path의 cell height 그룹과 library 축** (§3-5) | (a) 그룹 골격을 `GET /clara/cell-height/`로 만들어야 한다 — 현재는 그룹의 행을 전부 지우면 그 height를 되살릴 수 없다. (b) release path에 **library 축이 없어진 것이 업무상 맞는지** 기획 확인 필요 |
| 20 | **`GET /clara/library-info/`(API.md §12)의 release path·GDS 원천을 만들 필요가 있는가** (§3-5) | 3차에서 둘 다 **리포트 소유 사용자 입력**이 되었다. [library-report-family-design.md](library-report-family-design.md) §7 #8이 제시한 선택지 (a)를 코드가 택한 셈이므로, `library_release`(가칭) 마스터 테이블 신설이 불필요해질 수 있다. **백엔드 착수 전 확인 필요** — PROGRESS.md §10-1의 해당 항목과 연동 |
| 21 | **library별 설명의 소유자** (§3-5) | 리포트 소유(`fr_report.library_desc`)면 리포트마다 같은 설명을 다시 입력한다. 2차 설계는 library 마스터가 맞다고 봤다. 권고: 마스터를 기본값으로, 리포트 값을 오버라이드로 해석 |
| 22 | **Library Info의 편집 게이트 불일치** (§3-5) | **부분 해결 (2026-09-27)** — 잠금 처리는 들어갔다(`locked`면 편집 버튼·DESCRIPTION 입력이 모두 `disabled`, §5-2). 남는 것은 **`infoEditing` 게이트의 범위 불일치** 하나 — release path 행은 편집 모드에서만 열리고 library DESCRIPTION 입력은 (잠기지 않았다면) 항상 열려 있다. 어느 쪽이 맞는지는 #21(설명의 소유자)이 정해진 뒤에 결정한다 |
| 23 | ~~잠금 UI가 대부분 미구현~~ (§5-2) | **해결 (2026-09-27)** — 스토어에 `GRACE_DAYS = 5` + 분 단위 `now` ref 기반 `locked`/`graceDaysLeft` computed를 두고 네 탭에 `provide`로 내렸다. 유예 중에는 편집·저장이 계속 가능하고, `locked`면 네 탭의 편집 컨트롤이 전부 `disabled`가 된다. "D-5" 하드코딩은 실제 남은 일수로 교체. **남는 것은 백엔드 짝**: `403`과 `editable_until`, 그리고 `finalizedAt`이 로컬 타임스탬프라 새로고침하면 잠금이 풀리는 것 → 저장 트리거(#12)에 묶인다 |
| 24 | **영역이 하나도 없어도 최종 저장이 가능한가** (§5-3) | `frFinalize()`에 검사가 없다. 백엔드가 막을지, 경고만 할지 |
| 25 | **`unreported_libraries`의 판정 근거** (§7-1) | 블록에 `library_id`가 없어져 "블록이 없는 library"라는 정의가 성립하지 않는다. 백엔드가 무엇과 비교해 이 목록을 만드는지 재정의 필요 |
| 26 | **AI 초안 생성 로직 자체** (§7-3) | 엔드포인트 계약만 정의했다. 어떤 모델에 무엇을 프롬프트로 넣고 `points`를 어떻게 산출할지는 별도 설계 (PROGRESS.md §10-4) |
| 27 | **대표 셀·bit-width의 원천 컬럼** (API.md §13) | `cell_meta`에 두 개념에 대응하는 컬럼이 **없다.** §13의 쿼리는 `cell_meta.cell` 이름 규칙(`JSDFF2X` → `JSDFF` + 2bit) 파싱으로 우회했다 — 이름 규칙이 라이브러리마다 다르면 조용히 오집계된다. 정석은 ETL이 파싱 결과를 `cell_meta.rep_cell`/`bit_width`에 저장하는 것. **응답 shape은 어느 쪽이든 동일**하므로 계약 변경 없이 쿼리만 바뀐다. #20(release path 원천 미확정)과 같은 성격의 미확정이다 |
| 28 | **대표 셀 목록(`REP_CELLS`)이 마스터 데이터인가** (API.md §13) | 마스터면 (a) 표시 순서 컬럼이 생겨 §13의 "이름 오름차순" 순서 계약이 그것으로 바뀌고, (b) 라벨·설명을 응답에 실을 수 있고, (c) 지원 행이 0개인 대표 셀도 자리를 가질 수 있다(현재는 응답에서 사라진다 — top-level `rep_cell_axis` 가산 추가로 대응). 아니면 `cell_meta`의 distinct 값이며 지금 계약이 그대로 맞다 |
| 29 | **`GET /clara/library-info/`(API.md §12)의 `cell_design` 블록을 제거할지** | 대표 셀 뷰가 §13으로 분리되면서 이 블록은 **소비처가 확정적으로 없다**(Final Report `LIB` 영역 요약도 쓰지 않는다). 남기면 `drives`의 타입이 §13과 다른 상태가 지속된다([../API.md](../API.md) §13 "그 외"). 제거하려면 §12의 응답 shape 변경이므로 백엔드 합의가 필요하다 — **§13 착수 시 함께 결정.** #20(`release_paths` 제거 여부)과 같은 타이밍에 처리하는 것이 자연스럽다 |
| 30 | **Cell Design 화면의 스크롤 길이** (UX) | library 축이 생겨 카드 수가 library 배수로 늘어난다 (family 5 library × 대표 셀 4 × height 3 × bit 3 = 최대 180장). 대응 후보: library 그룹 접기, 대표 셀 탭, 지원 bit만 보기 필터. **4차 라운드에 임의로 넣지 않았다** — UX 결정 항목 |
| 31 | **MW 탭 표의 하이라이트 기준과 Final Report 요약 기준이 다르다** (2026-09-27 신규, §4 · #3) | 표는 `mwTable()`의 `over`(CK Slope 전체 × `MW_HIGH = 44` 단일 기준)로 빨갛게 칠하고, `MW` 영역 요약은 `mwFlaggedCells()`(CK Slope 40 고정 × `MW_THRESHOLD[mwType]`)로 센다. **요약을 계약(§4)에 맞춘 것이 이번 수정이고, 표를 어디에 맞출지는 결정이 필요하다** — 표가 slope 전체를 보여주는 뷰라면 두 기준이 공존하는 것이 맞을 수도 있다. 현재 mock에서는 표의 `over`가 0건이라 사용자에게 차이가 보이지 않는다 |
| 32 | **PDK 전환 시 리포트 소유 입력을 리셋할지** (2026-09-27 신규, §2-3 · #14) | `setFamily()`는 이제 전부 리셋하지만 `setPdk()`는 아무것도 리셋하지 않는다. 리포트 스코프가 (PDK, family)이므로 대칭을 맞추려면 PDK 전환도 리셋해야 하지만, release path가 PDK에 의존하는지(§8 #20의 원천 미확정과 얽힌다)가 먼저 정해져야 한다. 현재는 세 영역 signature에 `pdkId`가 있어 stale 배지로만 알린다 |

### 해결된 항목

| 항목 | 결정 |
|---|---|
| 원본 갱신시각 컬럼 | `spil_mw_meta`에 존재. 블록당 meta 행이 여러 개이므로 `MAX` 집계로 압축 (2-3) |
| ETL 재적재 방식 | 삭제가 아닌 **업데이트** 방식으로 전환 |
| `fail_count`의 의미 | 실제 API 필드(정수)가 기준. mock의 margin 값은 무시 |
| `fail_count`의 셀 단위 식별 | `meta_id` FK로 meta를 거쳐 셀 단위 식별 **가능** |
| PPA 저장 셋 | **`/clara/chart/`의 chart를 불러온다** → `chart_id` FK 성립 |
| 최종 확정 후 코멘트 작성 | **허용** |
| 최종 저장 후 5일 유예 | **유지** (이후 수정 불가) |
| SPiL 소속 판정 | 외부 시스템 연동 필요 → **당분간 전체 허용**, 템플릿 수준으로만 구성 |
| Library Info 원천 | gds version·cell design은 **쿼리 집계**, release path는 **사용자 입력** → `fr_report.release_paths`에 저장 (3-1, 3-5) |
| MW 임계값 저장 방식 | **DB 테이블 대신 시스템(코드) 상수**로 고정 — `fr_mw_threshold` 폐기 (3-4) |
| MW 갱신 감지 방식 | **ETL을 MERGE(upsert)로 전환** — 값이 바뀐 행만 갱신, `updated_at` 그대로 사용 (9장) |
| 리포트 스코프 (2026-09-26) | **(PDK, family) 당 1건** — 3차 포팅에서도 유지 |
| 영역 스코프 (2026-09-26 3차) | ~~블록을 library마다 하나씩~~ → **영역 3개(LIB/PPA/MW) 고정 + USER 영역 N개.** 세 영역 모두 family 전체를 집계한다. 2차의 `fr_block.library_id`/`cell_height_id`/`mw_type`/`chart_id`는 폐기 (3-2) |
| 영역별 생성 엔드포인트 (3차) | **`POST /clara/report/area-draft/` — stateless, 리포트 행 불필요.** `PUT`(전량 교체)로 대체하지 않는다 (7-3) |
| 블록 `data` inline 확장 (3차) | **폐기.** 각 탭이 자기 원천을 직접 조회하고 Final Report는 화면의 값을 로컬 집계한다 (7 결정 2) |
| 댓글 수정·삭제 (3차) | **필요.** `PUT`/`DELETE` 엔드포인트 신설, `updated_at`/`updated_by` 컬럼 추가, hard delete (3-3, 7-7) |
| PPA 미리보기 vs 연결 (3차) | `ppaSetId`는 화면 상태(route query), `ppaLinkedId`만 리포트 소유(`fr_report.chart_id`). **PPA 영역은 연결이 있을 때만 생성 가능** (3-6, 7-3) |
| MW 셋 구성의 소유자 (3차) | **리포트 소유 사용자 입력** → `fr_report.mw_sets` JSON (3-6) |

---

## 9. MW 갱신 감지 — ETL 전환 (확정: MERGE)

유효성 경고는 **갱신시각이 "값이 실제로 바뀐 시점"을 뜻할 때만** 동작한다. 전량 delete-insert면 값이 그대로여도 시각이 갱신되어 매번 경고가 뜨고, 그러면 사용자가 경고를 무시하게 된다.

**`meta_id`의 안정성은 요구하지 않는다.** `fr_block`은 meta를 직접 참조하지 않고 `(pdk, library, cell_height, mw_type)`로 조회하므로, 행이 통째로 교체돼도 참조는 깨지지 않는다. 즉 ETL에 거는 조건은 갱신시각의 의미 하나뿐이다.

**ETL을 MERGE(upsert) 방식으로 전환한다.** `spil_mw_meta` / `spil_mw_fail_count` 재적재 시, 기존 행과 비교해 **값이 달라진 행만 UPDATE**하고 신규 행만 INSERT한다. 이렇게 되면 `updated_at`이 "실제로 바뀐 시점"이라는 원래 의미를 갖게 되어, `fr_block.source_updated_at`을 그대로 비교 기준으로 쓸 수 있다.

- 비교 키는 `spil_mw_meta`의 자연키(`pdk_id`, `library_id`, `cell_height_id`, `cell_list`, `mw_type` 등 characterization run을 식별하는 조합)와 `spil_mw_fail_count`의 `(meta_id, ck_slope, voltage_label)`.
- `fail_count` 값이 같으면 UPDATE 자체를 스킵해 `updated_at`이 갱신되지 않게 한다(단순 upsert가 아니라 "값이 다를 때만" 갱신 — Oracle `MERGE ... WHEN MATCHED THEN UPDATE ... WHERE`로 구현 가능).
- ETL이 다루는 원천에서 사라진 조합(예: 셀 제외)의 처리 정책은 별도 확인 필요 — soft delete 컬럼을 둘지, 그냥 남겨둘지.

---

## 10. 현재 코드와의 차이

2026-09-26 3차(UI 포팅) 이후 기준.

| 항목 | 현재 코드 | 목표 |
|---|---|---|
| 데이터 소스 | `data.js` 전량 mock | 실제 API |
| 상태 보관 | `useReportStore.js`의 `reactive` 1개, `provide/inject`로 4탭 공유 | 동일 구조 유지 + API 호출 계층 추가 |
| 리포트 스코프 | (PDK, family) — `state.pdkId` + `state.familyName` | 동일 (`fr_report`의 `UNIQUE (pdk_id, family)`) |
| 리포트 `id` | **없다** — 프론트에 리포트 식별자 개념이 없다 | `report_id` (GET으로 조회, 없으면 `404` → 새 리포트) |
| 영역 | `state.frAreas` (LIB/PPA/MW) + `state.userAreas` + `state.areaOrder` | `fr_block` + `fr_report.area_order` |
| 영역 생성 | `genArea()`가 `setTimeout(700ms)` 후 로컬 템플릿 문구 조립 | `POST /clara/report/area-draft/` (§7-3) |
| `ai_draft` / `body` 분리 | **없다** — `body` 하나뿐, 편집 시 초안이 덮어써진다 | 스키마는 분리 유지. 프론트가 초안을 별도 보관해야 한다 |
| 리포트 소유 입력 | `releaseRows`/`gdsDesc`/`libDesc`/`ppaLinkedId`/`mwSets` 전부 메모리 | `fr_report`의 JSON·스칼라 컬럼 (§3-1) |
| 저장 | `frSave()`/`frFinalize()`가 **로컬 타임스탬프만** 찍는다. 네트워크 호출 없음 | **보류 이슈** (§5-0, §8 #12) |
| 코멘트 | 작성/수정/삭제 구현됨, 메모리. **위젯은 항상 노출** (2026-09-27, §8 #18) | `fr_comment` + CRUD 4개 (§7-7) |
| 유효성 체크 | 프론트 로컬 signature 비교 (PPA에 `pdkId` 포함 — 2026-09-27) | **확정 — 프론트 로컬 판정** (§2-3, §8 #13). 외부 원본 감지는 가산 |
| 잠금 | `GRACE_DAYS = 5` + 분 단위 `now` ref 기반 `locked`/`graceDaysLeft`, 네 탭 편집 컨트롤 차단 (2026-09-27, §5-2) | + 백엔드 `403`과 `editable_until`. `finalizedAt`이 로컬 타임스탬프인 점은 저장 트리거(§8 #12)에 묶여 보류 |

`useReportStore.js`의 상태 형태(영역 3개 + USER 영역 + 순서 배열 + 리포트 소유 입력 묶음)가 곧 `fr_report`/`fr_block`의 설계 근거다 — 스키마는 그 구조를 영속화로 승격한 것이다.

### 10-1. 연동 전에 정리해야 할 프론트 정합성 항목

설계 결정이 아니라 **구현 정리** 항목이라 §8과 분리한다.

- **`data.js`에 죽은 코드가 남았다.** 포팅 후 아무도 호출하지 않는다: `finalReport()`, `libBlock()`, `ppaBlock()`, `mwBlock()`, `VTH_ALL`, `NANOSHEET_ALL`, 그리고 4차에서 화면 호출부를 잃은 `cellDesignByHeight()`. `cellDesign()`/`releasePaths()`는 `libraryInfo()`를 통해서만 살아 있다. **삭제하지 않았다** — MW 임계값(§3-4)과 MW 블록 필터 규칙(§4)은 계약으로 유효하므로, 실 연동 시 어느 것이 되살아나는지 확정한 뒤 정리하는 것이 맞다.
  - **2026-09-27 변화**: `mwFlaggedCells()`/`MW_THRESHOLD`는 **더 이상 죽은 코드가 아니다** — `MW` 영역 요약이 §4 필터 규칙대로 이 둘을 호출한다(§8 #31). `cellDesignByHeight()`는 본문이 내부 함수 `cellDesignHeights(seed)` 호출 한 줄로 축소됐으므로 남겨도 `cellDesignStats()`와 로직이 갈라질 위험이 없다.
- `libraryInfo(pdkId, family)`(= `GET /clara/library-info/` mock)의 **유일한 소비처가 `LIB` 영역 요약**이다. Library Info 탭은 이 함수를 쓰지 않는다(§7-8).
- `CURRENT_USER`가 `data.js`와 `config/services.js`에 각각 하드코딩되어 있다 (PROGRESS.md §9의 기존 백로그).

---

문서 최종 수정: 2026-09-27 (4차 — Cell Design 집계 API + 낡음 판정 확정 + 잠금 구현 반영)
