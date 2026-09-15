<script setup>
import { computed } from 'vue'
import { releasePaths, CELL_DESIGN, VTH_ALL, NANOSHEET_ALL } from './data.js'

const props = defineProps({
  pdk: { type: Object, required: true },
  lib: { type: String, required: true },
})

const paths = computed(() => releasePaths(props.lib))
</script>

<template>
  <div class="info-body">
    <!-- Column order must match the PDK dropdown -->
    <section class="lr-section">
      <span class="lr-section-title">PDK 버전 정보</span>
      <div class="lr-box">
        <div class="lr-thead g-pdk">
          <span>PROCESS</span><span>HSPICE</span><span>LVS</span><span>PEX</span>
        </div>
        <div class="lr-row g-pdk">
          <span class="lr-mono v-pdk process">{{ pdk.process }}</span>
          <span class="lr-mono v-pdk">{{ pdk.hspice }}</span>
          <span class="lr-mono v-pdk">{{ pdk.lvs }}</span>
          <span class="lr-mono v-pdk">{{ pdk.pex }}</span>
        </div>
      </div>
    </section>

    <!-- Release Path and Cell Design match the wider table's width. -->
    <div class="lr-equal-width">
      <!-- One release path per Cell Height -->
      <section class="lr-section">
        <span class="lr-section-title">Release Path</span>
        <div class="lr-box">
          <div class="lr-thead g-path">
            <span>HEIGHT</span><span>RELEASE PATH</span><span>GDS VERSION</span>
          </div>
          <div v-for="r in paths" :key="r.height" class="lr-row g-path">
            <span class="lr-mono strong">{{ r.height }}</span>
            <span class="lr-mono lr-ellipsis">{{ r.path }}</span>
            <span class="lr-mono">{{ r.gds }}</span>
          </div>
        </div>
        <p class="lr-note">
          <span class="lr-note-tag">PLACEHOLDER</span>
          GDS VERSION 해석 안내가 들어갈 자리입니다. 실제 설명 문구는 추후 채워질 예정입니다.
        </p>
      </section>

      <!-- Only supported items are listed -->
      <section class="lr-section">
        <span class="lr-section-title">Cell Design</span>
        <div class="lr-box">
          <div class="lr-thead g-design">
            <span>HEIGHT</span><span>DRIVE STRENGTH</span><span>VTH</span><span>NANOSHEET</span><span class="lr-num">CELL COUNT</span>
          </div>
          <div v-for="r in CELL_DESIGN" :key="r.height" class="lr-row g-design">
            <span class="lr-mono strong">{{ r.height }}</span>
            <span class="lr-mono spaced">{{ r.drives }}</span>
            <span class="mini">
              <span
                v-for="v in VTH_ALL"
                :key="v"
                class="lr-mono mini-cell"
                :class="{ off: !r.vths.includes(v) }"
              >{{ v }}</span>
            </span>
            <span class="mini">
              <span
                v-for="n in NANOSHEET_ALL"
                :key="n"
                class="lr-mono mini-cell"
                :class="{ off: !r.nanosheet.includes(n) }"
              >{{ n }}</span>
            </span>
            <span class="lr-mono lr-num strong">{{ r.cells }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.info-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px 16px;
}

/* Column widths are fixed to comfortably fit the longest value in that
   column. Header and row divs are separate grids sharing the same class, so
   widths must be fixed px (not max-content) or the header and body columns
   drift out of alignment with each other. Release Path's middle column flexes
   (1fr) so it absorbs the extra width when the table is stretched to match
   the wider Cell Design table. */
.g-pdk    { grid-template-columns: 80px 96px 96px 96px; column-gap: 28px; }
.g-path   { grid-template-columns: 72px minmax(230px, 1fr) 96px; column-gap: 20px; }
.g-design { grid-template-columns: 72px 150px 200px 170px 90px; column-gap: 20px; }

/* Standalone tables (PDK) hug their own content width. */
.lr-box { width: max-content; }

/* Release Path + Cell Design share one max-content column, so both size to
   whichever is intrinsically wider (Cell Design). The smaller one stretches
   to fill via its flexible RELEASE PATH column. */
.lr-equal-width {
  display: grid;
  grid-template-columns: max-content;
  row-gap: 10px;
}
.lr-equal-width .lr-box { width: auto; }
/* Cap the note so its long text doesn't drive the shared column width. */
.lr-equal-width .lr-note { max-width: 480px; }

.g-design .lr-row {
  height: auto;
  min-height: 30px;
  padding-top: 4px;
  padding-bottom: 4px;
}

.v-pdk { font-size: 12px; }
.process { font-weight: 500; }
.strong { font-weight: 500; }

.spaced {
  word-spacing: 2px;
}
.lr-note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0 0;
  padding: 6px 10px;
  border: 1px dashed #d5d9de;
  border-radius: 4px;
  font-size: 11px;
  font-style: italic;
  line-height: 1.5;
  color: #a7afb9;
}
.lr-note-tag {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 3px;
  background: #f1f3f6;
  font-family: var(--clara-mono);
  font-size: 9px;
  font-style: normal;
  font-weight: 600;
  letter-spacing: 0.4px;
  color: #a7afb9;
}
/* VTH / Nanosheet mini table: a fixed 5-cell row with collapsed inner
   borders, so it reads as a small table rather than loose chips. Supported
   values render dark; unsupported ones grey out in place. */
.mini {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  width: 100%;
  border: 1px solid #e2e5ea;
  border-radius: 4px;
  overflow: hidden;
}
.mini-cell {
  padding: 3px 4px;
  text-align: center;
  border-right: 1px solid #eef0f3;
  color: #1c1f24;
}
.mini-cell:last-child { border-right: 0; }
.mini-cell.off {
  color: #c2c9d2;
  background: #fafbfc;
}
</style>
