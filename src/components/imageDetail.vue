<template>
  <div v-if="loading" class="d-flex align-center justify-center" style="height: 100%;">
    <v-progress-circular color="blue-lighten-4" indeterminate size="64"></v-progress-circular>
  </div>
  <div v-else-if="error" class="d-flex flex-column align-center justify-center" style="height: 100%; gap: 1rem;">
    <v-icon color="error" size="48">mdi-alert-circle-outline</v-icon>
    <div class="text-body-1 text-error">{{ error }}</div>
    <v-btn variant="outlined" @click="getImageDetail">Retry</v-btn>
  </div>
  <v-card class="detail-card" v-else-if="imageDetailData">
    <v-btn
      class="detail-close-btn"
      :icon="mdiClose"
      size="small"
      variant="tonal"
      @click="emit('close')"
    ></v-btn>
    <div
      class="detail-layout"
      :class="{ 'is-wide-image': imageDetailData.aspect_ratio >= 1.25 }"
      :style="{ '--image-ratio': imageDetailData.aspect_ratio || 1 }"
    >
      <div class="img-container">
      <v-img :lazy-src="imageDetailData.src + '/scale_to_1080x1080'" :aspect-ratio="imageDetailData.aspect_ratio || 1"
        class="detail-image" :src="imageDetailData.src" @load="imageDetailData.loaded = true">
        <template v-slot:placeholder v-if="!imageDetailData.loaded">
          <div class="d-flex align-center justify-center fill-height">
            <v-progress-circular color="blue-lighten-4" indeterminate></v-progress-circular>
          </div>
        </template>
      </v-img>
      </div>
      <section class="info-panel">
      <div class="info-header">
        <div class="title-block">
          <div class="text-overline text-medium-emphasis">Image info</div>
          <h1 class="title-text">{{ imageDetailData.title }}</h1>
          <div class="text-body-2 text-medium-emphasis">{{ imageDetailData.author?.name }}</div>
        </div>

        <div class="header-actions">
          <v-tooltip text="打开原图" location="top">
            <template v-slot:activator="{ props }">
              <v-btn
                v-bind="props"
                :disabled="!imageDetailData.src"
                :icon="mdiOpenInNew"
                variant="tonal"
                @click="openExternalUrl(imageDetailData.src)"
              ></v-btn>
            </template>
          </v-tooltip>

          <v-tooltip text="打开来源" location="top">
            <template v-slot:activator="{ props }">
              <v-btn
                v-bind="props"
                :disabled="!imageDetailData.source_url"
                :icon="mdiLinkVariant"
                variant="tonal"
                @click="openExternalUrl(imageDetailData.source_url)"
              ></v-btn>
            </template>
          </v-tooltip>

          <v-tooltip text="画师主页" location="top">
            <template v-slot:activator="{ props }">
              <v-btn
                v-bind="props"
                :disabled="!imageDetailData.author?.platform_id"
                :icon="mdiAccountBoxOutline"
                variant="tonal"
                @click="openExternalUrl(`https://www.pixiv.net/users/${imageDetailData.author.platform_id}`)"
              ></v-btn>
            </template>
          </v-tooltip>
        </div>
      </div>

      <div v-if="paletteColors.length" class="palette-strip" aria-label="图片颜色">
        <v-tooltip
          v-for="(color, index) in paletteColors"
          :key="`${color.rgb.join('-')}-${index}`"
          location="top"
          open-on-click
        >
          <template v-slot:activator="{ props }">
            <span
              v-bind="props"
              class="palette-swatch"
              :style="{ backgroundColor: toRgb(color.rgb) }"
            >
              <span class="palette-hex" :style="{ color: getReadableTextColor(color.rgb) }">
                {{ toHex(color.rgb) }}
              </span>
            </span>
          </template>
          <div class="color-tooltip">
            <div>HEX: {{ toHex(color.rgb) }}</div>
            <div>RGB: {{ color.rgb.join(', ') }}</div>
            <div>LAB: {{ color.lab.map((v: number) => v.toFixed(1)).join(', ') }}</div>
          </div>
        </v-tooltip>
      </div>

      <dl class="meta-grid">
        <div v-for="row in metadataRows" :key="row.label" class="meta-item">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>

      <div v-if="imageDetailData.tags?.length || imageDetailData.primary_color" class="detail-extra-grid">
        <div v-if="imageDetailData.tags?.length" class="extra-section tags-section">
          <div class="section-label">
            <v-icon :icon="mdiTagMultipleOutline" size="small"></v-icon>
            <span>标签</span>
          </div>
          <div class="tag-row">
            <v-chip
              v-for="tag of imageDetailData.tags"
              :key="tag.id ?? tag.name"
              class="tag-chip"
              label
              size="small"
              variant="tonal"
            >
              <span>{{ tag.name }}</span>
              <span v-if="tag.translated_name" class="tag-subtitle">{{ tag.translated_name }}</span>
            </v-chip>
          </div>
        </div>

        <div v-if="imageDetailData.primary_color" class="extra-section primary-section">
          <div class="section-label">
            <v-icon :icon="mdiPaletteOutline" size="small"></v-icon>
            <span>主色</span>
          </div>
          <div class="primary-color-row">
            <span class="primary-color-swatch" :style="{ backgroundColor: toRgb(imageDetailData.primary_color.rgb) }"></span>
            <div>
              <div class="text-body-2 font-weight-medium">{{ toRgb(imageDetailData.primary_color.rgb) }}</div>
              <div class="text-caption text-medium-emphasis">
                LAB {{ imageDetailData.primary_color.lab.map((v: number) => v.toFixed(1)).join(', ') }}
              </div>
            </div>
          </div>
        </div>
      </div>
      </section>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import {
  mdiAccountBoxOutline,
  mdiClose,
  mdiLinkVariant,
  mdiOpenInNew,
  mdiPaletteOutline,
  mdiTagMultipleOutline,
} from '@mdi/js';
import Axios from '../axios/axios';
import { normalizeColorPalette, normalizePrimaryColor } from '../utils/colorNormalization';
import { computeImageDisplaySize } from '../utils/imageSizing';
import { openExternalUrl } from '../utils/url';

const props = defineProps<{
  imageId: string;
}>();
const emit = defineEmits<{
  close: [];
}>();

const imageDetailData = ref();
const imgShowWidth = ref();
const imgShowHeight = ref();
const loading = ref(false);
const error = ref('');

const paletteColors = computed(() => imageDetailData.value?.colors?.colors ?? []);

const metadataRows = computed(() => {
  const current = imageDetailData.value;
  if (!current) return [];

  return [
    { label: '图片 ID', value: current.id },
    { label: '分辨率', value: formatResolution(current.width, current.height) },
    { label: '宽高比', value: formatRatio(current.aspect_ratio) },
    { label: '来源 ID', value: current.source_id },
    { label: '作者 username', value: current.author?.name },
    { label: '平台用户 ID', value: current.author?.platform_id },
  ].filter(row => row.value !== undefined && row.value !== null && row.value !== '');
});

const toRgb = (rgb: [number, number, number]) => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

const toHex = (rgb: [number, number, number]) =>
  `#${rgb.map(value => Math.round(value).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

const getReadableTextColor = (rgb: [number, number, number]) =>
  getRelativeLuminance(rgb) > 0.48 ? '#111111' : '#FFFFFF';

const getRelativeLuminance = (rgb: [number, number, number]) => {
  const [r, g, b] = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const formatResolution = (width?: number, height?: number) => {
  if (!width || !height) return undefined;
  return `${width} x ${height}`;
};

const formatRatio = (ratio?: number) => {
  if (typeof ratio !== 'number') return undefined;
  return ratio.toFixed(3);
};

const getImageDetail = async () => {
  loading.value = true;
  error.value = '';
  imageDetailData.value = null;
  try {
    const res = await Axios.get(`/image/${props.imageId}`);
    const d = res.data
    normalizeColorPalette(d)
    d.primary_color = normalizePrimaryColor(d.primary_color)
    imageDetailData.value = d;
    const { width, height } = computeImageDisplaySize(imageDetailData.value.aspect_ratio);
    imgShowWidth.value = width;
    imgShowHeight.value = height;
  } catch (e: any) {
    error.value = e?.message || 'Failed to load image detail';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  getImageDetail();
});

watch(() => props.imageId, () => {
  getImageDetail();
});
</script>

<style scoped lang="scss">
.image {
  margin: 0.5rem;
  border-radius: 0.4rem;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.13s, filter 0.13s;
  width: auto;
}

.image:hover {
  transform: scale(1.01);
}

.container {
  width: auto;
}

.inner-container {
  user-select: none;
  -moz-user-select: none;
  display: flex;
  justify-content: flex-end;
  flex-direction: column;
  padding: 0.2rem 0.5rem;
  width: 100%;
  color: rgb(var(--v-theme-background));
  background: linear-gradient(to top,
      rgba(var(--v-theme-on-surface), 0.8),
      rgba(var(--v-theme-on-surface), 0));
}


.detail-card {
  border-radius: 8px;
  max-height: min(92vh, 64rem);
  max-width: min(98vw, 82rem);
  overflow: hidden;
  position: relative;
  width: max-content;
}

.detail-close-btn {
  backdrop-filter: blur(10px);
  background: rgba(0, 0, 0, 0.38) !important;
  color: #fff !important;
  display: none;
  position: absolute;
  right: 0.75rem;
  top: 0.75rem;
  z-index: 4;
}

.detail-close-btn :deep(.v-icon) {
  color: #fff !important;
}

.detail-layout {
  display: grid;
  gap: 0;
  grid-template-columns: auto minmax(20rem, 26rem);
  max-height: min(92vh, 64rem);
  overflow: auto;
  overscroll-behavior: contain;
}

.detail-layout.is-wide-image {
  grid-template-columns: minmax(0, 1fr);
  width: min(92vw, 82rem);
}

.detail-layout.is-wide-image .info-panel {
  width: 100%;
}

.detail-layout.is-wide-image .detail-image {
  border-radius: 8px 8px 0 0;
  width: 100%;
}

.img-container {
  display: flex;
  flex-direction: column;
  justify-items: end;
  min-width: 0;
  padding: 0;
}

.detail-image {
  border-radius: 8px 0 0 8px;
  max-height: calc(92vh - 2rem);
  max-width: 100%;
  overflow: hidden;
  width: min(52vw, calc((92vh - 2rem) * var(--image-ratio, 1)));
}

.info-panel {
  align-self: start;
  min-width: 20rem;
  padding: 1rem;
  max-height: 100%;
  height: auto;
}

.info-header {
  align-items: flex-start;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  padding-bottom: 0.8rem;
}

.title-block {
  flex: 1 1 auto;
  min-width: 0;
}

.title-text {
  display: -webkit-box;
  font-size: 1.35rem;
  font-weight: 700;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-height: 1.25;
  margin: 0;
  overflow: hidden;
  white-space: normal;
  word-break: break-word;
}

.title-block .text-body-2 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-actions {
  align-items: center;
  display: flex;
  flex-shrink: 0;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-left: 1rem;
  white-space: nowrap;
}

.palette-strip {
  display: grid;
  gap: 0.35rem;
  grid-template-columns: repeat(auto-fit, minmax(1.8rem, 1fr));
  margin-top: 0.25rem;
  width: 100%;
}

.palette-swatch {
  align-items: center;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.14);
  border-radius: 4px;
  container-type: inline-size;
  display: flex;
  height: 1.5rem;
  justify-content: center;
  min-width: 0;
}

.palette-hex {
  display: none;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
  overflow: hidden;
  padding-inline: 0.25rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@container (min-width: 4rem) {
  .palette-hex {
    display: inline;
  }
}

.meta-grid {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  display: grid;
  gap: 0;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  margin: 0.9rem 0 1rem;
  padding: 0.45rem 0;
}

.meta-item {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
  padding: 0.45rem 0.75rem 0.45rem 0;
}

.meta-item dt {
  color: rgba(var(--v-theme-on-surface), 0.58);
  font-size: 0.75rem;
}

.meta-item dd {
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1.3;
  margin: 0;
  overflow-wrap: anywhere;
}

.section-label {
  align-items: center;
  color: rgba(var(--v-theme-on-surface), 0.7);
  display: flex;
  font-size: 0.875rem;
  font-weight: 600;
  gap: 0.4rem;
  margin: 0.95rem 0 0.55rem;
}

.detail-extra-grid {
  align-items: start;
  display: grid;
  gap: 1rem 1.25rem;
  grid-template-columns: minmax(18rem, 1fr) minmax(14rem, auto);
}

.extra-section .section-label {
  margin-top: 0;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag-chip {
  border-radius: 4px;
  max-width: 100%;
}

.tag-subtitle {
  color: rgba(var(--v-theme-on-surface), 0.58);
  margin-left: 0.35rem;
}

.primary-color-row {
  align-items: center;
  display: flex;
  gap: 0.75rem;
}

.primary-color-swatch {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.18);
  border-radius: 6px;
  display: block;
  height: 2.5rem;
  width: 2.5rem;
}

.color-tooltip {
  font-size: 0.75rem;
  line-height: 1.45;
  white-space: nowrap;
}

.fab {
  position: fixed;
  bottom: 5rem;
  right: 5rem;
}

.filter-card {
  padding: 1rem;
}

@media (max-width: 760px) {
  .detail-card {
    max-height: calc(100dvh - 1rem);
    max-width: calc(100vw - 1rem);
    width: calc(100vw - 1rem);
  }

  .detail-layout,
  .detail-layout.is-wide-image {
    grid-template-columns: minmax(0, 1fr);
    max-height: calc(100dvh - 1rem);
  }

  .detail-close-btn {
    display: inline-flex;
  }

  .detail-image {
    border-radius: 8px 8px 0 0;
    max-height: none;
    width: 100%;
  }

  .info-panel {
    min-width: 0;
    padding: 1rem;
    width: 100%;
  }

  .header-actions {
    margin-left: 0.75rem;
  }

  .meta-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .detail-extra-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
