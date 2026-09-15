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
      <div class="lr-box pdk-box">
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

    <!-- Release Path and Cell Design share one width track so both size to
         the wider of the two, driven by content rather than a hardcoded px. -->
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
          GDS VERSION은 해당 Release Path에 배포된 레이아웃(GDS) 스냅샷의 버전입니다.
          <span class="lr-mono">V&lt;major&gt;.&lt;minor&gt;.&lt;patch&gt;.&lt;build&gt;</span> 형식이며,
          값이 높을수록 최신 릴리스입니다. Cell Height마다 릴리스 시점이 달라 버전이 서로 다를 수 있습니다.
        </p>
      </section>

      <!-- Only supported items are listed; rows may wrap -->
      <section class="lr-section">
        <span class="lr-section-title">Cell Design</span>
        <div class="lr-box">
          <div class="lr-thead g-design">
            <span>HEIGHT</span><span>DRIVE STRENGTH</span><span>VTH</span><span>NANOSHEET</span><span class="lr-num">CELL COUNT</span>
          </div>
          <div v-for="r in CELL_DESIGN" :key="r.height" class="lr-row g-design wrap">
            <span class="lr-mono strong">{{ r.height }}</span>
            <span class="lr-mono spaced">{{ r.drives }}</span>
            <span class="axis">
              <span
                v-for="v in VTH_ALL"
                :key="v"
                class="lr-mono chip"
                :class="{ off: !r.vths.includes(v) }"
              >{{ v }}</span>
            </span>
            <span class="axis">
              <span
                v-for="n in NANOSHEET_ALL"
                :key="n"
                class="lr-mono chip"
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
   column (not stretched to fill the box). Header and row divs are separate
   grids sharing the same class, so widths must be fixed px (not max-content)
   or the header and body columns drift out of alignment with each other.
   justify-content: space-between spreads any leftover space (from matching
   the wider sibling table in .lr-equal-width) across the gaps between
   columns instead of dumping it all after the last column. */
.g-pdk    { grid-template-columns: 80px 96px 96px 96px; column-gap: 28px; }
.g-path   { grid-template-columns: 72px minmax(230px, 320px) 96px; column-gap: 20px; justify-content: space-between; }
.g-design { grid-template-columns: 72px 150px 150px 130px 90px; column-gap: 20px; justify-content: space-between; }

/* Box shrinks to its own content instead of stretching to the section width. */
.pdk-box { width: max-content; }

/* Release Path and Cell Design sit in one grid column so both stretch to
   whichever is intrinsically wider, staying content-driven either way. */
.lr-equal-width {
  display: grid;
  grid-template-columns: max-content;
  row-gap: 10px;
}

.v-pdk { font-size: 12px; }
.process { font-weight: 500; }
.strong { font-weight: 500; }

.wrap {
  height: auto;
  align-items: start;
  padding: 6px 12px;
}
.wrap .lr-mono { line-height: 20px; }
.spaced {
  word-spacing: 2px;
}
.lr-note {
  margin: 6px 2px 0;
  font-size: 11px;
  line-height: 1.6;
  color: #8a929c;
}
.lr-note .lr-mono {
  font-size: 10.5px;
  color: #6b7480;
}
.axis {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chip {
  min-width: 34px;
  padding: 1px 6px;
  text-align: center;
  border: 1px solid #e2e5ea;
  border-radius: 3px;
  color: #1c1f24;
}
.chip.off {
  color: #c8d0d9;
  border-color: #f0f2f4;
  background: #fafbfc;
}
</style>
