# Final Report — 데이터 구조 설계

> 작성일: 2026-09-21
> 근거: 2026-09-17 Clara Final Report 스펙 산정 미팅 (확정 사항은 [../PROGRESS.md](../PROGRESS.md) 11장)
> 상태: 설계 초안 — 테이블/컬럼 이름은 전부 **가칭**, 백엔드 협의 후 확정

---

## 1. 범위

Library Report 페이지의 **Final Report 탭**(`src/views/library-report/TabFinalReport.vue`)을 mock에서 실제 영속화로 전환하기 위한 데이터 구조.

Library Info / PPA / MW 세 탭은 **원본 데이터의 소유자이며 이 설계의 대상이 아니다.** Final Report는 그 셋을 참조만 한다.

---

## 2. 핵심 설계 결정

### 2-1. 스냅샷이 아니라 참조형

Final Report는 원본 값을 복사해 보관하지 않는다. **참조 메타데이터만 저장하고, 열람할 때마다 원본을 조회해 렌더한다.**

이 테이블 그룹이 소유하는 데이터는 **AI 초안, 사람이 작성한 글, 그리고 지금까지 어디에도 저장되지 않던 참조용 설정값**이다. `fr_mw_threshold` / `fr_lib_release`가 후자에 해당한다 — MW 탭·Library Info 탭이 이 값을 렌더에 재사용하더라도, 이 값을 처음 저장·관리하는 주체는 Final Report다.

### 2-2. "최종 저장 시 고정"의 의미 = 참조 고정

참조형이므로 값은 얼릴 수 없다. 최종 저장(FINAL) 시 고정되는 것은:

- **고정됨** — 어떤 데이터를 참조할지(매핑), 사람이 쓴 글, 블록 구성과 순서
- **고정되지 않음** — 렌더되는 숫자. 원본이 바뀌면 최신 값이 보인다

확정된 리포트를 나중에 열었을 때 그때의 숫자가 그대로 보여야 하는 요구(감사 기록 성격)가 생기면, 이 설계는 성립하지 않고 스냅샷형으로 되돌려야 한다.

### 2-3. 유효성 경고

참조형에서 본문이 낡는 원인은 두 가지이며, 둘 다 감지해야 한다.

1. **원본 데이터 변경** → 블록에 기록해 둔 `source_updated_at`과 현재 원본 갱신시각 비교
2. **MW 임계값 변경** → 블록에 기록해 둔 `threshold_at_draft`와 현재 config 값 비교

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
library_id     NUMBER          NOT NULL  FK -> library(id)
title          VARCHAR2(400)   NOT NULL
lead_body      CLOB            NULL      -- 리드 문단
status         VARCHAR2(10)    NOT NULL  -- DRAFT | FINAL
created_by     VARCHAR2(100)
created_at     TIMESTAMP
updated_by     VARCHAR2(100)
updated_at     TIMESTAMP
finalized_by   VARCHAR2(100)   NULL
finalized_at   TIMESTAMP       NULL

UNIQUE (pdk_id, library_id)
```

- **PDK & library 조합당 1건.** 변경점이 생기면 library가 새로 생성되므로 리포트에 별도 버전 축이 필요 없다 — 버저닝은 library 테이블이 이미 갖고 있다.
- 재생성은 `report_id`를 유지한 채 블록을 전량 교체한다.

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
cell_height_id      NUMBER          NULL  FK -> cell_height(id)        -- MW
mw_type             VARCHAR2(10)    NULL                               -- MW
source_updated_at   TIMESTAMP       NULL  -- 참조 시점 원본 갱신시각 (MAX 집계, 2-3 참조)
threshold_at_draft  NUMBER          NULL  -- MW 전용, 초안 시점 임계값

INDEX (report_id, seq)
CHECK (block_type별 필수 참조키가 채워졌는지)
```

- **`pdk_id` / `library_id`는 블록에 두지 않는다.** `fr_report`가 이미 갖고 있고, MW 조회에 필요한 나머지(`cell_height_id`, `mw_type`)만 블록이 가지면 조회 키가 완성된다.
- **`ai_draft`와 `body`를 분리**한다. 영역별로 AI 초안을 재생성해도 사람이 쓴 글이 날아가지 않고, 둘을 비교해 보여줄 수도 있다. 현재 mockup도 같은 의도로 되어 있다(`TabFinalReport.vue:31-33`).
- `USER` 블록은 참조 메타와 `ai_draft`가 전부 NULL이며 `title` + `body`만 갖는다.
- `(report_id, seq)`에 UNIQUE를 걸지 않는다. 드래그 재정렬 중간 상태에서 충돌한다.

#### block_type별 참조 키

| block_type | 조회에 쓰는 키 | 유효성 비교 대상 |
|---|---|---|
| `LIB` | `report.library_id` | `source_updated_at` (3-5 참조) |
| `PPA` | `chart_id` | `source_updated_at` |
| `MW` | `report.pdk_id`, `report.library_id`, `cell_height_id`, `mw_type` | `source_updated_at`, `threshold_at_draft` |
| `USER` | — | — (경고 없음) |

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

### 3-4. `fr_mw_threshold` — MW 임계값 config

```sql
mw_type     VARCHAR2(10)  PK    -- MWD | MWS
threshold   NUMBER        NOT NULL
updated_at  TIMESTAMP
updated_by  VARCHAR2(100)
```

- MWD/MWS는 물리적으로 다른 측정이므로 임계값을 공유할 이유가 없다.
- `pdk_id`는 **지금 넣지 않는다.** 요구가 없고, 넣는 순간 모든 PDK에 행을 채워야 한다. 필요해지면 복합 PK로 확장한다.
- `updated_at`은 운영 추적용이며 **유효성 판정 로직에서는 쓰지 않는다**(2-3 참조).

### 3-5. Library Info의 원천

`LIB` 블록이 참조하는 세 가지는 출처가 서로 다르다.

| 항목 | 출처 | 비고 |
|---|---|---|
| gds version | **쿼리 집계** | 저장하지 않는다 |
| cell design 지원 범위 | **쿼리 집계** | Drive Strength / VTH / Nanosheet |
| release path | **사용자 입력** | 원천 데이터가 없다 |

release path는 지금까지 어느 백엔드 테이블에도 저장된 적 없는 값이다. library 마스터 쪽에 이미 그런 테이블이 있다면 거기에 얹는 게 맞겠지만, **없으므로 이 값을 처음 저장하는 주체는 Final Report다.** `fr_` 그룹에 둔다.

```sql
fr_lib_release  (가칭)
  library_id      NUMBER          FK -> library(id)
  cell_height_id  NUMBER          FK -> cell_height(id)
  release_path    VARCHAR2(1000)  -- 사용자 입력
  gds_desc        VARCHAR2(1000)  -- 사용자 입력 (gds version 설명, 10-4 TODO #3)
  updated_at / updated_by
  PK (library_id, cell_height_id)
```

- **library 이름 convention 설명**(TODO #3의 나머지 절반)은 library 단위로 1건이라 여기 들어가지 않는다. `library` 테이블에 실제 마스터 컬럼이 있으면 거기, 없으면 `fr_library_naming`류로 별도 검토가 필요하다 — 이건 아직 열려 있다.
- `LIB` 블록의 `source_updated_at`은 **집계 원천의 갱신시각과 `fr_lib_release.updated_at` 중 `MAX`** 로 잡는다. 사용자가 release path만 고쳐도 본문이 낡을 수 있으므로 둘 다 봐야 한다.
- MW 탭·Library Info 탭이 이 값을 자기 화면에도 보여주고 싶어지면, **그쪽이 `fr_mw_threshold` / `fr_lib_release`를 참조**하면 된다. 최초 저장 주체가 바뀌는 게 아니라 소비자가 늘어나는 것뿐이라 구조에 영향이 없다.

---

## 4. MW 필터 규칙

F.R.에 표시되는 MW는 전체 테이블이 아니라 **필터된 셀 리스트**다.

| 항목 | 규칙 | 근거 |
|---|---|---|
| slope | `ck_slope = 40` **고정** | 라이브러리 간 비교가 목적이므로 "가장 낮은 slope"로 두면 기준이 달라져 비교가 깨진다 |
| 임계값 | `fr_mw_threshold`의 `mw_type`별 값 | 서버에서 배포 없이 변경 가능, 전사 통일 유지 |
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

## 7. API 초안

기존 컨벤션(flat 직렬화, 조립은 프론트)을 따른다.

| Method | 엔드포인트 | 용도 |
|---|---|---|
| GET | `/clara/report/?pdk_id=&library_id=` | 리포트 조회 (blocks 포함) |
| POST | `/clara/report/` | 생성 |
| PUT | `/clara/report/<id>/` | 저장 (blocks 전량 교체) |
| POST | `/clara/report/<id>/finalize/` | 최종 저장 |
| GET | `/clara/report/<id>/validate/` | 영역별 유효성 체크 |
| GET/POST | `/clara/report/<id>/comment/` | 코멘트 |
| GET | `/clara/mw/threshold/` | 임계값 lookup |

- `/clara/mw/threshold/`를 **별도 엔드포인트로 분리**한다. 기존 `/clara/mw/` 응답은 순수 배열이라, 여기에 임계값을 끼워 넣으면 `{threshold, rows}` 객체로 바뀌는 breaking change가 된다. 분리하면 `/clara/cell-height/`, `/clara/metric/`과 같은 lookup 성격이 되어 앱 초기화 때 1회 로드 후 캐시할 수 있다.

---

## 8. 미확정 / 백엔드 확인 필요

| # | 항목 | 막히는 것 |
|---|---|---|
| 1 | **MW ETL의 MERGE 전환 작업 자체** — 9장에서 방향은 정했지만 실제 구현·배포는 아직 | 전환 전까지 유효성 오탐 가능 (값이 안 바뀌어도 경고) |
| 2 | **ETL에서 사라진 조합의 처리 정책** — soft delete 컬럼을 둘지, 행을 그냥 남겨둘지 | `MAX(updated_at)` 집계 시 죽은 행이 섞여 들어갈 수 있음 |

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
| Library Info 원천 | gds version·cell design은 **쿼리 집계**, release path는 **사용자 입력** → `fr_lib_release`에 저장 (3-5) |
| MW 갱신 감지 방식 | **ETL을 MERGE(upsert)로 전환** — 값이 바뀐 행만 갱신, `updated_at` 그대로 사용 (9장) |

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
| library 식별 | 이름 문자열(`'LIBA'`) | `library_id` (int) |
| 블록 | 메모리 상태(`blocks[]`) | `fr_block` 영속화 |
| 저장 | 로컬 ref, 새로고침 시 소멸 | 백엔드 저장 |
| 코멘트 | 없음 | `fr_comment` |
| 유효성 체크 | 없음 | 영역별 경고 |
| 잠금 | 최종 저장 + 5일 유예 | 동일 (유지 확정) |

`blocks[]`의 구조(`kind`, `source`, `title`, `body`, `points`)와 드래그 정렬은 이미 구현되어 있으므로, `fr_block`은 그 구조를 영속화 스키마로 승격한 것이다.
