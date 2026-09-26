# Final Report — 데이터 구조 설계

> 작성일: 2026-09-21 (2026-09-26 family 단위 전환 반영)
> 근거: 2026-09-17 Clara Final Report 스펙 산정 미팅 (확정 사항은 [../PROGRESS.md](../PROGRESS.md) 11장)
> 상태: 설계 초안 — 테이블/컬럼 이름은 전부 **가칭**, 백엔드 협의 후 확정
> 연계: 리포트 스코프가 (PDK, library) → (PDK, family)로 바뀐 근거는 [library-report-family-design.md](library-report-family-design.md) §5

---

## 1. 범위

Library Report 페이지의 **Final Report 탭**(`src/views/library-report/TabFinalReport.vue`)을 mock에서 실제 영속화로 전환하기 위한 데이터 구조.

Library Info / PPA / MW 세 탭은 **원본 데이터의 소유자이며 이 설계의 대상이 아니다.** Final Report는 그 셋을 참조만 한다.

---

## 2. 핵심 설계 결정

### 2-1. 스냅샷이 아니라 참조형

Final Report는 원본 값을 복사해 보관하지 않는다. **참조 메타데이터만 저장하고, 열람할 때마다 원본을 조회해 렌더한다.**

이 테이블 그룹이 소유하는 데이터는 **AI 초안, 사람이 작성한 글, 그리고 지금까지 어디에도 저장되지 않던 사용자 입력값(release path)** 이다. MW 임계값은 DB에 두지 않고 **시스템 코드 상수**로 고정한다 — 값이 자주 바뀔 이유가 없다는 판단이라 config 테이블 없이 하드코딩으로 충분하다.

### 2-2. "최종 저장 시 고정"의 의미 = 참조 고정

참조형이므로 값은 얼릴 수 없다. 최종 저장(FINAL) 시 고정되는 것은:

- **고정됨** — 어떤 데이터를 참조할지(매핑), 사람이 쓴 글, 블록 구성과 순서
- **고정되지 않음** — 렌더되는 숫자. 원본이 바뀌면 최신 값이 보인다

확정된 리포트를 나중에 열었을 때 그때의 숫자가 그대로 보여야 하는 요구(감사 기록 성격)가 생기면, 이 설계는 성립하지 않고 스냅샷형으로 되돌려야 한다.

### 2-3. 유효성 경고

참조형에서 본문이 낡는 원인은 **원본 데이터 변경**이다 → 블록에 기록해 둔 `source_updated_at`과 현재 원본 갱신시각을 비교한다.

(MW 임계값은 시스템 상수로 고정했으므로 별도 변경 감지 대상이 아니다 — slope 40과 같은 층위로 취급한다.)

경고의 의미는 "데이터가 변경됨"이 아니라 **"이 영역의 본문이 낡음"** 이다. 해소 수단은 영역별 AI 초안 재생성.

> 비교는 **값**으로 한다. 설정을 바꿨다가 같은 값으로 되돌리는 경우 시각 비교는 오탐이 나지만 값 비교는 나지 않는다.

#### 갱신시각의 입도

`spil_mw_meta`의 갱신시각은 **meta 행 단위**이고, 블록 하나가 참조하는 범위에는 셀이 여러 개 — 즉 meta 행이 여러 개 — 들어간다. 따라서 블록의 갱신시각은 단일 값이 아니라 집합이다.

- 블록 키로 필터한 meta 행들의 **`MAX(updated_at)`** 를 단일 값으로 압축해 `source_updated_at`에 저장한다.
- 셀이 추가되면 새 행의 시각이 최신이므로 `MAX`로 감지된다. 셀이 삭제되면 `MAX`가 안 변해 놓칠 수 있으나, **ETL이 삭제 대신 업데이트 방식으로 가므로** 행 수(count)를 별도로 저장할 필요는 없다.

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
release_paths      CLOB            NULL      -- [{library_id, cell_height_id, path, gds_desc}, ...] JSON, 사용자 입력
release_updated_at TIMESTAMP       NULL      -- release_paths 마지막 수정 시각
status             VARCHAR2(10)    NOT NULL  -- DRAFT | FINAL
created_by     VARCHAR2(100)
created_at     TIMESTAMP
updated_by     VARCHAR2(100)
updated_at     TIMESTAMP
finalized_by   VARCHAR2(100)   NULL
finalized_at   TIMESTAMP       NULL

UNIQUE (pdk_id, family)
```

- **PDK & family 조합당 1건.** 2026-09-26 변경 — Library Report 페이지 전체가 family 단위가 되었으므로(→ [library-report-family-design.md](library-report-family-design.md) §5) 리포트 스코프도 (pdk, library) → (pdk, family)로 올라갔다.
- 재생성은 `report_id`를 유지한 채 블록을 전량 교체한다.
- **`release_paths`는 별도 테이블로 빼지 않는다.** 리포트가 이미 (pdk, family)당 1건이라 join 없이 컬럼으로 둬도 중복 저장이 생기지 않는다. 단 family 안에 library가 N개이므로 **원소에 `library_id`가 들어간다** (3-5 참조).
- ⚠️ **"변경점이 생기면 library가 새로 생성되므로 버전 축이 필요 없다"는 기존 근거가 family 단위에서는 성립하지 않는다.** family는 library가 추가되는 컨테이너이므로 `UNIQUE (pdk_id, family)`가 member drift와 충돌한다 — 8장 #8/#9 참조.

### 3-2. `fr_block` — 영역

```sql
block_id            NUMBER          PK
report_id           NUMBER          NOT NULL  FK -> fr_report ON DELETE CASCADE
seq                 NUMBER          NOT NULL  -- 표시 순서
block_type          VARCHAR2(20)    NOT NULL  -- LIB | PPA | MW | USER
title               VARCHAR2(400)   NULL
ai_draft            CLOB            NULL      -- AI 생성 원문 (보존, 편집하지 않음)
body                CLOB            NULL      -- 사람이 편집한 본문
ai_generated_at     TIMESTAMP       NULL

-- 참조 메타 (block_type에 따라 일부만 채워짐)
chart_id            NUMBER          NULL  FK -> chart(chart_id)        -- PPA
library_id          NUMBER          NULL  FK -> library(id)            -- LIB, MW
cell_height_id      NUMBER          NULL  FK -> cell_height(id)        -- MW
mw_type             VARCHAR2(10)    NULL                               -- MW
source_updated_at   TIMESTAMP       NULL  -- 참조 시점 원본 갱신시각 (MAX 집계, 2-3 참조)

INDEX (report_id, seq)
CHECK (block_type별 필수 참조키가 채워졌는지)
CHECK block_type IN ('LIB','MW')    => library_id IS NOT NULL
      block_type IN ('PPA','USER')  => library_id IS NULL
```

- **`pdk_id`는 블록에 두지 않는다.** `fr_report`가 이미 갖고 있다.
- **`library_id`는 블록에 둔다** (2026-09-26 변경). 리포트가 family 단위가 되면서 library는 리포트가 아니라 블록의 스코프가 되었다 — `LIB`/`MW` 블록은 library 하나를 맡고, `PPA`는 family 전체(chart는 library에 종속되지 않음), `USER`는 무관하다. 블록을 library마다 하나씩 만들면 `data` 구조가 그대로 유지되고 staleness 입도도 library별로 세분화된다(근거는 [library-report-family-design.md](library-report-family-design.md) §5-1).
- **`ai_draft`와 `body`를 분리**한다. 영역별로 AI 초안을 재생성해도 사람이 쓴 글이 날아가지 않고, 둘을 비교해 보여줄 수도 있다. 현재 mockup도 같은 의도로 되어 있다(`TabFinalReport.vue:31-33`).
- `USER` 블록은 참조 메타와 `ai_draft`가 전부 NULL이며 `title` + `body`만 갖는다.
- `(report_id, seq)`에 UNIQUE를 걸지 않는다. 드래그 재정렬 중간 상태에서 충돌한다.

#### block_type별 참조 키

| block_type | 조회에 쓰는 키 | 유효성 비교 대상 |
|---|---|---|
| `LIB` | `report.pdk_id`, **`block.library_id`** | `source_updated_at` (3-5 참조) |
| `PPA` | `chart_id` | `source_updated_at` |
| `MW` | `report.pdk_id`, **`block.library_id`**, `cell_height_id`, `mw_type` | `source_updated_at` |
| `USER` | — | — (경고 없음) |

library의 출처가 `report.library_id` → `block.library_id`로 이동한 것이 2026-09-26 변경의 전부다. 조회 키 자체의 구성은 바뀌지 않았다.

### 3-3. `fr_comment` — 코멘트

```sql
comment_id    NUMBER          PK
report_id     NUMBER          NOT NULL  FK -> fr_report ON DELETE CASCADE
body          VARCHAR2(4000)  NOT NULL
created_by    VARCHAR2(100)   NOT NULL
created_at    TIMESTAMP

INDEX (report_id, created_at)
```

- 대상은 **리포트 전체**다. 블록 단위 앵커는 현재 스펙에 없다.
- **권한 컬럼을 두지 않는다.** 작성 권한이 SPiL 전원이고, 실무자/TL 구분은 작성 내용의 성격 차이일 뿐이다. SPiL 소속 판정은 외부 시스템 연동이 필요하므로 **당분간 권한 체크 없이 전체 허용**하고 `created_by`만 기록한다.
- 유효기간이 없다. **최종 확정(FINAL) 이후에도 열람과 신규 작성이 모두 가능하다** — `fr_report.status`와 무관하게 동작한다.
- 수정/삭제(`is_deleted`, `updated_at`), 대댓글(`parent_comment_id`)은 **미정이며 나중에 컬럼 추가로 흡수 가능**하므로 지금 넣지 않는다.

### 3-4. MW 임계값 — 테이블 없음, 시스템 상수

DB config 테이블을 두지 않는다. **코드 상수로 고정**한다. MWD/MWS는 물리적으로 다른 측정이므로 상수는 `mw_type`별로 둔다 (예: 백엔드 설정에 `{MWD: 44, MWS: ...}`).

- 배포 없이 바꿀 수 있는 유연성은 포기한다 — 값이 자주 바뀔 이유가 없다는 판단.
- ⚠️ **프론트(`data.js`의 `MW_HIGH`)와 백엔드가 각자 상수를 들고 있게 된다.** 두 곳이 어긋나면 MW 탭 하이라이트와 Final Report 셀 리스트가 서로 다르게 보일 수 있다. 어느 한쪽을 단일 출처로 삼을지는 8장에 열어둔다.

### 3-5. Library Info의 원천

`LIB` 블록이 참조하는 세 가지는 출처가 서로 다르다.

| 항목 | 출처 | 비고 |
|---|---|---|
| gds version | **쿼리 집계** | 저장하지 않는다 |
| cell design 지원 범위 | **쿼리 집계** | Drive Strength / VTH / Nanosheet |
| release path | **사용자 입력** | `fr_report.release_paths`(3-1)에 저장 |

release path는 지금까지 어느 백엔드 테이블에도 저장된 적 없는 값이다. 별도 테이블을 두는 대신, **리포트가 PDK & family 조합당 1건**이라는 3-1의 UNIQUE 제약을 그대로 살려 `fr_report`에 JSON 컬럼으로 둔다 — 조인할 이유가 없다. family 안의 library가 N개이므로 JSON 원소는 `(library_id, cell_height_id)`로 식별된다.

- **library 이름 convention 설명**(TODO #3의 나머지 절반)은 library 단위로 1건이라 `fr_report`(리포트별)에 두면 리포트마다 같은 내용을 다시 입력하게 된다. `library` 테이블에 실제 마스터 컬럼이 있으면 거기, 없으면 별도 검토가 필요하다 — 이건 아직 열려 있다.
- `LIB` 블록의 `source_updated_at`은 **집계 원천의 갱신시각과 `fr_report.release_updated_at` 중 `MAX`** 로 잡는다. 사용자가 release path만 고쳐도 본문이 낡을 수 있으므로 둘 다 봐야 한다.

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

---

## 5. 상태 전이와 잠금

```
DRAFT ──(최종 저장)──> FINAL ──(5일 경과)──> LOCKED
```

| 대상 | DRAFT | FINAL (유예 중) | LOCKED |
|---|---|---|---|
| `fr_block` insert/update/delete | 가능 | 가능 | 불가 |
| `fr_report.title` / `lead_body` | 가능 | 가능 | 불가 |
| AI 초안 재생성 | 가능 | 가능 | 불가 |
| `fr_comment` 열람 | 가능 | 가능 | **가능** |
| `fr_comment` 신규 작성 | 가능 | 가능 | **가능** |

- **최종 저장 후 5일간 수정 가능, 이후 잠금**으로 간다. 현재 코드(`TabFinalReport.vue:85-95`)와 동일한 동작이다.
- `LOCKED`는 **별도 상태 컬럼이 아니다.** `finalized_at` + 서버 정책(5일)으로 판정한다. 유예 기간이 바뀌어도 마이그레이션이 없고, 리포트마다 유예가 달라야 할 때만 `editable_until` 컬럼을 추가하면 된다.
- 코멘트는 어느 상태에서도 열람·작성이 가능하다. 본문 잠금과 코멘트가 별도 테이블이라 자연히 분리된다.

---

## 6. 원본 삭제 보호

참조형은 원본이 사라지면 리포트가 깨진다. 원본을 향한 FK에 **`ON DELETE CASCADE`를 걸지 않는다**(Oracle 기본 동작인 삭제 차단을 사용).

- **MW는 ETL이 삭제 대신 업데이트 방식으로 가므로** 재적재로 인한 파손 위험은 낮다. 다만 그 전환이 완료되기 전까지는 오탐·파손이 모두 발생할 수 있다.
- 리포트가 참조 중인 chart는 삭제가 막힌다. 의도된 동작이며, 막는 대신 soft delete로 갈지는 별도 결정이 필요하다.

---

## 7. API 초안 — 엔드포인트와 Response shape

기존 컨벤션을 따른다: **와이어는 snake_case**(프론트 `toCamel()` `src/api/client.js:20`이 camel로 변환), list는 페이지네이션 없이 배열, 없는 값은 `null`, 시각은 ISO8601.

| Method | 엔드포인트 | 용도 |
|---|---|---|
| GET | `/clara/report/?pdk_id=&family=` | 리포트 조회 (blocks inline 확장 + staleness 포함) |
| POST | `/clara/report/` | 생성(요약 생성) |
| PUT | `/clara/report/<id>/` | 저장 / 재생성 (blocks 전량 교체) |
| POST | `/clara/report/<id>/finalize/` | 최종 저장 |
| GET/POST | `/clara/report/<id>/comment/` | 코멘트 |

두 가지 결정:
- **블록 데이터는 백엔드 inline 확장.** 저장은 참조형(값 미복사)이나, GET 응답 시점에 백엔드가 원본(chart/mw/library 집계)을 조인해 **현재 값**을 블록 `data`에 실어 보낸다. 프론트는 추가 호출 없이 렌더.
- **유효성(본문 낡음)은 GET 응답 블록별 플래그(`stale`)로 포함.** 별도 `/validate/` 호출 없음.
- 임계값 lookup 엔드포인트는 없다 — DB/config가 없으므로 내려줄 것이 없다. 프론트·백엔드가 각자 코드 상수로 맞춘다(3-4). MW 블록 `data.threshold`에 사용값을 명시해 표시용으로만 노출.

### 7-1. `GET /clara/report/?pdk_id=&family=`

없으면 `404`(프론트는 "요약 생성" idle). 블록은 seq 순.

```json
{
  "report_id": 12, "pdk_id": 3,
  "family": "FAMA",
  "libraries": [ { "id": 1, "library": "LIBA" }, { "id": 2, "library": "LIBB" } ],
  "title": "[AX5] FAMA 리포트 요약",
  "lead_body": "Library Info · PPA · MW 세 탭에 담긴 값을 정리했습니다. family FAMA의 library 2종이 대상이며 ...",
  "status": "DRAFT",
  "generated_at": "2026-08-31T09:42:00",
  "finalized_at": null, "finalized_by": null,
  "locked": false, "editable_until": null,
  "created_by": "demo.user", "created_at": "2026-08-31T09:42:00",
  "updated_by": "demo.user", "updated_at": "2026-09-02T14:05:00",
  "release_paths": [
    { "library_id": 1, "library": "LIBA", "cell_height_id": 1, "height": "CH120",
      "path": "/proj/lib/liba/ch120/release/r4", "gds_desc": "..." }
  ],
  "release_updated_at": "2026-09-02T14:05:00",
  "unreported_libraries": [],
  "blocks": [ /* 7-2 */ ],
  "comment_count": 4
}
```

- `locked`: 백엔드가 `finalized_at` + 정책(5일)으로 계산한 파생 bool. 프론트는 그대로 사용(현재 `TabFinalReport.vue`의 로컬 계산 대체).
- `editable_until`: `finalized_at + 5일`. "수정 가능 D-n" 표시용. FINAL 아니면 null.
- `family` / `libraries`: 리포트의 스코프. `family`가 UNIQUE 키이고 `libraries`는 조회 시점의 family 멤버 목록이다(3-1).
- `unreported_libraries`: family 멤버 중 **블록이 없는 library** 목록 `[{id, library}]`. `stale`과 같은 층위의 "리포트가 낡음" 신호로, family에 library가 추가됐을 때만 채워진다(8장 #8). **프론트는 mock 단계에서 필드만 보유하고 배너 UI를 만들지 않는다** — mock이 절대 채우지 않는 값이므로.

### 7-2. 블록 shape (`blocks[]`)

공통 필드 + `block_type`별 `data` + staleness. `USER`는 `data`/staleness 없음. `library_id`는 `LIB`/`MW`에만 채워지고 `PPA`/`USER`는 `null`이다(3-2). 블록 제목도 library 스코프 블록은 library 접두를 갖는다 (`LIBA · CH120 · MWD 경고 셀`).

```json
{
  "block_id": 101, "seq": 0,
  "block_type": "LIB",                     // LIB | PPA | MW | USER
  "title": "LIBA · PDK 구성과 릴리스 경로",
  "ai_draft": "PDK는 AX5 기준이며 ...",       // AI 생성 원문(보존)
  "body": "PDK는 AX5 기준이며 ...",           // 사람 편집본 (미편집 시 ai_draft와 동일)
  "ai_generated_at": "2026-08-31T09:42:00",
  "chart_id": null, "library_id": 1, "cell_height_id": null, "mw_type": null,  // 참조키 (해당 타입만)
  "stale": false,                          // 본문 낡음 여부
  "source_saved_at": "2026-08-30T...",     // 초안 시점 원본 갱신시각
  "source_current_at": "2026-08-30T...",   // 현재 원본 MAX(updated_at). 다르면 stale=true
  "data": { /* 7-3 ~ 7-5, block_type별 */ }
}
```

### 7-3. `LIB` block `data`

`TabLibraryInfo.vue`의 세 표에 대응. gds version·cell design은 **쿼리 집계**, release는 `fr_report.release_paths` 재노출.

```json
{
  "library": "LIBA",
  "pdk": { "process": "AX5", "hspice": "V1.2.0.0", "lvs": "V1.2.0.0", "pex": "V1.2.0.0" },
  "release_paths": [
    { "cell_height_id": 1, "height": "CH120", "path": "/proj/lib/.../r4", "gds_version": "V1.0.0.0", "gds_desc": "..." }
  ],
  "cell_design": [
    { "cell_height_id": 1, "height": "CH120", "drives": "D1 D2 D3 D6 D8 D16",
      "vths": ["rvt","lvt","slvt","vlvt"], "nanosheet": ["N1","N2","N3","N5"], "cell_count": 512 }
  ],
  "vth_all": ["rvt","lvt","slvt","mvt","vlvt"],
  "nanosheet_all": ["N1","N2","N3","N4","N5"]
}
```

- `data.library` 1개가 추가된 것이 family 도입의 전부다. 나머지 shape은 그대로 — 블록이 library 하나를 맡으므로 내부 구조가 바뀔 이유가 없다.
- `gds_version` 집계값 / `gds_desc`·`path`는 사용자 입력.
- `vth_all`/`nanosheet_all`: 미지원 항목 회색 처리용 전체 축(`TabLibraryInfo.vue:58-59`). 응답에 실을지 프론트 상수로 둘지 — **미확정**(8장).

### 7-4. `PPA` block `data`

"PPA는 chart의 meta 정보"(확정). `/clara/chart/<id>/`(API.md 8장) meta 추출. 차트 rows는 PPA 탭 소유이므로 미포함.

```json
{
  "chart_id": 12, "chart_name": "hd_inv_buf_sweep", "chart_type": "bar",
  "cell_type": 1, "x_metric": "Cell", "y1_metric": "Area", "y2_metric": null,
  "cell_count": 14, "derived_count": 1,
  "saved_at": "2026-08-30T17:22:00", "owner": "demo.user",
  "libraries": ["LIBA", "LIBB"], "library_count": 2
}
```

- `libraries`/`library_count`는 **family 스코프 정보**다. chart는 library에 종속되지 않으므로 PPA 블록은 library마다 쪼개지 않고 하나로 둔다(`library_id: null`).

### 7-5. `MW` block `data`

"slope 40 포함 셀 중 특정 값 이상인 셀 리스트"(확정). 백엔드가 `/clara/mw/`(API.md 10장) 원천에서 **slope 40 고정 + `fail_count >= 시스템상수[mw_type]`** 필터.

```json
{
  "library": "LIBA",
  "cell_height_id": 1, "height": "CH120", "mw_type": "MWD",
  "threshold": 44, "slope_present": true,
  "cells": [
    { "cell_name": "INVD8", "hits": [ { "voltage_label": "0p42v", "voltage_value": 0.42, "fail_count": 51 } ] }
  ]
}
```

- `slope_present:false` + `cells:[]` → "해당 없음" 표시.
- 셀 판정 = voltage 중 하나라도 `>=` threshold, `hits`엔 초과분만.
- `data.library` 1개 추가. 한 블록 = 한 library이므로 `cells[]`의 구조와 프론트의 `blockSummary()` MW 분기는 그대로 동작한다.

### 7-6. `USER` block `data`

없음. `title` + `body`만. `ai_draft`/`data`/staleness 필드 `null` 또는 미포함.

### 7-7. 나머지 엔드포인트

| 엔드포인트 | Request | Response |
|---|---|---|
| `POST /clara/report/` | `{ pdk_id, family, created_by }` | `201`, 7-1과 동일 shape(AI 초안 블록 채워진 상태). 중복 시 `409` vs 기존 반환 **미확정** |
| `PUT /clara/report/<id>/` | `title`, `lead_body`, `release_paths`, `blocks`(seq/title/body/참조키) 전량 | `200`, 7-1 재확장 결과. LOCKED면 `403` |
| `POST /clara/report/<id>/finalize/` | `{ finalized_by }` | `200`, `status:"FINAL"` + `finalized_at`/`editable_until` 채워짐, `locked:false`(유예 중) |
| `GET /clara/report/<id>/comment/` | — | `created_at` 순 배열. 상태 무관 항상 반환 |
| `POST /clara/report/<id>/comment/` | `{ body, created_by }` | `201`, 코멘트 단건. FINAL/LOCKED에서도 허용 |

코멘트 원소 shape:
```json
{ "comment_id": 501, "report_id": 12, "body": "다음 개발 때 CH180 확인 필요",
  "created_by": "eng.user", "created_at": "2026-09-01T10:00:00" }
```

### 7-8. 확장의 원천이 되는 기존 탭 엔드포인트

LIB/PPA/MW **탭 자체**는 계속 자기 엔드포인트를 직접 호출(백엔드는 report 확장 시 내부적으로 같은 원천 조인).
- MW 탭 → `GET /clara/mw/`(flat 행, 프론트가 2단 헤더 조립, API.md 10장) — `src/api/cells.js`에 클라이언트 신규 추가 필요.
- PPA 탭 → `GET /clara/chart/<id>/`(API.md 8장, 기존).
- Library Info 집계 → 신규 쿼리(원천 테이블 미확인, 8장).

### 7-9. 스키마에 없는 mock 산출물 — 처리 미정

현재 mock(`data.js` `finalReport()`, `TabFinalReport.vue`)엔 있으나 `fr_report`/`fr_block` 스키마엔 없는 것:
- **`actions`("짚어볼 지점")·`disclaimer`** — 리포트 레벨 AI 산출물로 저장/응답할지 폐기할지 미정.
- **`points`(flag/text/value 요약 bullet)** — 위 shape는 "블록 `data`에서 프론트 파생"을 전제(TODO #6 "작게 요약 표시"와 정합). AI 생성·저장으로 갈지 미정.

---

## 8. 미확정 / 백엔드 확인 필요

| # | 항목 | 막히는 것 |
|---|---|---|
| 1 | **MW ETL의 MERGE 전환 작업 자체** — 9장에서 방향은 정했지만 실제 구현·배포는 아직 | 전환 전까지 유효성 오탐 가능 (값이 안 바뀌어도 경고) |
| 2 | **ETL에서 사라진 조합의 처리 정책** — soft delete 컬럼을 둘지, 행을 그냥 남겨둘지 | `MAX(updated_at)` 집계 시 죽은 행이 섞여 들어갈 수 있음 |
| 3 | **MW 임계값 상수의 단일 출처** — 프론트(`data.js`의 `MW_HIGH`)와 백엔드가 각자 하드코딩하면 어긋날 수 있음 | 두 값이 다르면 MW 탭 하이라이트와 Final Report 셀 리스트가 서로 다르게 보임 |
| 4 | **POST 중복 시 정책** — 이미 `(pdk_id, family)` 리포트가 있을 때 `409`로 막을지 기존 반환할지 | 재생성=덮어쓰기이므로 PUT로 유도가 자연스러움 (7-7) |
| 5 | **`actions`·`disclaimer` 저장 여부** — mock에만 있고 스키마에 없음 (7-9) | 리포트 레벨 AI 산출물로 승격할지 폐기할지 |
| 6 | **`points` 요약 bullet 출처** — 블록 `data` 프론트 파생 vs AI 생성·저장 (7-9) | 현재 shape는 프론트 파생 전제 |
| 7 | **`vth_all`/`nanosheet_all`** — 응답에 실을지 프론트 상수로 둘지 (7-3) | 미지원 항목 회색 처리용 전체 축 |
| 8 | **family member drift — `LOCKED` 리포트의 family에 library가 추가될 때** (2026-09-26 신규) | `LOCKED`이라 블록 추가 불가 + `UNIQUE(pdk_id, family)`로 새 리포트도 불가 → **교착**. 제안: 잠금 예외로 "누락 library 블록 추가"만 허용. 감지 신호로 `unreported_libraries`(7-1)는 이번 설계에 포함 |
| 9 | **`fr_report` UNIQUE를 `(pdk_id, family, revision)`으로 확장할지** (2026-09-26 신규) | family 단위 리포트는 library 테이블의 버저닝을 물려받지 못한다(3-1의 기존 근거가 깨짐). 지금은 컬럼을 만들지 않고 #8의 예외로 처리, 실 운영에서 재검토 |
| 10 | **library의 `family` 재분류(rename/이동) 정책** (2026-09-26 신규) | `fr_report.family`가 FK 없는 문자열이므로 family 이름이 바뀌면 기존 리포트가 고아가 된다 |

#8~#10의 상세 시나리오와 단계별 대응은 [library-report-family-design.md](library-report-family-design.md) §5-3에 있다.

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
| 리포트 스코프 (2026-09-26) | **(PDK, family) 당 1건.** 블록 스코프는 `LIB`/`MW` = library, `PPA` = family. "library 목록"을 `data` 안 배열로 밀어 넣지 않고 **블록을 library마다 하나씩** 만든다 |

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

| 항목 | 현재 | 목표 |
|---|---|---|
| 데이터 소스 | `data.js` 전량 mock | 실제 API |
| 리포트 스코프 | (PDK, family) — mock의 `finalReport({ pdkId, family, savedSetId })` | 동일 (`fr_report`의 `UNIQUE (pdk_id, family)`) |
| library 식별 | mock `FAMILIES`의 `{ id, library }` — id가 실재 | `library_id` (int) 그대로 |
| 블록 | 메모리 상태(`blocks[]`) | `fr_block` 영속화 |
| 저장 | 로컬 ref, 새로고침 시 소멸 | 백엔드 저장 |
| 코멘트 | 없음 | `fr_comment` |
| 유효성 체크 | 없음 | 영역별 경고 |
| 잠금 | 최종 저장 + 5일 유예 | 동일 (유지 확정) |

`blocks[]`의 구조(`kind`, `source`, `title`, `body`, `points`)와 드래그 정렬은 이미 구현되어 있으므로, `fr_block`은 그 구조를 영속화 스키마로 승격한 것이다.
