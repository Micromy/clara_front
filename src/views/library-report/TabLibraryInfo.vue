<script setup>
import { computed } from 'vue'
import { releasePaths, CELL_DESIGN } from './data.js'

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
    </section>

    <!-- Only supported items are listed; rows may wrap -->
    <section class="lr-section">
      <span class="lr-section-title">Cell Design</span>
      <div class="lr-box">
        <div class="lr-thead g-design">
          <span>HEIGHT</span><span>DRIVE STRENGTH</span><span>VTH</span><span>NANOSHEET</span>
        </div>
        <div v-for="r in CELL_DESIGN" :key="r.height" class="lr-row g-design wrap">
          <span class="lr-mono strong">{{ r.height }}</span>
          <span class="lr-mono spaced">{{ r.drives }}</span>
          <span class="lr-mono spaced">{{ r.vths }}</span>
          <span class="lr-mono spaced">{{ r.nanosheet }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.info-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 14px 12px 20px;
}

.g-pdk    { grid-template-columns: repeat(4, minmax(120px, 1fr)); min-width: 520px; }
.g-path   { grid-template-columns: 96px minmax(320px, 1fr) 116px; min-width: 620px; }
.g-design { grid-template-columns: 96px minmax(200px, 1.2fr) minmax(160px, 0.9fr) minmax(150px, 0.9fr); min-width: 660px; }

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
  padding-right: 12px;
}
</style>
