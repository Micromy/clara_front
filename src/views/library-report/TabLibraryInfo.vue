<script setup>
import { inject, computed } from 'vue'
import { cellDesignStats } from './data.js'

const { state, actions, pdk, family, locked } = inject('report')
const p = computed(() => pdk())
const fam = computed(() => family())

// 편집 중에 유예기간이 끝나도(locked가 시간으로 바뀐다) 입력이 열려 있지 않게 한다.
const editing = computed(() => state.infoEditing && !locked.value)

const libList = computed(() => fam.value.libraries.map(l => ({ id: l.id, library: l.library, desc: state.libDesc[l.library] || '' })))
function onDesc(lib, e) { actions.setLibDesc(lib, e.target.value) }

const releaseGroups = computed(() => {
  const groups = []
  state.releaseRows.forEach(r => {
    const last = groups[groups.length - 1]
    if (last && last.height === r.height) last.rows.push(r)
    else groups.push({ height: r.height, rows: [r] })
  })
  return groups
})

function chipStyle(on) {
  return on
    ? { border: '1px solid #bcd0f7', background: 'rgba(47,111,237,0.07)', color: '#2f6fed', fontWeight: 600, textDecoration: 'none' }
    : { border: '1px solid #edeff2', background: 'transparent', color: '#c2c9d2', fontWeight: 400, textDecoration: 'line-through' }
}

// GET /clara/cell-design/?pdk_id=&family= 1회 = 이 computed 1개 (API.md §13).
// library마다, 대표 셀마다 따로 조회하지 않는다.
const design = computed(() => cellDesignStats(state.pdkId, fam.value))

// 중첩 응답(libraries → rep_cells → heights → bits)을 화면 블록으로 펼친다.
// 순서는 전부 응답 배열 순서(§13 순서 계약) — 프론트는 재정렬하지 않는다.
const designLibs = computed(() => {
  const d = design.value
  return d.libraries.map(l => ({
    id: l.id,
    library: l.library,
    repBlocks: l.rep_cells.map(rc => ({
      rep: rc.rep_cell,
      heightRows: rc.heights.map(h => ({
        height: h.height,
        bitCount: `${h.bits.length} bit config${h.bits.length > 1 ? 's' : ''}`,
        bits: h.bits.map(b => bitCard(b, d)),
      })),
    })),
  }))
})

// 지원 목록(bit 노드) × 전체 축(응답 top-level) → 칩·막대.
// 미지원 항목은 축 자리에 회색으로 남는다 — 그래서 축이 응답 top-level이어야 한다(§13).
function bitCard(b, d) {
  const byVth = new Map(b.vths.map(v => [v.vth, v.cell_count]))
  const max = b.vths.length ? Math.max(...b.vths.map(v => v.cell_count)) : 1
  return {
    bit: `${b.bit_width}bit`,
    total: b.cell_count || '—',
    drives: d.drive_axis.map(label => ({ label, style: chipStyle(b.drives.includes(label)) })),
    nanosheets: d.nanosheet_axis.map(label => ({ label, style: chipStyle(b.nanosheets.includes(label)) })),
    vth: d.vth_axis.map(label => {
      const count = byVth.get(label)
      const present = count !== undefined
      return {
        label,
        present,
        count: present ? count : '—',
        barW: present ? Math.max(6, Math.round((count / max) * 100)) + '%' : '0%',
      }
    }),
  }
}
</script>

<template>
  <div class="tab-info">
    <div class="section-header">
      <span class="title">Library Info</span>
      <span class="sub mono">{{ fam.family }} · library {{ fam.libraries.length }}종</span>
      <div class="spacer"></div>
      <!-- Final Report의 .doc-header와 같은 자리(탭 상단, 우측)에 둔다 —
           탭마다 편집/저장 버튼 위치가 달랐다는 피드백 반영. 폭도 Final Report의
           .doc(max-width:1000px)에 맞춰서 너무 멀리 벌어지지 않게 한다. -->
      <button :class="editing ? 'btn-primary' : 'btn'" :disabled="locked" @click="actions.toggleInfoEdit()">{{ editing ? '저장' : '편집' }}</button>
    </div>

    <section class="block">
      <span class="block-title">PDK 버전 정보</span>
      <div class="tbl fit">
        <div class="row head" style="grid-template-columns:80px 96px 96px 96px;">
          <span>PROCESS</span><span>HSPICE</span><span>LVS</span><span>PEX</span>
        </div>
        <div class="row" style="grid-template-columns:80px 96px 96px 96px;">
          <span class="mono strong">{{ p.process }}</span><span class="mono">{{ p.hspice }}</span>
          <span class="mono">{{ p.lvs }}</span><span class="mono">{{ p.pex }}</span>
        </div>
      </div>
    </section>

    <section class="block">
      <span class="block-title">Library List</span>
      <div class="tbl fit" style="min-width:440px;">
        <div class="row head" style="grid-template-columns:120px minmax(320px,1fr);"><span>NAME</span><span>DESCRIPTION</span></div>
        <div v-for="l in libList" :key="l.id" class="row" style="grid-template-columns:120px minmax(320px,1fr); min-height:30px;">
          <span class="mono strong">{{ l.library }}</span>
          <input class="ghost-input" :value="l.desc" :disabled="locked" :placeholder="locked ? '' : '설명 입력'" @input="onDesc(l.library, $event)" />
        </div>
      </div>
    </section>

    <section class="block">
      <div class="block-title-row"><span class="block-title">Release Path</span><span class="sub mono">직접 입력</span></div>
      <div class="tbl fit" style="min-width:520px;">
        <div class="row head" style="grid-template-columns:120px minmax(280px,1fr) 120px;">
          <span>CELL HEIGHT</span><span>RELEASE PATH</span><span>GDS VERSION</span>
        </div>
        <div v-for="g in releaseGroups" :key="g.height" class="group-row">
          <div class="group-label mono strong">{{ g.height }}</div>
          <div class="group-body">
            <div v-for="r in g.rows" :key="r.id" class="row" :style="{ gridTemplateColumns: editing ? '1fr 120px 20px' : '1fr 120px' }">
              <template v-if="!editing">
                <span class="mono ellipsis">{{ r.path }}</span>
                <span class="mono">{{ r.gds }}</span>
              </template>
              <template v-else>
                <input class="ghost-input mono" :value="r.path" placeholder="/proj/lib/..." @input="actions.updateReleaseRow(r.id, { path: $event.target.value })" />
                <input class="ghost-input mono" :value="r.gds" placeholder="V1.0.0.0" @input="actions.updateReleaseRow(r.id, { gds: $event.target.value })" />
                <span class="remove-x" @click="actions.removeReleaseRow(r.id)">×</span>
              </template>
            </div>
            <div v-if="editing" class="add-row" @click="actions.addReleaseRowInGroup(g.height)">+ 행 추가</div>
          </div>
        </div>
      </div>
      <textarea v-if="editing" class="gds-desc" rows="2" placeholder="GDS VERSION 해석 안내를 입력하세요." :value="state.gdsDesc" @input="state.gdsDesc = $event.target.value"></textarea>
      <p v-else-if="state.gdsDesc" class="gds-desc-text">{{ state.gdsDesc }}</p>
    </section>

    <section class="block">
      <div class="block-title-row"><span class="block-title">Cell Design</span><span class="sub mono">library × 대표 셀 · cell height별 표</span></div>
      <div class="lib-design-list">
        <div v-for="lg in designLibs" :key="lg.id" class="lib-design">
          <div class="lib-design-head">
            <span class="mono strong">{{ lg.library }}</span>
            <span class="sub">대표 셀 {{ lg.repBlocks.length }}종</span>
          </div>
          <div class="rep-list">
            <div v-for="rb in lg.repBlocks" :key="rb.rep" class="rep-block">
              <div class="rep-head"><span class="dot"></span><span class="rep-name">{{ rb.rep }}</span></div>
              <div v-for="hr in rb.heightRows" :key="hr.height" class="height-row">
                <div class="height-label"><span class="mono strong">{{ hr.height }}</span><span class="sub">{{ hr.bitCount }}</span></div>
                <div class="bit-cards">
                  <div v-for="bt in hr.bits" :key="bt.bit" class="bit-card">
                    <div class="bit-card-head">
                      <span class="bit-name">{{ bt.bit }}</span>
                      <span><span class="mono accent">{{ bt.total }}</span> <span class="cells-lbl">cells</span></span>
                    </div>
                    <div class="bit-card-body">
                      <div class="axis-row">
                        <span class="axis-label">drive</span>
                        <div class="chips"><span v-for="d in bt.drives" :key="d.label" class="chip mono" :style="d.style">{{ d.label }}</span></div>
                      </div>
                      <div class="axis-row">
                        <span class="axis-label">nanosheet</span>
                        <div class="chips"><span v-for="n in bt.nanosheets" :key="n.label" class="chip mono" :style="n.style">{{ n.label }}</span></div>
                      </div>
                    </div>
                    <div class="vth-block">
                      <span class="axis-label">VTH · cells in top cell</span>
                      <div v-for="v in bt.vth" :key="v.label" class="vth-row">
                        <span class="mono" :style="{ color: v.present ? '#4a525c' : '#c2c9d2' }">{{ v.label }}</span>
                        <span class="bar-track"><span class="bar-fill" :style="{ width: v.barW }"></span></span>
                        <span class="mono" :style="{ color: v.present ? '#1c1f24' : '#c2c9d2' }">{{ v.count }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <span class="footnote">library × 대표 셀 블록 · cell height마다 지원 bit config가 다름 · 흐린 칩 = 미지원 · 막대 = top-cell 개수 (mock 데이터)</span>
    </section>
  </div>
</template>

<style scoped>
.tab-info { display:flex; flex-direction:column; gap:10px; padding:10px 12px 16px; }
.mono { font-family:'Roboto Mono',monospace; }
.strong { font-weight:500; }
.accent { color:#2f6fed; font-weight:600; }
.sub { font-size:10.5px; color:#a7afb9; }
.spacer { flex:1; }
.section-header { display:flex; align-items:center; gap:8px; max-width:1000px; }
.title { font-size:14px; font-weight:600; color:#1c1f24; }
.btn { display:flex; align-items:center; height:26px; padding:0 10px; border:1px solid #e2e5ea; border-radius:4px; background:#fff; font:inherit; font-size:11px; color:#6b7480; cursor:pointer; }
.btn:disabled { background:#f7f8fa; color:#c2c9d2; cursor:not-allowed; }
.btn-primary { display:flex; align-items:center; height:26px; padding:0 12px; border:0; border-radius:4px; background:#2f6fed; font:inherit; font-size:11px; font-weight:500; color:#fff; cursor:pointer; }
.btn-primary:disabled { background:#dfe3e8; cursor:not-allowed; }
.block { display:flex; flex-direction:column; gap:6px; }
.block-title { font-size:13px; font-weight:500; color:#1c1f24; }
.block-title-row { display:flex; align-items:center; gap:8px; }
.tbl { border:1px solid #eef0f3; border-radius:6px; overflow:hidden; }
.tbl.fit { width:max-content; }
.row { display:grid; column-gap:12px; align-items:center; height:28px; padding:0 12px; border-bottom:1px solid #f4f5f7; }
.row.head { background:#f7f8fa; border-bottom:1px solid #e2e5ea; font-size:10px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase; color:#8a929c; }
.ghost-input { width:100%; border:0; background:transparent; font:inherit; font-size:12px; color:#1c1f24; outline:none; }
.ellipsis { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding-right:12px; }
.group-row { display:flex; border-bottom:1px solid #f4f5f7; }
.group-label { width:120px; flex-shrink:0; display:flex; align-items:center; padding:0 12px; border-right:1px solid #eef0f3; font-size:11.5px; }
.group-body { flex:1; }
.group-body .row { border-bottom:1px solid #f4f5f7; height:26px; }
.remove-x { display:flex; justify-content:center; font-size:12px; color:#b6bec8; cursor:pointer; }
.add-row { display:flex; align-items:center; padding:0 12px; height:26px; font-size:10.5px; color:#8a929c; cursor:pointer; background:#fbfbfc; }
.gds-desc { width:100%; max-width:520px; font:inherit; font-size:11.5px; line-height:1.5; padding:6px 8px; border:1px solid #bcd0f7; border-radius:4px; outline:none; resize:vertical; }
.gds-desc-text { max-width:520px; margin:2px 0 0; font-size:11.5px; line-height:1.5; color:#4a525c; }
.lib-design-list { display:flex; flex-direction:column; gap:22px; }
.lib-design { display:flex; flex-direction:column; gap:12px; }
.lib-design-head { display:flex; align-items:center; gap:8px; padding-bottom:6px; border-bottom:1px solid #eef0f3; }
.lib-design-head .mono { font-size:12.5px; }
.rep-list { display:flex; flex-direction:column; gap:16px; }
.rep-block { display:flex; flex-direction:column; gap:12px; }
.rep-head { display:flex; align-items:center; gap:8px; }
.dot { width:6px; height:6px; border-radius:50%; background:#2f6fed; }
.rep-name { font-size:13px; font-weight:600; letter-spacing:-0.1px; color:#1c1f24; }
.height-row { display:flex; gap:14px; align-items:flex-start; }
.height-label { width:72px; flex-shrink:0; display:flex; flex-direction:column; gap:2px; padding-top:6px; }
.bit-cards { display:flex; gap:12px; flex-wrap:wrap; }
.bit-card { width:214px; display:flex; flex-direction:column; border:1px solid #e7eaee; border-radius:8px; background:#fff; overflow:hidden; box-shadow:0 1px 2px rgba(20,24,29,0.03); }
.bit-card-head { display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-bottom:1px solid #f1f3f6; font-size:12px; font-weight:600; }
.cells-lbl { font-size:9px; letter-spacing:0.3px; text-transform:uppercase; color:#b6bec8; }
.bit-card-body { display:flex; flex-direction:column; gap:8px; padding:10px 12px; border-bottom:1px solid #f1f3f6; }
.axis-row { display:flex; flex-direction:column; gap:4px; }
.axis-label { font-size:9px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase; color:#a7afb9; }
.chips { display:flex; gap:4px; flex-wrap:wrap; }
.chip { display:flex; align-items:center; height:19px; padding:0 7px; border-radius:5px; font-size:10px; }
.vth-block { display:flex; flex-direction:column; gap:5px; padding:10px 12px; }
.vth-row { display:grid; grid-template-columns:38px 1fr 30px; align-items:center; gap:7px; }
.bar-track { position:relative; height:5px; border-radius:3px; background:#f1f3f6; overflow:hidden; }
.bar-fill { position:absolute; left:0; top:0; bottom:0; background:#bcd0f7; border-radius:3px; }
.footnote { font-size:11px; color:#a7afb9; }
</style>
