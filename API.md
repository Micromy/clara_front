# CLARA Backend API Spec

> Cell Library AI Reasoning Assistant — REST API
> Base URL: `http://<host>:<port>/clara/`
> 모든 응답: `Content-Type: application/json`
> 작성일: 2026-05-08

---

## 목차

1. [공통 사항](#공통-사항)
2. [Cell Meta](#1-cell-meta)
3. [PDK Version](#2-pdk-version)
4. [Library](#3-library)
5. [FF Cell Data](#4-ff-cell-data)
6. [ICG Cell Data](#5-icg-cell-data)
7. [Chart Metric](#6-chart-metric)
8. [Chart Preset](#7-chart-preset)
9. [Chart](#8-chart)
10. [Cell Height](#9-cell-height)
11. [MW Table](#10-mw-table)
12. [Family](#11-family)
13. [Library Info 집계](#12-library-info-집계)
14. [Cell Design 집계](#13-cell-design-집계)
15. [에러 응답 형식](#에러-응답-형식)
16. [데이터 모델 관계](#데이터-모델-관계)

---

## 공통 사항

### 응답 코드

| 코드 | 의미 |
|------|------|
| 200 | 정상 (GET) |
| 201 | 정상 생성됨 (POST) |
| 204 | 정상 삭제됨 (DELETE, 본문 없음) |
| 400 | 요청 형식 오류 / 필수 파라미터 누락 |
| 404 | 리소스 없음 |
| 500 | 서버 오류 |

### 페이지네이션
현재 모든 list 엔드포인트는 페이지네이션 **없음**. 응답이 곧 전체 데이터.

### 인증
현재 엔드포인트들은 익명 접근 가능. 추후 인증/권한 추가 예정.

### 멀티값 쿼리 파라미터
콤마 구분 — `?cell_id=1,2,3` 형태.

---

## 1. Cell Meta

셀의 메타데이터(이름, PDK, 라이브러리, 동작 조건 등)를 조회합니다.

### `GET /clara/meta/`

#### Query Parameters
| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `lib_id` | int (multi) | - | 라이브러리 ID 필터 (예: `?lib_id=1,3`) |
| `cell_type` | string | - | 셀 타입 (`FF`, `ICG`) |
| `pdk_id` | int | - | PDK ID 필터 |

#### Response 예시
```json
[
  {
    "id": 101,
    "cell_type": "FF",
    "pdk_id": 5,
    "pdk": "N5_v1.2",
    "cell_name": "DFFRPQ_X1N_A12P5PP84_LVT_C40",
    "cell": "DFFRPQ",
    "version": "v1.2",
    "drive_strength": "X1",
    "nanosheet": "N3",
    "gate_length": "16",
    "cell_height": "12T",
    "cpp": "84",
    "feol": "FEOL_v3",
    "beol": "BEOL_v2",
    "gds_overlay": "OL01",
    "lib_id": 1,
    "lib": "stdcell_v1",
    "vth": "LVT",
    "vdd": "0.75",
    "temperature": 25,
    "charac_tool": "HSPICE"
  }
]
```

---

## 2. PDK Version

사용 가능한 PDK 버전 목록.

### `GET /clara/pdk/`

#### Response 예시
```json
[
  {
    "id": 5,
    "process": "N5",
    "hspice": "2024.06",
    "lvs": "C-2024.03",
    "pex": "C-2024.03",
    "created_at": "2026-01-15T10:00:00",
    "created_by": "admin"
  }
]
```

---

## 3. Library

라이브러리 목록.

> 📌 family 단위 그룹 목록은 [11. Family](#11-family) 참조. 이 엔드포인트의 응답 스키마는 family 도입 후에도 변경되지 않는다.

### `GET /clara/lib/`

#### Response 예시
```json
[
  { "id": 1, "library": "stdcell_v1" },
  { "id": 2, "library": "stdcell_v2" }
]
```

---

## 4. FF Cell Data

FF 셀의 시뮬레이션 결과 데이터 조회.

### `GET /clara/cell/ff/?cell_id=<ids>`

> ⚠️ **`cell_id` 필수.** 누락 시 400.
> 결과 비어있으면 404.

#### Query Parameters
| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `cell_id` | int (multi) | ✅ | 콤마 구분 (예: `?cell_id=1,2,3`) |

#### Response 예시
```json
[
  {
    "cell_id": 101,
    "dq_wst": 152,
    "dq_avg": 140,
    "area": 252,
    "ck_cap": 18,
    "p_leakage": 5,
    "pdyn": 80,
    "cq_delay_avg": 60,
    "dsetup_3sigma_avg": 30,
    "dhold_sohm_avg": 12,
    "pdp_avg": 11200,
    "created_at": "2026-04-01T12:00:00",
    "created_by": "sh0913.park"
  }
]
```

#### Error Response
```json
// 400 — cell_id 누락
{ "error": "cell_id parameter is required" }

// 404 — 데이터 없음
{ "error": "No data found for selected rows" }
```

### `GET /clara/cell/ff/<id>/`
단건 조회. `id`는 `cell_id`.

---

## 5. ICG Cell Data

ICG 셀의 시뮬레이션 결과 데이터 조회. 구조는 [FF Cell](#4-ff-cell-data)와 동일하나 일부 컬럼이 다름.

### `GET /clara/cell/icg/?cell_id=<ids>`

#### Response 예시
```json
[
  {
    "cell_id": 201,
    "eeck_wst": 145,
    "eeck_avg": 130,
    "area": 240,
    "ck_cap": 17,
    "p_leakage": 4,
    "pdyn": 70,
    "cq_delay_avg": 55,
    "esetup_3sigma_avg": 28,
    "ehold_sohm_avg": 11,
    "pdp_avg": 9100,
    "delay_tran_rf_ratio": 95,
    "created_at": "2026-04-01T12:00:00",
    "created_by": "sh0913.park"
  }
]
```

### `GET /clara/cell/icg/<id>/`
단건 조회.

---

## 6. Chart Metric

차트의 축으로 사용할 수 있는 metric(지표) 목록. 사용자가 정의한 derived formula 포함.

### `GET /clara/metric/`

#### Response 예시
```json
[
  {
    "metric_id": 1,
    "name": "PDP",
    "cell_type": "FF",
    "formula_type": "binary",
    "op": "*",
    "field1": "p_leakage",
    "field2": "dq_avg",
    "description": "Power-Delay Product",
    "created_at": "2026-03-15T10:00:00",
    "created_by": "admin"
  }
]
```

#### 필드 설명
| 필드 | 의미 |
|------|------|
| `formula_type` | `binary` (이항), `unary` (단항), `mean`, `std`, `normalize`, `relative` 등 |
| `op` | binary일 때 연산자 (`+`, `-`, `*`, `/`) |
| `field1`, `field2` | 피연산자 (셀 컬럼 이름) |

---

## 7. Chart Preset

차트 설정 저장. 사용자가 만들어둔 축 조합을 빠르게 재사용하기 위한 것.

> 📌 **숨김 preset 정책.**
> Chart 저장 시 자동 생성되는 **전용 preset은 `is_visible='N'`** 으로 저장되어 list에서 제외됨.
> 사용자가 명시적으로 저장한 preset만 `is_visible='Y'`로 list에 보임.

### `GET /clara/preset/` (List)

`is_visible='Y'`인 preset만 반환.

#### Response 예시
```json
[
  {
    "preset_id": 12,
    "name": "FF PDP vs Area",
    "cell_type": 1,
    "chart_type": "scatter",
    "x_metric": 1,
    "y1_metric": 2,
    "y2_metric": null,
    "group_by": "drive_strength,__tag__",
    "is_visible": "Y",
    "created_at": "2026-04-20T15:30:00",
    "created_by": "sh0913.park"
  }
]
```

#### 필드 설명
| 필드 | 타입 | 설명 |
|------|------|------|
| `cell_type` | int | cellTypes 매핑의 id (`GET /clara/cell/type`) |
| `chart_type` | string | `scatter`, `line`, `bar` |
| `x_metric` | int | scatter/line: metric_id, bar: cellType별 group placeholder metric의 id |
| `y1_metric` | int | metric_id |
| `y2_metric` | int / null | secondary y축, 없으면 null |
| `group_by` | string | Group 템플릿 CSV — 아래 [Group 템플릿 인코딩](#group-템플릿-인코딩) 참조 |
| `is_visible` | `'Y'` / `'N'` | preset list 노출 여부 |

#### Group 템플릿 인코딩

`group_by`는 사용자가 정의한 Group 템플릿 토큰을 콤마로 구분한 문자열.

| 토큰 종류 | 인코딩 | 예시 |
|-----------|--------|------|
| 필드 참조 | 셀 메타 필드명 | `drive_strength`, `library`, `vth` |
| Per-cell tag | 센티넬 `__tag__` | `__tag__` |

**예시:**
- `""` (빈 문자열): 템플릿 없음 — 모든 셀이 한 그룹
- `"drive_strength"`: drive_strength로 그룹화
- `"drive_strength,nanosheet"`: drive_strength + nanosheet 조합
- `"drive_strength,__tag__"`: drive_strength + per-cell tag 조합 (예: `X1_fast`, `X2_slow`)

**컬럼 권장 길이:** `VARCHAR2(255)` — 현실적 최대 토큰 조합(약 200자)에 여유.

#### Bar 차트의 `x_metric` — Group Placeholder Metric

`x_metric`은 FK라 null/누락 불가. Bar 차트는 X축이 Group 템플릿으로 결정되므로 실제 metric을 가리킬 수 없는데, 백엔드에서 cellType별로 **placeholder metric row를 만들어** 그것의 id를 가리키게 함.

**Placeholder metric 식별 속성** (예시):
- `formula_type`: `'raw'`
- `field1`, `field2`, `op`: `'NONE'`
- `name`: 임의 (예: `'groupFf'`, `'groupIcg'`)
- `cell_type`: 각 cellType id

프론트엔드는 metric 응답을 받아서 `formula_type === 'raw'` AND `field1 == null` (정규화 후) 조건으로 자동 lookup해서 사용. id 하드코딩 X.

이 placeholder들은 사용자 metric dropdown에는 노출되지 않음 (필터됨).

### `GET /clara/preset/<id>/` (Retrieve)

단건 조회. `is_visible` 무관.

### `POST /clara/preset/` (Create)

#### Request Body
```json
{
  "name": "FF PDP vs Area",
  "cell_type": 1,
  "chart_type": "scatter",
  "x_metric": 1,
  "y1_metric": 2,
  "y2_metric": null,
  "group_by": "drive_strength,__tag__",
  "created_by": "sh0913.park"
}
```

#### 필드 정책
| 필드 | 입력 | 비고 |
|------|------|------|
| `preset_id` | ❌ | 자동 채번 |
| `name` | ✅ 필수 | |
| `cell_type` | ✅ 필수 | cellTypes 매핑의 id |
| `chart_type` | ✅ 필수 | `scatter` / `line` / `bar` |
| `x_metric` | ✅ 필수 | scatter/line: metric_id, bar: group placeholder metric id (아래 참조) |
| `y1_metric` | ✅ 필수 | metric_id |
| `y2_metric` | nullable | 미사용 시 null |
| `group_by` | nullable | Group 템플릿 CSV. 빈 문자열 또는 `null` 허용 |
| `is_visible` | 선택 | 기본값 `'Y'` |
| `created_by` | 선택 | 기본값 `''` |
| `created_at` | ❌ | 자동 |

#### Response — 201
요청 본문 + 자동 생성 필드 반환.

### `DELETE /clara/preset/<id>/`

#### Response
- 204 No Content

---

## 8. Chart

저장된 차트(빌더 상태 전체). preset + 셀 tag 목록을 묶어서 저장.

> 📌 **자동 preset 생성/삭제.**
> - **POST 시**: chart 전용 preset이 함께 생성되어 `is_visible='N'`으로 저장됨. (요청에서 `is_visible`을 보내도 무시됨)
> - **DELETE 시**: chart, 연결된 전용 preset, 자식 items가 모두 한 트랜잭션으로 삭제됨.

### `GET /clara/chart/` (List)

#### Response 예시
```json
[
  {
    "chart_id": 12,
    "chart_name": "FF Comparison Q2",
    "preset": {
      "preset_id": 99,
      "name": "__chart_12_preset",
      "cell_type": 1,
      "chart_type": "scatter",
      "x_metric": 1,
      "y1_metric": 2,
      "y2_metric": null,
      "group_by": "drive_strength,__tag__",
      "is_visible": "N"
    },
    "items": [
      { "item_id": 33, "cell_id": 101, "cell_tag": "fast" },
      { "item_id": 34, "cell_id": 102, "cell_tag": "" }
    ],
    "created_at": "2026-05-01T11:30:00",
    "created_by": "sh0913.park"
  }
]
```

### `GET /clara/chart/<id>/` (Retrieve)

단건 조회. `preset`과 `items`가 함께 내려옴 (list와 동일 형식).

### `POST /clara/chart/` (Create)

#### Request Body
```json
{
  "chart_name": "FF Comparison Q2",
  "created_by": "sh0913.park",
  "preset": {
    "name": "__chart_q2_preset",
    "cell_type": 1,
    "chart_type": "scatter",
    "x_metric": 1,
    "y1_metric": 2,
    "y2_metric": null,
    "group_by": "drive_strength,__tag__"
  },
  "items": [
    { "cell_id": 101, "cell_tag": "fast" },
    { "cell_id": 102, "cell_tag": "" }
  ]
}
```

#### 필드 정책

**chart 본체:**
| 필드 | 필수 | 비고 |
|------|------|------|
| `chart_id` | ❌ | 자동 |
| `chart_name` | ✅ | |
| `preset` | ✅ | 중첩 객체 (아래 참조) |
| `items` | ✅ | 배열 (아래 참조) |
| `created_by` | 선택 | 기본 `''` |
| `created_at` | ❌ | 자동 |

**`preset` 객체:** [Chart Preset POST](#post-clarapreset-create)와 동일한 필드. 단:
- `is_visible`은 보내도 무시되며 항상 `'N'`으로 저장됨
- `created_by`는 chart의 `created_by`로 자동 복사됨

**`items` 배열 — 각 원소:**
| 필드 | 필수 | 비고 |
|------|------|------|
| `cell_id` | ✅ | 셀 ID |
| `cell_tag` | nullable | per-cell tag 입력값. Group 템플릿의 `__tag__` 토큰이 참조. 빈 문자열 허용 |

#### Response — 201
저장된 chart + preset + items 전체 반환 (위 GET 응답과 동일 형식).

### `DELETE /clara/chart/<id>/`

#### Cascade 동작
1. 자식 `items` 모두 삭제 (FK CASCADE)
2. `chart` 삭제
3. 연결된 전용 `preset` 삭제

한 트랜잭션으로 처리되며 중간 실패 시 전체 롤백.

#### Response
- 204 No Content

---

## 9. Cell Height

MW 조회(`cell_height_id`)에 쓰이는 Cell Height 목록. `spil_mw_meta.cell_height_id`가 참조하는 lookup 테이블 — 기존 CLARA 스키마엔 없던 신규 조회 endpoint.

### `GET /clara/cell-height/`

#### Response 예시
```json
[
  { "id": 1, "height": "12T" },
  { "id": 2, "height": "9T" }
]
```

---

## 10. MW Table

Cell × CK Slope/Voltage 조합의 MW(Margin Window) fail count 조회. Library Report 페이지의 MW 탭에서, 테이블 하나(= `cell_height_id` × `mw_type` × `pdk_id` × `library_id` 조합 하나)를 그릴 때 호출.

**출처 테이블**: `spil_mw_meta` (1행 = 셀 1개 characterization run) + `spil_mw_fail_count` (meta 1건당 ck_slope × voltage 조합별 fail count, N행).

### `GET /clara/mw/`

#### Query Parameters
| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `pdk_id` | int | ✅ | `spil_mw_meta.pdk_id` — CLARA `PDKVersion`(`/clara/pdk/`)과 동일 FK 공간 |
| `library_id` | int | ✅ | `spil_mw_meta.library_id` — CLARA `Library`(`/clara/lib/`)와 동일 FK 공간 |
| `cell_height_id` | int | ✅ | `spil_mw_meta.cell_height_id` — [`GET /clara/cell-height/`](#9-cell-height) 참조 |
| `mw_type` | string | ✅ | `MWD` \| `MWS` |

#### 쿼리
```sql
SELECT
  m.id            AS meta_id,
  m.cell_list     AS cell_name,   -- meta 1행 = 셀 1개이므로 cell_list가 곧 cell 이름
  f.ck_slope,                     -- NUMBER(3), 예: 100 / 70 / 40
  f.voltage_label,                -- 예: '0p42v'
  f.voltage_value,                -- BINARY_DOUBLE 실값
  f.fail_count                    -- 테이블에 찍히는 값 (경고 임계값 비교 대상)
FROM spil_mw_meta m
JOIN spil_mw_fail_count f
  ON f.meta_id = m.id
WHERE m.pdk_id         = :pdk_id
  AND m.cell_height_id = :cell_height_id
  AND m.library_id     = :library_id
  AND m.mw_type         = :mw_type
ORDER BY m.cell_list, f.ck_slope DESC, f.voltage_value
```

cell을 WHERE에 지정하지 않으므로, 조건에 맞는 **모든 셀**(= 여러 `meta` 행)이 한 번에 나옴 — 이게 테이블의 행(CELL)이 됨.

#### Response 예시
```json
[
  { "meta_id": 5001, "cell_name": "INVD1",   "ck_slope": 100, "voltage_label": "0p42v", "voltage_value": 0.42, "fail_count": 3 },
  { "meta_id": 5001, "cell_name": "INVD1",   "ck_slope": 100, "voltage_label": "0p45v", "voltage_value": 0.45, "fail_count": 0 },
  { "meta_id": 5001, "cell_name": "INVD1",   "ck_slope": 70,  "voltage_label": "0p50v", "voltage_value": 0.50, "fail_count": 12 },
  { "meta_id": 5002, "cell_name": "NAND2D1", "ck_slope": 100, "voltage_label": "0p42v", "voltage_value": 0.42, "fail_count": 1 }
]
```

#### 필드 설명
| 필드 | 타입 | 설명 |
|------|------|------|
| `meta_id` | int | `spil_mw_meta.id` |
| `cell_name` | string | `spil_mw_meta.cell_list` (셀 1개당 이름 1개) |
| `ck_slope` | int | `spil_mw_fail_count.ck_slope` |
| `voltage_label` | string | `spil_mw_fail_count.voltage_label` |
| `voltage_value` | number | `spil_mw_fail_count.voltage_value` |
| `fail_count` | int | 경고 임계값 비교 대상 값. ⚠️ 임계값(프론트 `MW_HIGH` 상당)을 DB에 둘지 프론트 상수로 둘지 미정 |

#### 역할 분담 — 표 조립은 프론트가 한다

**백엔드는 위 쿼리 결과 행을 그대로 직렬화해서 내려주면 끝.** 다음은 하지 않는다:
- `groups` / `subCols` 같은 중첩 구조 만들기
- 없는 (ck_slope, voltage) 조합을 null로 채우기 — **존재하는 조합만** 행으로 반환
- 표시 순서 보장 (`ORDER BY`는 안정적인 출력을 위한 것이고, 최종 열 순서는 프론트가 다시 정함)

**프론트가 flat 배열을 받아 2단 헤더(`{ groups, subCols, rows }`)로 조립한다.** 이유:

1. **여러 테이블 간 열 정렬** (결정적) — MW 탭은 한 비교 셋 안에 테이블 여러 개를 나란히 놓고 본다. 테이블마다 존재하는 voltage 조합이 달라 열 개수가 어긋나는데, 백엔드는 요청 하나당 테이블 하나만 보므로 옆 테이블에 어떤 열이 있는지 알 수 없다. 열을 맞추거나 빈 칸을 채우려면 셋 전체를 아는 프론트여야 한다.
2. **결합도** — 백엔드가 2단 헤더까지 만들면 UI의 정렬/그룹 기준이 바뀔 때마다 백엔드도 바뀌어야 한다.
3. **기존 컨벤션** — 이 API의 다른 엔드포인트(`/meta/`, `/cell/ff/`, `/metric/`)도 전부 flat list를 주고 그룹핑은 프론트가 한다.

**피벗 규칙 (한 테이블 내부):**
- 한 테이블 안에서도 **셀마다 (ck_slope, voltage) 조합이 다를 수 있다.** 모든 셀이 동일한 열 집합을 갖는다고 가정하지 않는다.
- 열(`subCols`)은 그 테이블 **셀 전체의 (ck_slope, voltage) 합집합**으로 구성한다.
- 특정 셀에 없는 조합의 칸은 **빈칸**으로 남긴다 (0이 아니라 값 없음 — `fail_count 0`과 "측정 안 됨"은 구분한다).

> 참고: payload 크기가 문제되거나(flat은 행마다 `cell_name`/`meta_id`가 반복됨) 같은 표를 여러 클라이언트가 소비하게 되면 이 판단은 재검토 대상. 현재 규모(셀 수십 × 슬로프 3 × voltage 5 ≈ 수백 행)에서는 무시 가능.

#### 그 외
- 경고 임계값(프론트 목업의 `MW_HIGH`처럼 특정 값 초과 시 경고 표시)은 아직 프론트 하드코딩 상수. `fail_count`에 spec limit이 DB에 있다면 응답에 포함할지 계속 프론트 상수로 둘지는 별도 확인 필요.

#### Error Response
```json
// 400 — 필수 파라미터 누락
{ "error": "pdk_id, cell_height_id, library_id, mw_type parameters are required" }

// 404 — 데이터 없음
{ "error": "No data found for selected criteria" }
```

---

## 11. Family

Library의 `family` 컬럼으로 묶은 그룹 목록. Library Report 페이지(`/library-report`)는 library를 개별 선택하지 않고 **family 하나를 선택해 소속 library 전체를 한 번에 스코프로 삼는다** — 그 드롭다운의 데이터 소스.

> 📌 family 스코프의 Library Info 집계(Release Path / Cell Design)는 [12. Library Info 집계](#12-library-info-집계) 참조.

**출처 테이블**: `library` (신규 `family` 컬럼). family 자체 테이블은 없다 — family는 `library.family`의 distinct 값이며 **id가 없고 이름이 곧 키다.**

### `GET /clara/family/`

#### Query Parameters

없음. 응답이 곧 전체 데이터 ([공통 사항 · 페이지네이션](#페이지네이션) 참조).

#### 쿼리

```sql
SELECT
  l.family,
  l.id      AS library_id,
  l.library
FROM library l
WHERE l.family IS NOT NULL
  AND TRIM(l.family) IS NOT NULL
ORDER BY l.family, l.id
```

백엔드는 이 결과를 `family` 기준으로 묶어 아래 중첩 형태로 직렬화한다. 중첩은 `GET /clara/chart/`가 `items`를 함께 내려주는 것과 같은 부모-자식 집합체 패턴이다([8. Chart](#8-chart) 참조).

#### Response 예시

```json
[
  {
    "family": "FAMA",
    "libraries": [
      { "id": 1, "library": "LIBA" },
      { "id": 2, "library": "LIBB" }
    ]
  },
  {
    "family": "FAMB",
    "libraries": [
      { "id": 3, "library": "LIBC" },
      { "id": 4, "library": "LIBD" },
      { "id": 5, "library": "LIBE" }
    ]
  }
]
```

#### 필드 설명

| 필드 | 타입 | 설명 |
|------|------|------|
| `family` | string | `library.family` 값. **이 목록의 키** (family에는 id가 없다) |
| `libraries` | array | 해당 family에 속한 library 목록. 원소는 [3. Library](#3-library) 응답과 **동일한 shape** (`{ id, library }`) |
| `libraries[].id` | int | `library.id` — `/clara/meta/`의 `lib_id`, `/clara/mw/`의 `library_id`와 같은 FK 공간 |
| `libraries[].library` | string | `library.library` |

#### 순서 계약

**배열 순서가 곧 프론트의 표시 순서다.** `ORDER BY l.family, l.id`로 안정 정렬해 내려준다.

프론트는 `libraries` 순서를 재정렬하지 않고 그대로 사용한다 — family 안의 library는 PPA 탭의 열 그룹 순서, Library Info 표의 행 그룹 순서, MW 비교 셋의 테이블 배치 순서가 된다. 호출마다 순서가 흔들리면 비교 화면이 매번 달라 보인다.

#### 그 외

- **`family`가 NULL·공백인 library는 응답에 포함되지 않는다.** Library Report는 family 단위로만 동작하므로 소속이 없는 library는 이 화면에서 선택할 수 없다. 전체 library 목록이 필요한 화면(메인 PPA 빌더의 Library 다중선택)은 계속 [3. Library](#3-library)를 쓴다. Oracle에서 빈 문자열은 NULL이지만 공백 문자열(`' '`)은 NULL이 아니므로 `TRIM` 조건을 함께 둔다.
- **`/clara/lib/`의 응답 스키마는 바뀌지 않는다.** family는 이 엔드포인트로만 노출한다.
- library가 1개뿐인 family도 정상 응답이다 (프론트는 이 경우 library 간 비교 UI를 숨긴다).
- family 목록만 필요한 소비자도 `libraries`를 함께 받는다. 별도의 "family 이름만" 엔드포인트는 두지 않는다 — Library Report가 선택 직후 곧바로 멤버 library id를 필요로 하므로 왕복 한 번을 줄이는 쪽이 낫다.

#### Error Response

```json
// 500 — 서버 오류
```

- 조건에 맞는 family가 없으면 `404`가 아니라 **`200` + 빈 배열 `[]`** 을 반환한다 (`/clara/lib/`, `/clara/pdk/` 등 다른 list 엔드포인트와 동일).
- 필수 쿼리 파라미터가 없으므로 `400`은 발생하지 않는다.

---

## 12. Library Info 집계

> ⚠️ **2026-09-26 — 프론트 소비처가 이동했다. 백엔드 착수 전 아래 두 항목을 확인할 것.** 계약(쿼리·응답 shape)은 **변경 없이 유효**하지만, Library Report의 UI가 다시 만들어지면서 이 응답을 쓰는 화면이 바뀌었다.
>
> 1. **`release_paths` 블록** — Library Info 탭이 이 값을 더 이상 그리지 않는다. 릴리스 경로와 GDS version이 **리포트별 사용자 입력**으로 바뀌어 리포트 테이블이 소유한다. 아래 [그 외](#그-외-2)의 첫 항목이 제기한 "`library_release`(가칭) 원천이 있는가"라는 질문이, **"그 원천을 만들 필요가 있는가"** 로 바뀌었다. → [docs/final-report-design.md](docs/final-report-design.md) §3-5 / §8 #20
> 2. **`cell_design` 블록** — 탭의 Cell Design 화면이 `library × cell_height × (drives/vths/nanosheet)`에서 **`대표 셀 × cell_height × bit-width`** 로 교체됐다. **2026-09-27 확정 — 그 뷰는 (PDK, library) 스코프이며 [13. Cell Design 집계](#13-cell-design-집계)로 분리했다.** 탭의 소비처는 §13이 가져갔고, 이 블록은 축이 화면과 달라 **여전히 소비처가 없다.** 유지·제거는 §13 백엔드 착수 시 함께 결정한다. → [docs/final-report-design.md](docs/final-report-design.md) §8 #11 / #11-a (해결)
>
> 현재 이 엔드포인트(의 mock)를 실제로 쓰는 곳은 **Final Report의 `LIB` 영역 요약** 하나다 — family 멤버 수와 GDS version 집합을 세는 데 쓴다. `GET /clara/family/`(§11)와 이 엔드포인트의 **family 단위 스코프 자체는 유효하다.**

Library Report 페이지의 **Library Info 탭** 전용 집계. family 하나를 넘기면 **소속 library 전체의 Release Path(+GDS version)와 Cell Design 지원 범위를 한 번에** 반환한다. 이 탭은 library를 개별 선택하지 않으므로([11. Family](#11-family)), library마다 따로 조회하는 엔드포인트를 두지 않고 family 단위 집계 하나로 대응한다.

> 📌 대표 셀 기준 Cell Design 집계는 [13. Cell Design 집계](#13-cell-design-집계) 참조 — 이 섹션의 `cell_design` 블록과 축이 다르다.

**출처 테이블**: `library`(family 멤버 확정) + release/GDS 원천(⚠️ 미확정, 아래 [그 외](#그-외-2) 참조) + `cell_meta`(cell design 집계). 자체 테이블은 없다 — **전부 조회 시점 집계이며 저장하지 않는다.**

### `GET /clara/library-info/`

#### Query Parameters

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `pdk_id` | int | ✅ | `PDKVersion.id` — [`GET /clara/pdk/`](#2-pdk-version). cell design 집계의 PDK 축 |
| `family` | string | ✅ | `library.family` 값. [`GET /clara/family/`](#11-family)의 `family` 문자열 (family에는 id가 없다) |

Library Report는 컨텍스트바에서 (PDK, family) 두 축을 항상 함께 정하므로 두 파라미터 모두 필수로 둔다. `library_id` 필터는 두지 않는다 — 이 탭의 스코프는 family 전체다.

#### 쿼리

```sql
-- 1) family 멤버 library (11. Family와 동일 원천 · 동일 정렬)
SELECT l.id AS library_id, l.library
FROM library l
WHERE l.family = :family
ORDER BY l.id

-- 2) library × cell_height 별 release path / gds version
--    ⚠️ 원천 테이블 미확정 — 아래 '그 외' 참조. library_release는 가칭.
SELECT r.library_id,
       r.cell_height_id,
       ch.height,
       r.release_path AS path,
       r.gds_version
FROM library_release r
JOIN cell_height ch ON ch.id = r.cell_height_id
WHERE r.library_id IN (:library_ids)
  AND r.pdk_id = :pdk_id
ORDER BY r.library_id, r.cell_height_id

-- 3) library × cell_height 별 cell design 지원 범위 집계
SELECT m.lib_id AS library_id,
       ch.id    AS cell_height_id,
       ch.height,
       LISTAGG(DISTINCT m.drive_strength, ' ') WITHIN GROUP (ORDER BY m.drive_strength) AS drives,
       LISTAGG(DISTINCT m.vth, ',')            WITHIN GROUP (ORDER BY m.vth)            AS vths,
       LISTAGG(DISTINCT m.nanosheet, ',')      WITHIN GROUP (ORDER BY m.nanosheet)      AS nanosheet,
       COUNT(*)                                                                        AS cell_count
FROM cell_meta m
JOIN cell_height ch ON ch.height = m.cell_height   -- ⚠️ cell_meta.cell_height는 문자열 ('12T'), 정규화 확인 필요
WHERE m.lib_id IN (:library_ids)
  AND m.pdk_id = :pdk_id
GROUP BY m.lib_id, ch.id, ch.height
ORDER BY m.lib_id, ch.id
```

백엔드는 2)·3)의 결과를 1)의 library에 붙여 아래 중첩 형태로 직렬화한다. 중첩은 [11. Family](#11-family)의 `family` → `libraries[]`와 같은 패턴이다.

#### Response 예시

```json
{
  "family": "FAMA",
  "pdk_id": 3,
  "libraries": [
    {
      "id": 1,
      "library": "LIBA",
      "release_paths": [
        { "cell_height_id": 1, "height": "CH120", "path": "/proj/lib/LIBA/ch120/release/r4", "gds_version": "V1.0.0.0" },
        { "cell_height_id": 2, "height": "CH150", "path": "/proj/lib/LIBA/ch150/release/r3", "gds_version": "V0.9.5.0" },
        { "cell_height_id": 3, "height": "CH180", "path": "/proj/lib/LIBA/ch180/release/r2", "gds_version": "V0.9.5.0" }
      ],
      "cell_design": [
        { "cell_height_id": 1, "height": "CH120", "drives": "D1 D2 D3 D6 D8 D16",
          "vths": ["rvt", "lvt", "slvt", "vlvt"], "nanosheet": ["N1", "N2", "N3", "N5"], "cell_count": 512 },
        { "cell_height_id": 2, "height": "CH150", "drives": "D1 D2 D3 D4 D8",
          "vths": ["rvt", "lvt", "slvt"], "nanosheet": ["N1", "N2", "N3"], "cell_count": 374 },
        { "cell_height_id": 3, "height": "CH180", "drives": "D1 D2 D3",
          "vths": ["rvt", "lvt", "slvt", "mvt"], "nanosheet": ["N1", "N2", "N3", "N4"], "cell_count": 268 }
      ]
    },
    {
      "id": 2,
      "library": "LIBB",
      "release_paths": [
        { "cell_height_id": 1, "height": "CH120", "path": "/proj/lib/LIBB/ch120/release/r4", "gds_version": "V1.0.0.0" }
      ],
      "cell_design": [
        { "cell_height_id": 1, "height": "CH120", "drives": "D1 D2 D3 D6 D8 D16",
          "vths": ["rvt", "slvt"], "nanosheet": ["N1", "N2"], "cell_count": 498 }
      ]
    }
  ]
}
```

#### 필드 설명

| 필드 | 타입 | 설명 |
|------|------|------|
| `family` | string | 요청한 `family` 값 되돌림. 프론트가 늦게 도착한 응답을 현재 컨텍스트와 대조하는 데 쓴다 |
| `pdk_id` | int | 요청한 `pdk_id` 되돌림 |
| `libraries` | array | family 멤버 library. 원소는 [11. Family](#11-family)의 `libraries[]`(= [3. Library](#3-library) shape)에 집계 배열 2개가 붙은 형태 |
| `libraries[].id` | int | `library.id`. **중첩 노드이므로 `id`** — `/clara/report/`의 flat `release_paths[]`처럼 행 단위로 펼쳐진 배열에서는 `library_id`를 쓴다 |
| `libraries[].library` | string | `library.library` |
| `libraries[].release_paths` | array | library × cell_height 별 릴리스 경로. 행 없으면 **빈 배열** |
| `release_paths[].cell_height_id` | int | [`GET /clara/cell-height/`](#9-cell-height)의 `id`. `/clara/mw/`의 `cell_height_id`와 같은 FK 공간 |
| `release_paths[].height` | string | `cell_height.height` (표시용 — 프론트가 id로 재조회하지 않게) |
| `release_paths[].path` | string \| null | 릴리스 경로. **원천 미확정이라 nullable** — 없으면 `null` |
| `release_paths[].gds_version` | string | GDS version 집계값 |
| `libraries[].cell_design` | array | library × cell_height 별 지원 범위. 행 없으면 **빈 배열** |
| `cell_design[].drives` | string | 지원 Drive Strength를 **공백으로 구분한 문자열** (`"D1 D2 D3"`). 표에 그대로 출력하는 값 |
| `cell_design[].vths` | array\<string\> | 지원 VTH. 프론트가 전체 축과 대조해 미지원 항목을 회색 처리하므로 **문자열이 아니라 배열** |
| `cell_design[].nanosheet` | array\<string\> | 지원 Nanosheet. 위와 동일 |
| `cell_design[].cell_count` | int | 해당 (library, cell_height)의 셀 수 |

`gds_desc`(GDS version 해석 설명)와 release path의 **사용자 입력분은 이 응답에 없다.** 리포트별 입력값이며 `GET /clara/report/`가 담당한다.

`vth_all` / `nanosheet_all`(미지원 항목 회색 처리용 전체 축)도 포함하지 않는다 — 현재는 프론트 상수다. 응답에 싣기로 확정되면 library별이 아니라 **top-level에** 가산 추가한다 (mini-table의 열이 family 전체에서 같은 위치여야 비교가 된다).

#### 순서 계약

**배열 순서가 곧 프론트의 표시 순서다** ([11. Family](#11-family)와 동일 계약).

- `libraries[]` — `ORDER BY library.id`. 같은 family를 다시 조회했을 때 순서가 흔들리면 Library Info 표의 행 그룹 순서가 매번 달라진다.
- `release_paths[]` / `cell_design[]` — `ORDER BY cell_height_id`. 프론트는 두 배열을 재정렬하지 않고 받은 순서로 행을 쌓는다.

#### 그 외

- **`path`·`gds_version`의 원천 테이블이 미확정이다.** 위 쿼리의 `library_release`는 가칭이다. Library Report의 Final Report 설계는 release path를 *리포트별 사용자 입력*으로 정의했다(리포트 테이블에 JSON 저장). library 마스터 쪽에 릴리스 경로/GDS version 원천이 있는지 확인이 필요하며, 없다면 이 응답의 `path`는 항상 `null`이고 GDS version만 집계로 채워진다.
- **`cell_meta.cell_height`는 문자열(`"12T"`)이고 `spil_mw_meta.cell_height_id`는 int다.** 위 3) 쿼리는 이름 조인으로 우회했다. 두 축이 같은 lookup(`cell_height`)을 가리키는지, `cell_meta`에 `cell_height_id`를 추가할지 확인이 필요하다 — 확인 전까지 `cell_design[].cell_height_id`는 이름 조인 결과다.
- **library마다 지원 cell_height 수가 다를 수 있다.** 응답이 library별 배열이므로 구조적으로 허용되며, 프론트도 배열 길이를 가정하지 않는다. 위 예시의 `LIBB`가 그 경우다.
- **집계 행이 0개인 library도 응답에 남는다** (`release_paths: []`, `cell_design: []`). 그 library를 빼지 않는 이유는 "library는 있는데 데이터가 없음"과 "library가 family에 없음"을 프론트가 구분해야 하기 때문이다.
- **PDK 축의 적용 범위**: `pdk_id`는 cell design 집계에 확실히 필요하다. release/GDS가 PDK에 의존하는지는 원천 확정과 함께 확인한다 — 무관하다면 2) 쿼리에서 `pdk_id` 조건만 빠지고 응답 shape은 그대로다.

#### Error Response

```json
// 400 — 필수 파라미터 누락
{ "error": "pdk_id and family parameters are required" }

// 404 — family 없음 (소속 library가 하나도 없음)
{ "error": "No libraries found for the given family" }
```

- family에 library가 있으면 집계 결과가 비어도 **`200`** 이다 (`libraries[]`의 각 배열이 빈 배열). `404`는 family 자체가 없을 때만 낸다.
- `pdk_id`에 데이터가 없는 family도 `200` — 각 library의 `cell_design`이 빈 배열이 된다 ([11. Family](#11-family) "family는 PDK와 독립" 참조).

---

## 13. Cell Design 집계

Library Report **Library Info 탭의 Cell Design 블록** 전용 집계. family 하나를 넘기면 **소속 library 전체의 "대표 셀 × cell height × bit-width" 지원 범위와 VTH별 셀 수를 한 번에** 반환한다.

[12. Library Info 집계](#12-library-info-집계)의 `cell_design` 블록과 **축이 다르다** — §12는 `library × cell_height`로 묶은 지원 범위이고, 이 섹션은 그 안을 **대표 셀과 bit-width로 한 단계 더 쪼갠** 것이다. 화면이 대표 셀 뷰로 교체되면서 탭의 소비처가 이 섹션으로 옮겨졌다.

**대표 셀(representative cell)** 은 bit-width 변형 집합을 대표하는 이름이다 — `JSDFF`가 `JSDFF` / `JSDFF2X` / `JSDFF3X` … 를 대표한다. 화면은 대표 셀마다 블록 하나를 그리고, 그 안에서 cell height × bit-width 카드에 지원 drive / nanosheet 칩과 VTH별 셀 수 막대를 표시한다.

**출처 테이블**: `library`(family 멤버 확정) + `cell_meta`(집계). 자체 테이블은 없다 — **전부 조회 시점 집계이며 저장하지 않는다.** ⚠️ 대표 셀·bit-width의 원천 컬럼은 미확정이다 (아래 [그 외](#그-외-3) 참조).

### `GET /clara/cell-design/`

#### Query Parameters

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `pdk_id` | int | ✅ | `PDKVersion.id` — [`GET /clara/pdk/`](#2-pdk-version). `cell_meta.pdk_id` |
| `family` | string | ✅ | `library.family` 값. [`GET /clara/family/`](#11-family)의 `family` 문자열 (family에는 id가 없다) |

Library Report는 컨텍스트바에서 (PDK, family) 두 축을 항상 함께 정하므로 둘 다 필수다(§12와 동일). `library_id` 필터는 두지 않는다 — 이 블록의 스코프는 family 전체이며, library 간 비교가 화면의 목적이다.

`rep_cell` 필터는 두지 않는다. 화면이 대표 셀 전체를 한 화면에 쌓기 때문이다 — payload가 문제가 되면 가산 추가한다(아래 [그 외](#그-외-3)).

#### 쿼리

```sql
-- 1) family 멤버 library (11. Family와 동일 원천 · 동일 정렬)
SELECT l.id AS library_id, l.library
FROM library l
WHERE l.family = :family
ORDER BY l.id

-- 2) library × 대표 셀 × cell_height × bit-width 별 지원 drive / nanosheet + 총 셀 수
--    ⚠️ '대표 셀'과 'bit-width'의 원천 컬럼이 미확정이다 — 아래 '그 외' 참조.
--       cell_meta에 두 개념에 대응하는 컬럼이 없어, 잠정적으로 cell_meta.cell의
--       bit-width 접미를 떼는 방식으로 우회한다 (JSDFF / JSDFF2X / JSDFF3X → 'JSDFF').
WITH base AS (
  SELECT m.lib_id                                  AS library_id,
         REGEXP_REPLACE(m.cell, '[0-9]+X$', '')    AS rep_cell,
         NVL(TO_NUMBER(REGEXP_SUBSTR(m.cell, '([0-9]+)X$', 1, 1, NULL, 1)), 1) AS bit_width,
         ch.id     AS cell_height_id,
         ch.height AS height,
         m.drive_strength,
         m.nanosheet,
         m.vth
  FROM cell_meta m
  JOIN cell_height ch ON ch.height = m.cell_height  -- ⚠️ §12와 같은 이름 조인 (cell_meta.cell_height는 문자열 '12T')
  WHERE m.lib_id  IN (:library_ids)
    AND m.pdk_id  = :pdk_id
)
SELECT library_id, rep_cell, cell_height_id, height, bit_width,
       LISTAGG(DISTINCT drive_strength, ',') WITHIN GROUP (ORDER BY drive_strength) AS drives,
       LISTAGG(DISTINCT nanosheet, ',')      WITHIN GROUP (ORDER BY nanosheet)      AS nanosheets,
       COUNT(*)                                                                     AS cell_count
FROM base
GROUP BY library_id, rep_cell, cell_height_id, height, bit_width
ORDER BY library_id, rep_cell, cell_height_id, bit_width

-- 3) 같은 그룹을 VTH로 한 단계 더 쪼갠 셀 수 (2)와 동일한 base)
SELECT library_id, rep_cell, cell_height_id, bit_width, vth, COUNT(*) AS cell_count
FROM base
WHERE vth IS NOT NULL
GROUP BY library_id, rep_cell, cell_height_id, bit_width, vth
ORDER BY library_id, rep_cell, cell_height_id, bit_width, vth
```

2)와 3)은 같은 `base`를 쓴다 — 읽기 쉽게 나눠 적었을 뿐이므로 백엔드는 `GROUPING SETS` 하나로 합치거나, 3)만 조회해 애플리케이션에서 drive/nanosheet 합집합을 접어도 된다. 응답 shape은 어느 쪽이든 같다.

백엔드는 2)·3)의 결과를 1)의 library에 붙여 아래 중첩 형태로 직렬화한다. 중첩은 [11. Family](#11-family)의 `family` → `libraries[]`, [12. Library Info 집계](#12-library-info-집계)의 `libraries[]` → 집계 배열과 같은 패턴이며 한 단계 더 깊다.

#### Response 예시

```json
{
  "family": "FAMA",
  "pdk_id": 3,
  "drive_axis": ["D1", "D2", "D3", "D4"],
  "nanosheet_axis": ["N1", "N1P5", "N2", "N3"],
  "vth_axis": ["RVT", "LVT", "SLVT", "MVT", "VLVT"],
  "libraries": [
    {
      "id": 1,
      "library": "LIBA",
      "rep_cells": [
        {
          "rep_cell": "JSDFF",
          "heights": [
            {
              "cell_height_id": 1,
              "height": "CH120",
              "bits": [
                { "bit_width": 1, "drives": ["D1", "D2", "D3", "D4"], "nanosheets": ["N1", "N2", "N3"],
                  "vths": [{ "vth": "RVT", "cell_count": 240 }, { "vth": "LVT", "cell_count": 180 }, { "vth": "SLVT", "cell_count": 120 }],
                  "cell_count": 540 },
                { "bit_width": 2, "drives": ["D1", "D3"], "nanosheets": ["N1"],
                  "vths": [{ "vth": "RVT", "cell_count": 120 }, { "vth": "SLVT", "cell_count": 60 }],
                  "cell_count": 180 }
              ]
            },
            {
              "cell_height_id": 2,
              "height": "CH150",
              "bits": [
                { "bit_width": 1, "drives": ["D1", "D2"], "nanosheets": ["N1", "N1P5"],
                  "vths": [{ "vth": "RVT", "cell_count": 180 }, { "vth": "LVT", "cell_count": 60 }],
                  "cell_count": 240 }
              ]
            }
          ]
        },
        {
          "rep_cell": "JSLATCH",
          "heights": [
            {
              "cell_height_id": 1,
              "height": "CH120",
              "bits": [
                { "bit_width": 1, "drives": ["D1", "D2", "D4"], "nanosheets": ["N1", "N2"],
                  "vths": [{ "vth": "RVT", "cell_count": 120 }, { "vth": "MVT", "cell_count": 60 }],
                  "cell_count": 180 }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": 2,
      "library": "LIBB",
      "rep_cells": [
        {
          "rep_cell": "JSDFF",
          "heights": [
            {
              "cell_height_id": 1,
              "height": "CH120",
              "bits": [
                { "bit_width": 1, "drives": ["D1", "D2"], "nanosheets": ["N1"],
                  "vths": [{ "vth": "RVT", "cell_count": 180 }],
                  "cell_count": 180 }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

위 예시의 `LIBB`는 **같은 family의 library라도 대표 셀 수·cell height 수·bit 집합이 다를 수 있다**는 것을 보여준다. 이것이 이 엔드포인트를 만드는 이유다 — library 축이 없으면 화면이 어느 library의 지원 범위인지 말하지 못한다.

#### 필드 설명

| 필드 | 타입 | 설명 |
|------|------|------|
| `family` | string | 요청한 `family` 값 되돌림. 프론트가 늦게 도착한 응답을 현재 컨텍스트와 대조하는 데 쓴다 |
| `pdk_id` | int | 요청한 `pdk_id` 되돌림 |
| `drive_axis` | array\<string\> | Drive Strength **전체 축**. 프론트는 이 순서로 칩을 그리고 `bits[].drives`에 없는 값을 회색 처리한다 |
| `nanosheet_axis` | array\<string\> | Nanosheet 전체 축. 위와 동일 |
| `vth_axis` | array\<string\> | VTH 전체 축. 프론트는 이 순서로 막대 행을 그린다 |
| `libraries` | array | family 멤버 library. 원소는 [11. Family](#11-family)의 `libraries[]`(= [3. Library](#3-library) shape)에 `rep_cells`가 붙은 형태 |
| `libraries[].id` | int | `library.id`. **중첩 노드이므로 `id`** ([12. Library Info 집계](#12-library-info-집계)와 동일 규칙 — flat 행에서만 `library_id`를 쓴다) |
| `libraries[].library` | string | `library.library` |
| `libraries[].rep_cells` | array | 그 (library, PDK)에 집계 행이 있는 대표 셀. 행 없으면 **빈 배열** |
| `rep_cells[].rep_cell` | string | 대표 셀 이름. ⚠️ 원천 컬럼 미확정 (아래 [그 외](#그-외-3)) |
| `rep_cells[].heights` | array | 그 대표 셀이 존재하는 cell height. 원소 1개 이상 (0개면 `rep_cells`에 나타나지 않는다) |
| `heights[].cell_height_id` | int | [`GET /clara/cell-height/`](#9-cell-height)의 `id`. `/clara/mw/`·§12의 `cell_height_id`와 같은 FK 공간 |
| `heights[].height` | string | `cell_height.height` (표시용 — 프론트가 id로 재조회하지 않게) |
| `heights[].bits` | array | bit-width 노드. 원소 1개 이상 |
| `bits[].bit_width` | int | bit 수 (1, 2, 3, 4, 6 …). 화면 라벨 `"2bit"`는 프론트가 만든다. ⚠️ 원천 컬럼 미확정 |
| `bits[].drives` | array\<string\> | **지원하는** Drive Strength만. `drive_axis`와 대조해 미지원을 회색 처리하므로 배열이다 — §12의 `cell_design[].drives`(공백 구분 문자열)와 **타입이 다르다** |
| `bits[].nanosheets` | array\<string\> | 지원하는 Nanosheet만. 위와 동일 |
| `bits[].vths` | array | 셀이 1개 이상 있는 VTH만. `vth_axis`에 있고 여기 없으면 미지원 |
| `bits[].vths[].vth` | string | `cell_meta.vth` 값. **대문자 그대로** (아래 [그 외](#그-외-3)) |
| `bits[].vths[].cell_count` | int | 그 (library, 대표 셀, cell_height, bit_width, VTH)의 셀 수. 화면 막대의 값 |
| `bits[].cell_count` | int | 그 bit 노드 전체의 셀 수. `vth`가 NULL인 셀을 포함하므로 `SUM(vths[].cell_count)`보다 **클 수 있다** |

#### 순서 계약

**배열 순서가 곧 프론트의 표시 순서다** ([11. Family](#11-family)·[12. Library Info 집계](#12-library-info-집계)와 동일 계약). 프론트는 어떤 배열도 재정렬하지 않는다.

- `libraries[]` — `ORDER BY library.id`. §11·§12와 같은 정렬이므로 PPA 열 그룹·MW 테이블 배치와 library 순서가 화면 전체에서 일치한다.
- `rep_cells[]` — `ORDER BY rep_cell` (이름 오름차순). ⚠️ 대표 셀이 마스터 테이블로 승격되면 표시 순서 컬럼을 따른다 (그때까지 이름 정렬이 계약).
- `heights[]` — `ORDER BY cell_height_id`.
- `bits[]` — `ORDER BY bit_width` 오름차순. 카드가 좁은 것부터 넓은 것 순으로 놓인다.
- `drive_axis` / `nanosheet_axis` / `vth_axis` — **칩·막대의 표시 순서이며 family 전체에서 동일하다.** 호출마다 순서가 흔들리면 library 간 비교 화면이 매번 달라 보인다.
- `bits[].drives` / `nanosheets` / `vths` — 프론트는 축과 대조만 하므로 내부 순서를 쓰지 않는다. 그래도 안정 정렬해 내려준다 (diff·캐시 비교용).

#### 그 외

- **`rep_cell`과 `bit_width`의 원천 컬럼이 미확정이다.** `cell_meta`에는 두 개념에 대응하는 컬럼이 없다(§1 Cell Meta 참조). 위 쿼리는 `cell_meta.cell`의 이름 규칙(`JSDFF2X` → 대표 `JSDFF` + 2bit)을 가정한 **잠정 우회**다. 정석은 ETL이 파싱 결과를 `cell_meta.rep_cell` / `cell_meta.bit_width` 두 컬럼에 저장하는 것이고, 대표 셀에 표시 순서·설명이 필요해지면 마스터 테이블이 필요하다. **어느 쪽이든 이 응답의 shape은 바뀌지 않는다** — 바뀌는 것은 위 쿼리뿐이다. 대표 셀 목록이 마스터 데이터인지도 함께 확인이 필요하다.
- **`cell_meta.cell_height`는 문자열(`"12T"`)이고 `spil_mw_meta.cell_height_id`는 int다.** 위 쿼리는 §12와 **같은 이름 조인**으로 우회했다. `cell_meta`에 `cell_height_id`를 추가하는 것이 정석이며, 추가 전까지 `heights[].cell_height_id`는 이름 조인 결과다.
- **`bits[].drives`는 배열이고 §12의 `cell_design[].drives`는 공백 구분 문자열이다.** 같은 이름의 타입이 두 섹션에서 다르다. §12의 것은 표에 그대로 찍는 값이고, 여기서는 top-level 축과 대조해 칩을 회색 처리하므로 원소 단위가 필요하다(§12가 `vths`를 배열로 둔 것과 같은 이유). §12의 `cell_design` 블록은 현재 소비처가 없으므로(§12 상단 ⚠️), 그 블록을 정리할 때 이 중복도 함께 없어진다.
- **VTH 값은 원천 그대로 대문자다** (`cell_meta.vth` = `"LVT"`). §12의 `vths` 예시가 소문자인 것은 프론트 mock에서 온 표기이며, 프론트는 case를 정규화하지 않는다. `vth_axis`와 `vths[].vth`의 표기는 항상 같아야 한다 — 다르면 화면의 모든 VTH가 미지원으로 보인다.
- **library·대표 셀·cell height마다 bit 집합이 다를 수 있다.** 응답이 중첩 배열이므로 구조적으로 허용되며, 프론트도 배열 길이를 가정하지 않는다. 위 예시의 `LIBB`가 그 경우다.
- **집계 행이 0개인 library도 응답에 남는다** (`rep_cells: []`). 빼지 않는 이유는 "library는 있는데 데이터가 없음"과 "library가 family에 없음"을 프론트가 구분해야 하기 때문이다(§12와 동일 판단). 프론트는 이 경우 library 이름만 그리고 블록을 비운다.
- **축 3개를 top-level에 둔 이유**: 미지원 항목을 *제자리에 회색으로* 남기는 화면이므로, 칩·막대가 family 전체에서 같은 위치여야 library 간 비교가 성립한다. library별·bit별로 축을 반복하면 축이 어긋날 여지가 생기고 payload가 부푼다. §12가 `vth_all`/`nanosheet_all`을 "싣기로 확정되면 library별이 아니라 top-level에" 라고 남긴 판단과 같다.
- **payload 규모**: family 5 library × 대표 셀 4 × cell height 3 × bit 3 = bit 노드 최대 180개. 현재 규모에서는 무시 가능하다(§10 MW의 판단과 같은 수준). 문제가 되면 `rep_cell` 필터 파라미터를 **가산 추가**한다 — 응답 shape 변경 없이 가능하다.
- **PDK 축은 이 집계에 확실히 필요하다.** `cell_meta.pdk_id`가 집계 조건이며, 같은 library라도 PDK가 다르면 지원 범위가 다르다. 이 점이 §12의 release/GDS(PDK 의존 여부 미확정)와 다르다.

#### Error Response

```json
// 400 — 필수 파라미터 누락
{ "error": "pdk_id and family parameters are required" }

// 404 — family 없음 (소속 library가 하나도 없음)
{ "error": "No libraries found for the given family" }
```

- family에 library가 있으면 집계 결과가 비어도 **`200`** 이다 (`libraries[]`의 각 `rep_cells`가 빈 배열). `404`는 family 자체가 없을 때만 낸다 (§12와 동일).
- `pdk_id`에 데이터가 없는 family도 `200` — 모든 library의 `rep_cells`가 빈 배열이 된다 ([11. Family](#11-family) "family는 PDK와 독립" 참조).
- 축 3개(`drive_axis` 등)는 **집계 결과가 비어도 항상 채워 내려준다.** 프론트가 빈 화면에서도 축을 그릴 수 있어야 하고, 축이 없으면 "미지원"과 "축 자체를 모름"을 구분할 수 없다.

---

## 에러 응답 형식

### 400 Bad Request
```json
{ "error": "cell_id parameter is required" }
```

또는 DRF 검증 실패 시 (필드별):
```json
{
  "name": ["This field is required."],
  "x_metric": ["Invalid pk \"999\" - object does not exist."]
}
```

### 404 Not Found
```json
{ "error": "No data found for selected rows" }
```

또는 단건 조회 시:
```json
{ "detail": "Not found." }
```

### 500 Internal Server Error
서버 로그 확인 필요. 운영 모드에서는 traceback 노출되지 않음.

---

## 데이터 모델 관계

```
ChartPreset ─────┐ (1:1, 자동 생성/삭제)
                 │
                 ▼
            Chart ──┬── ChartItem (1:N, CASCADE)
                    └── ChartItem
                    └── ChartItem ...

ChartPreset.x_metric  ──→ ChartMetric (FK)
ChartPreset.y1_metric ──→ ChartMetric (FK)
ChartPreset.y2_metric ──→ ChartMetric (FK, nullable)

CellMeta.lib_id ──→ Library (FK 의미상)
CellMeta.pdk_id ──→ PDKVersion (FK 의미상)

Library.family ──→ (마스터 테이블 없음, distinct 값이 곧 Family)

ChartItem.cell_id ──→ FFCell or ICGCell (cell_type에 따라 분기)
```

---

## 부록: 빠른 참조

### 모든 엔드포인트 한눈에

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/clara/meta/` | 셀 메타 (필터 가능) |
| GET | `/clara/pdk/` | PDK 버전 목록 |
| GET | `/clara/lib/` | 라이브러리 목록 |
| GET | `/clara/family/` | family별 library 목록 (Library Report 컨텍스트바) |
| GET | `/clara/cell/ff/?cell_id=...` | FF 셀 데이터 (필수 cell_id) |
| GET | `/clara/cell/ff/<id>/` | FF 셀 단건 |
| GET | `/clara/cell/icg/?cell_id=...` | ICG 셀 데이터 |
| GET | `/clara/cell/icg/<id>/` | ICG 셀 단건 |
| GET | `/clara/metric/` | metric 목록 |
| GET | `/clara/preset/` | preset 목록 (visible만) |
| POST | `/clara/preset/` | preset 생성 |
| GET | `/clara/preset/<id>/` | preset 단건 |
| DELETE | `/clara/preset/<id>/` | preset 삭제 |
| GET | `/clara/chart/` | chart 목록 |
| POST | `/clara/chart/` | chart 생성 (preset+items 일괄) |
| GET | `/clara/chart/<id>/` | chart 단건 |
| DELETE | `/clara/chart/<id>/` | chart 삭제 (cascade) |
| GET | `/clara/cell-height/` | Cell Height 목록 (mw 조회의 cell_height_id 드롭다운) |
| GET | `/clara/mw/` | MW 테이블 (cell_height_id × mw_type × pdk_id × library_id 조합, flat list) |
| GET | `/clara/library-info/?pdk_id=&family=` | Library Info 탭 집계 (family 멤버 library별 release path + cell design) |
| GET | `/clara/cell-design/?pdk_id=&family=` | Cell Design 집계 (library × 대표 셀 × cell height × bit-width 지원 범위 + VTH별 셀 수) |

### 자주 쓰는 호출 패턴

**셀 검색 → 데이터 로드:**
```
GET /clara/meta/?cell_type=FF&lib_id=1
  → 결과 cell.id 추출
GET /clara/cell/ff/?cell_id=101,102,103
  → 시뮬레이션 데이터 받음
```

**Chart 저장 → 다시 불러오기:**
```
POST /clara/chart/
  body: { chart_name, preset:{...}, items:[...] }
  → 응답에서 chart_id 받음

GET /clara/chart/<chart_id>/
  → 동일한 객체 다시 반환 (preset + items 포함)
```

**Preset 저장 → 적용:**
```
POST /clara/preset/
  body: { name, cell_type, chart_type, x_metric, y1_metric, y2_metric, group_by }
  group_by: Group 템플릿 CSV (예: "drive_strength,__tag__")

GET /clara/preset/
  → 저장된 preset 목록에서 사용자가 선택
```

**Library Report 컨텍스트 (family 단위):**
```
GET /clara/family/
  → family 선택 → family 이름 + libraries[].id 확보

GET /clara/library-info/?pdk_id=3&family=FAMA
  → Library Info 탭: family 멤버 library 전체의 release path + cell design을 1회로 (§12)

GET /clara/cell-design/?pdk_id=3&family=FAMA
  → Library Info 탭 Cell Design 블록: library × 대표 셀 × cell height × bit-width를 1회로 (§13)

GET /clara/mw/?pdk_id=3&library_id=1&cell_height_id=1&mw_type=MWD
  → MW 탭: family 멤버 library마다 1회 호출 (테이블 1개당 요청 1개)
```

---

## 변경 이력

- **2026-09-27** Cell Design 집계 엔드포인트 추가
  - 신규 `GET /clara/cell-design/?pdk_id=&family=` — Library Info 탭의 Cell Design 블록이 **(PDK, library) 스코프임이 확정**되어, family 1건으로 소속 library 전체의 `대표 셀 × cell height × bit-width` 지원 범위와 VTH별 셀 수를 1회에 받는다
  - 응답은 §11·§12의 계보를 잇는 중첩(`family` → `libraries[]` → `rep_cells[]` → `heights[]` → `bits[]`)이고 화면 구조와 1:1이다 — 프론트는 펼치기만 한다
  - **축 3개(`drive_axis`/`nanosheet_axis`/`vth_axis`)는 top-level** — 미지원 항목을 제자리 회색 처리하는 화면이므로 칩 위치가 family 전체에서 같아야 한다 (§12의 `vth_all` 판단과 동일). 집계가 비어도 항상 채워 내려준다
  - `bits[].drives`는 **배열**이다 — §12 `cell_design[].drives`(공백 구분 문자열)와 같은 이름이지만 타입이 다르다. 축과 대조해 칩을 회색 처리하기 때문
  - ⚠️ **`rep_cell`·`bit_width`의 원천 컬럼 미확정** — `cell_meta`에 대응 컬럼이 없어 쿼리는 `cell_meta.cell` 이름 규칙 파싱으로 우회했다. 정석은 ETL이 `rep_cell`/`bit_width` 컬럼을 채우는 것이며, **응답 shape은 어느 쪽이든 동일하다**. 대표 셀 목록이 마스터 데이터인지도 확인 대상
  - `cell_meta.cell_height`(문자열) ↔ `cell_height_id`(int) 이름 조인은 §12와 같은 우회
  - 집계 행이 0개인 library도 `rep_cells: []`로 응답에 남긴다 ("데이터 없음" ≠ "library 없음")
  - **§12 계약은 변경 없음** — 상단 ⚠️ 주석의 `cell_design` 항목만 "확정됨 + §13으로 분리" 로 갱신했다. 그 블록의 제거 여부는 §13 백엔드 착수 시 함께 결정
  - **`GET /clara/mw/`(§10)·`GET /clara/family/`(§11)·`GET /clara/lib/`(§3) 계약 변경 없음**
- **2026-09-26** (문서만) Library Report UI 포팅에 따른 소비처 변경 주석
  - **엔드포인트 계약 변경 없음.** `GET /clara/library-info/`(§12)의 쿼리·응답 shape·순서 계약은 그대로다
  - §12 상단에 ⚠️ 주석 추가 — Library Report 화면이 재작성되면서 (a) `release_paths`가 **리포트별 사용자 입력**으로 이동해 이 응답의 해당 블록을 아무도 그리지 않고, (b) Cell Design 화면의 축이 `대표 셀 × cell_height × bit-width`로 교체되어 `cell_design` 블록과 축이 어긋난다. **`library_release`(가칭) 원천 테이블 신설이 불필요해질 수 있어 백엔드 착수 전 확인이 필요하다**
  - `GET /clara/family/`(§11)와 §12의 **family 단위 스코프는 유효하다** — 바뀐 것은 탭의 화면 구성이다
  - `GET /clara/report/` 계열은 여전히 **미등재**다. 이번 포팅에 맞춘 초안(영역별 생성 `POST /clara/report/area-draft/`, 댓글 `PUT`/`DELETE` 신규 포함)은 [docs/final-report-design.md](docs/final-report-design.md) §7에 있고, 백엔드 합의 후 이 문서에 §13으로 등재한다
- **2026-09-26** Library Info 집계 엔드포인트 추가
  - 신규 `GET /clara/library-info/?pdk_id=&family=` — Library Report의 Library Info 탭이 family 멤버 library마다 따로 조회하는 대신 **family 1건으로 소속 library 전체의 Release Path(+GDS version) / Cell Design 집계를 1회에** 받는다
  - 응답은 §11 Family와 동형 중첩(`family` → `libraries[]`)이고, `libraries[]` 원소 하나가 리포트 `LIB` 블록 `data`의 `release_paths`/`cell_design`과 같은 shape — 백엔드 직렬화 로직을 공유할 수 있다
  - 저장 테이블 없음(전부 조회 시점 집계). `gds_desc`와 release path 사용자 입력분은 리포트 소유이므로 이 응답에 포함하지 않는다
  - `path`는 **nullable** — release/GDS 원천 테이블 미확정. `cell_meta.cell_height`(문자열) ↔ `cell_height_id`(int) 정규화도 확인 대상
  - 집계 행이 0개인 library도 `release_paths: []`로 응답에 남긴다 ("데이터 없음" ≠ "library 없음")
  - `vth_all`/`nanosheet_all`은 계속 프론트 상수 — 응답에 싣기로 확정되면 top-level에 가산 추가
  - **`GET /clara/mw/`(§10) 계약은 변경 없음** — MW를 family 단위로 묶을지는 미결 (설계 문서 오픈 이슈)
- **2026-09-26** Family 엔드포인트 추가
  - 신규 `GET /clara/family/` — `library.family` 컬럼으로 묶은 그룹 목록. Library Report 페이지의 컨텍스트바가 library 단일 선택에서 **family 단일 선택(= 소속 library 전체 선택)** 으로 바뀜
  - family는 **마스터 테이블이 아니라 `library`의 컬럼** — 자체 id가 없고 이름 문자열이 키. 추후 마스터 테이블로 승격되면 `family_id`를 가산 추가
  - 응답은 중첩(`family` → `libraries[]`) — `/clara/chart/`의 `items` 중첩과 같은 소유 관계 패턴. `libraries[]` 원소는 §3 Library와 동일 shape
  - 배열 순서 = 프론트 표시 순서 (`ORDER BY family, library.id`). family 안의 library가 PPA 열 그룹 / MW 테이블 배치 순서가 되므로 안정 정렬이 계약
  - `family`가 NULL·공백인 library는 응답에서 제외 — 전체 목록이 필요한 화면은 계속 §3 사용
  - **`GET /clara/lib/`의 응답 스키마는 변경 없음**
- **2026-09-03** MW Table + Cell Height 엔드포인트 추가
  - 신규 `GET /clara/mw/` — Library Report MW 탭의 cell_height_id × mw_type × pdk_id × library_id 조합 조회
  - 출처 테이블 확정: `spil_mw_meta`(1행=셀 1개) + `spil_mw_fail_count`(ck_slope×voltage별 fail_count, N행), meta에 cell 필터를 걸지 않고 조회해 조건에 맞는 모든 셀을 한 번에 반환
  - flat/tidy 리스트로 설계 (ck_slope/voltage_label 조합마다 한 행); mw_type 값은 `MWD`/`MWS` 2종
  - 표(2단 헤더) 조립 책임은 **프론트** — 한 비교 셋의 여러 테이블 간 열을 맞추려면 셋 전체를 아는 쪽이어야 하는데, 백엔드는 요청당 테이블 하나만 보므로 불가. 백엔드는 쿼리 결과를 그대로 직렬화만 함 (없는 조합은 행 자체를 생략)
  - `spil_mw_meta.pdk_id`/`library_id`는 CLARA 본 스키마(`PDKVersion`, `Library`)와 동일 FK 공간으로 확인됨
  - 신규 `GET /clara/cell-height/` — `cell_height_id`가 참조하는 lookup 테이블 목록 (기존에 없던 endpoint)
- **2026-05-19** Bar 차트 `x_metric` 처리
  - `x_metric`을 nullable로 두지 않고 cellType별 "group placeholder metric" row를 백엔드에 추가 (`name: groupFf|groupIcg`, `formula_type: raw`, `field1/field2/op: NONE`)
  - Bar 차트 preset 저장 시 해당 placeholder id를 `x_metric`에 넣음. 프론트엔드는 metric 응답에서 속성으로 자동 lookup (id 하드코딩 X)
  - 사용자 metric dropdown에선 placeholder 메트릭 필터링됨
- **2026-05-15** 필드 리네임
  - `chart_preset.x_axis` → **`x_metric`**, `y1_axis` → **`y1_metric`**, `y2_axis` → **`y2_metric`**
  - `chart_preset.cell_type` 필드 추가 (FK to cell types 매핑 id) — 필수
  - 신규 endpoint `GET /clara/cell/type` (셀 타입 id ↔ 이름 매핑)
  - `chart_metric.cell_type` 응답이 id(int)로 변경 (이전: 'FF'/'ICG' 문자열)
- **2026-05-14** Group 템플릿 도입
  - `chart_preset.group_by`: 단일 string (`"alias"` 등) → CSV 인코딩된 토큰 배열 (`"drive_strength,__tag__"`). 빈 문자열 허용. 컬럼 `VARCHAR2(255)` 권장.
  - `chart_preset.x_metric`: bar 차트에서 `__group__` 문자열 허용 (`__label__`는 deprecated)
  - `chart_item.cell_alias` → **`chart_item.cell_tag`** 리네임. 빈 문자열 허용 (이전: 빈 값 거부됨).

문서 최종 수정: 2026-09-27
