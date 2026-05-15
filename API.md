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
10. [에러 응답 형식](#에러-응답-형식)
11. [데이터 모델 관계](#데이터-모델-관계)

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
    "chart_type": "scatter",
    "x_axis": 1,
    "y1_axis": 2,
    "y2_axis": null,
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
| `chart_type` | string | `scatter`, `line`, `bar` |
| `x_axis` | int / string | scatter/line: metric_id, bar: `__label__` |
| `y1_axis` | int | metric_id |
| `y2_axis` | int / null | secondary y축, 없으면 null |
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

### `GET /clara/preset/<id>/` (Retrieve)

단건 조회. `is_visible` 무관.

### `POST /clara/preset/` (Create)

#### Request Body
```json
{
  "name": "FF PDP vs Area",
  "chart_type": "scatter",
  "x_axis": 1,
  "y1_axis": 2,
  "y2_axis": null,
  "group_by": "drive_strength,__tag__",
  "created_by": "sh0913.park"
}
```

#### 필드 정책
| 필드 | 입력 | 비고 |
|------|------|------|
| `preset_id` | ❌ | 자동 채번 |
| `name` | ✅ 필수 | |
| `chart_type` | ✅ 필수 | `scatter` / `line` / `bar` |
| `x_axis` | ✅ 필수 | scatter/line: metric_id, bar: `__label__` |
| `y1_axis` | ✅ 필수 | metric_id |
| `y2_axis` | nullable | 미사용 시 null |
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
      "chart_type": "scatter",
      "x_axis": 1,
      "y1_axis": 2,
      "y2_axis": null,
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
    "chart_type": "scatter",
    "x_axis": 1,
    "y1_axis": 2,
    "y2_axis": null,
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

## 에러 응답 형식

### 400 Bad Request
```json
{ "error": "cell_id parameter is required" }
```

또는 DRF 검증 실패 시 (필드별):
```json
{
  "name": ["This field is required."],
  "x_axis": ["Invalid pk \"999\" - object does not exist."]
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

ChartPreset.x_axis  ──→ ChartMetric (FK)
ChartPreset.y1_axis ──→ ChartMetric (FK)
ChartPreset.y2_axis ──→ ChartMetric (FK, nullable)

CellMeta.lib_id ──→ Library (FK 의미상)
CellMeta.pdk_id ──→ PDKVersion (FK 의미상)

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
  body: { name, chart_type, x_axis, y1_axis, y2_axis, group_by }
  group_by: Group 템플릿 CSV (예: "drive_strength,__tag__")

GET /clara/preset/
  → 저장된 preset 목록에서 사용자가 선택
```

---

## 변경 이력

- **2026-05-14** Group 템플릿 도입
  - `chart_preset.group_by`: 단일 string (`"alias"` 등) → CSV 인코딩된 토큰 배열 (`"drive_strength,__tag__"`). 빈 문자열 허용. 컬럼 `VARCHAR2(255)` 권장.
  - `chart_preset.x_axis`: bar 차트에서 `__label__` 문자열 허용 (이전: metric_id만)
  - `chart_item.cell_alias` → **`chart_item.cell_tag`** 리네임. 빈 문자열 허용 (이전: 빈 값 거부됨).

문서 최종 수정: 2026-05-14
