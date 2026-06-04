<template>
  <v-container class="random-page" fluid :style="pageBackgroundStyle">
    <div class="random-shell">
      <div class="page-toolbar">
        <div>
          <div class="text-overline text-medium-emphasis">Random Image</div>
          <h1 class="text-h4 font-weight-bold">随机图片</h1>
        </div>

        <v-btn
          color="primary"
          :loading="loading"
          :prepend-icon="mdiRefresh"
          variant="flat"
          @click="getImage"
        >
          下一张
        </v-btn>
      </div>

      <v-alert
        v-if="error"
        class="mb-4"
        closable
        color="error"
        variant="tonal"
        @click:close="error = ''"
      >
        {{ error }}
      </v-alert>

      <div v-if="loading && !image" class="random-layout">
        <v-skeleton-loader class="image-skeleton" type="image"></v-skeleton-loader>
        <v-skeleton-loader class="info-skeleton" type="heading, subtitle, list-item-three-line, list-item-three-line, actions"></v-skeleton-loader>
      </div>

      <div
        v-else-if="image"
        class="random-layout"
        :class="{ 'has-portrait-image': isPortraitImage }"
        :style="imagePanelStyle"
      >
        <section class="image-panel" :class="{ 'is-portrait-image': isPortraitImage }" :style="imagePanelStyle">
          <v-img
            :alt="displayTitle"
            :aspect-ratio="image.aspect_ratio || 1"
            class="preview-image"
            :cover="false"
            :lazy-src="previewUrl"
            :src="image.src"
            :style="previewStyle"
            @load="image.loaded = true"
          >
            <template v-slot:placeholder v-if="!image.loaded">
              <div class="d-flex align-center justify-center fill-height">
                <v-progress-circular color="primary" indeterminate></v-progress-circular>
              </div>
            </template>
          </v-img>
        </section>

        <section class="info-panel">
          <div class="info-header">
            <div class="title-block">
              <div class="eyebrow-row">
                <span class="text-overline text-medium-emphasis">Image info</span>
                <v-chip v-if="image.accessible !== undefined" :color="image.accessible ? 'success' : 'error'" label size="small">
                  {{ image.accessible ? '可访问' : '不可访问' }}
                </v-chip>
              </div>
              <h2 class="title-text">{{ displayTitle }}</h2>
              <div class="text-body-2 text-medium-emphasis">{{ authorName }}</div>
            </div>

            <div class="header-actions">
              <v-tooltip text="打开原图" location="top">
                <template v-slot:activator="{ props }">
                  <v-btn
                    v-bind="props"
                    :disabled="!image.src"
                    :icon="mdiOpenInNew"
                    variant="tonal"
                    @click="openExternalUrl(image.src)"
                  ></v-btn>
                </template>
              </v-tooltip>

              <v-tooltip text="打开来源" location="top">
                <template v-slot:activator="{ props }">
                  <v-btn
                    v-bind="props"
                    :disabled="!image.source_url"
                    :icon="mdiLinkVariant"
                    variant="tonal"
                    @click="openExternalUrl(image.source_url || '')"
                  ></v-btn>
                </template>
              </v-tooltip>

              <v-tooltip text="复制图片地址" location="top">
                <template v-slot:activator="{ props }">
                  <v-btn
                    v-bind="props"
                    :disabled="!image.src"
                    :icon="mdiContentCopy"
                    variant="tonal"
                    @click="copyImageUrl"
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
              <div>LAB: {{ color.lab.map(value => value.toFixed(1)).join(', ') }}</div>
            </div>
            </v-tooltip>
          </div>

          <dl class="meta-grid">
            <div v-for="row in metadataRows" :key="row.label" class="meta-item">
              <dt>{{ row.label }}</dt>
              <dd>{{ row.value }}</dd>
            </div>
          </dl>

          <template v-if="tagPreview.length">
            <div class="section-label">
              <v-icon :icon="mdiTagMultipleOutline" size="small"></v-icon>
              <span>标签</span>
            </div>
            <div class="tag-row">
              <v-chip
                v-for="tag in tagPreview"
                :key="tag.id ?? tag.name"
                class="tag-chip"
                label
                size="small"
                variant="tonal"
              >
                <span>{{ tag.name }}</span>
                <span v-if="tag.translated_name" class="tag-subtitle">{{ tag.translated_name }}</span>
              </v-chip>
              <v-chip v-if="remainingTagCount" label size="small" variant="outlined">
                +{{ remainingTagCount }}
              </v-chip>
            </div>
          </template>

          <template v-if="image.primary_color">
            <div class="section-label">
              <v-icon :icon="mdiPaletteOutline" size="small"></v-icon>
              <span>主色</span>
            </div>
            <div class="primary-color-row">
              <span class="primary-color-swatch" :style="{ backgroundColor: primaryColorCss }"></span>
              <div>
                <div class="text-body-2 font-weight-medium">{{ primaryColorCss }}</div>
                <div class="text-caption text-medium-emphasis">
                  LAB {{ image.primary_color.lab.map(value => value.toFixed(1)).join(', ') }}
                </div>
              </div>
            </div>
          </template>
        </section>
      </div>
    </div>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="top" timeout="2200">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useTheme } from 'vuetify';
import {
  mdiContentCopy,
  mdiLinkVariant,
  mdiOpenInNew,
  mdiPaletteOutline,
  mdiRefresh,
  mdiTagMultipleOutline,
} from '@mdi/js';
import Axios from '../axios/axios';
import type { Author, ImageTag } from '../types/api';
import {
  normalizeColorPalette,
  normalizePrimaryColor,
  type PaletteColor,
  type PrimaryColor,
} from '../utils/colorNormalization';
import { openExternalUrl } from '../utils/url';

interface RandomImageResponse {
  accessible?: boolean;
  aspect_ratio?: number;
  author?: Author;
  colors?: { colors: PaletteColor[] };
  height?: number;
  id: number;
  loaded?: boolean;
  primary_color?: PrimaryColor | null;
  source_id?: number | string;
  source_url?: string;
  src: string;
  tags?: ImageTag[];
  title?: string;
  width?: number;
}

const image = ref<RandomImageResponse | null>(null);
const loading = ref(false);
const error = ref('');
const snackbar = ref({
  color: 'success',
  show: false,
  text: '',
});
const theme = useTheme();

const DARK_BACKGROUND_L_THRESHOLD = 18;
const LIGHT_BACKGROUND_L_THRESHOLD = 96;

const displayTitle = computed(() => image.value?.title?.trim() || '未命名图片');
const authorName = computed(() => image.value?.author?.name || '未知作者');
const previewUrl = computed(() => image.value?.src ? `${image.value.src}/scale_to_1080x1080` : undefined);
const isPortraitImage = computed(() => (image.value?.aspect_ratio ?? 1) < 1);
const tagPreview = computed(() => image.value?.tags?.slice(0, 12) ?? []);
const remainingTagCount = computed(() => Math.max(0, (image.value?.tags?.length ?? 0) - tagPreview.value.length));
const paletteColors = computed(() => image.value?.colors?.colors ?? []);
const primaryColorCss = computed(() => image.value?.primary_color ? toRgb(image.value.primary_color.rgb) : '');
const pageBaseColor = computed(() => {
  const colors = paletteColors.value;
  if (!colors.length) return '';

  const selected = colors.length
    ? theme.global.current.value.dark
      ? colors[0]
      : colors[colors.length - 1]
    : undefined;

  if (!selected) return '';

  const lab = [...selected.lab] as [number, number, number];
  if (theme.global.current.value.dark && lab[0] > DARK_BACKGROUND_L_THRESHOLD) {
    lab[0] = DARK_BACKGROUND_L_THRESHOLD;
  }
  if (!theme.global.current.value.dark && lab[0] < LIGHT_BACKGROUND_L_THRESHOLD) {
    lab[0] = LIGHT_BACKGROUND_L_THRESHOLD;
  }

  return toRgb(labToRgb(lab));
});
const imagePanelStyle = computed(() => ({
  '--image-ratio': String(image.value?.aspect_ratio || 1),
}));
const pageBackgroundStyle = computed(() => {
  if (!pageBaseColor.value) return {};

  return {
    background: `linear-gradient(rgba(var(--v-theme-background), 0.72), rgba(var(--v-theme-background), 0.72)), ${pageBaseColor.value}`,
  };
});
const previewStyle = computed(() => ({
  backgroundColor: image.value?.primary_color
    ? `rgba(${image.value.primary_color.rgb[0]}, ${image.value.primary_color.rgb[1]}, ${image.value.primary_color.rgb[2]}, 0.42)`
    : 'rgba(var(--v-theme-surface-variant), 0.35)',
}));

const metadataRows = computed(() => {
  const current = image.value;
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

const labToRgb = (lab: [number, number, number]): [number, number, number] => {
  const [l, a, b] = lab;
  const referenceWhite = [95.047, 100, 108.883];
  const y = (l + 16) / 116;
  const x = a / 500 + y;
  const z = y - b / 200;

  const xyz = [x, y, z].map((value, index) => {
    const cubed = value ** 3;
    const normalized = cubed > 0.008856
      ? cubed
      : (value - 16 / 116) / 7.787;
    return (normalized * referenceWhite[index]) / 100;
  });

  const linearRgb = [
    xyz[0] * 3.2406 + xyz[1] * -1.5372 + xyz[2] * -0.4986,
    xyz[0] * -0.9689 + xyz[1] * 1.8758 + xyz[2] * 0.0415,
    xyz[0] * 0.0557 + xyz[1] * -0.2040 + xyz[2] * 1.0570,
  ];

  return linearRgb.map((value) => {
    const corrected = value <= 0.0031308
      ? 12.92 * value
      : 1.055 * (value ** (1 / 2.4)) - 0.055;
    return Math.round(Math.min(255, Math.max(0, corrected * 255)));
  }) as [number, number, number];
};

const formatResolution = (width?: number, height?: number) => {
  if (!width || !height) return undefined;
  return `${width} x ${height}`;
};

const formatRatio = (ratio?: number) => {
  if (typeof ratio !== 'number') return undefined;
  return ratio.toFixed(3);
};

const showSnackbar = (text: string, color = 'success') => {
  snackbar.value = { color, show: true, text };
};

const getErrorMessage = (exception: unknown) => {
  const maybeAxiosError = exception as { response?: { data?: { message?: string } } };
  return maybeAxiosError.response?.data?.message
    || (exception instanceof Error ? exception.message : '')
    || '加载随机图片失败';
};

const getImage = async () => {
  loading.value = true;
  error.value = '';

  try {
    const res = await Axios.get('/');
    const data = res.data as RandomImageResponse;
    normalizeColorPalette(data);
    data.primary_color = normalizePrimaryColor(data.primary_color);
    data.loaded = false;
    image.value = data;
  } catch (exception) {
    error.value = getErrorMessage(exception);
  } finally {
    loading.value = false;
  }
};

const copyImageUrl = async () => {
  if (!image.value?.src) return;

  try {
    await navigator.clipboard.writeText(image.value.src);
    showSnackbar('图片地址已复制');
  } catch {
    showSnackbar('复制失败', 'error');
  }
};

onMounted(() => {
  getImage();
});
</script>

<style scoped lang="scss">
.random-page {
  min-height: calc(100vh - var(--v-layout-top, 64px));
  max-width: none;
  padding: 0;
  transition: background 0.28s ease;
  width: 100%;
}

.random-shell {
  max-width: 1320px;
  margin: 0 auto;
  padding: 2rem clamp(1rem, 3vw, 2.5rem) 3rem;
  width: 100%;
}

.page-toolbar {
  align-items: center;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.random-layout {
  align-items: start;
  display: grid;
  gap: 1.25rem;
  grid-template-columns: minmax(0, 1fr) minmax(20rem, 25rem);
  width: 100%;
}

.image-panel {
  align-items: center;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.preview-image {
  border-radius: 8px;
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.24), 0 2px 8px rgba(0, 0, 0, 0.16);
  overflow: hidden;
  width: min(
    100%,
    calc((100vh - var(--v-layout-top, 64px) - 9rem) * var(--image-ratio))
  );
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

.image-skeleton,
.info-skeleton {
  border-radius: 8px;
}

.info-panel {
  position: sticky;
  top: calc(var(--v-layout-top, 64px) + 1rem);
}

.info-header {
  align-items: flex-start;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  padding-bottom: 0.8rem;
}

.title-block {
  min-width: 0;
}

.eyebrow-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.15rem;
}

.title-text {
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.25;
  margin: 0;
  white-space: normal;
  word-break: break-word;
}

.header-actions {
  align-items: center;
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-left: 1rem;
}

.meta-grid {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  display: grid;
  gap: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag-chip {
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

.image-skeleton {
  height: min(72vh, 52rem);
}

@media (max-width: 960px) {
  .random-layout {
    grid-template-columns: 1fr;
  }

  .info-panel {
    position: static;
  }
}

@media (orientation: landscape) and (min-width: 961px) {
  .random-layout.has-portrait-image {
    --landscape-focus-height: max(18rem, calc(100vh - 17rem));
    align-items: stretch;
    gap: clamp(2rem, 4vw, 4.5rem);
    grid-template-columns:
      minmax(0, calc(var(--landscape-focus-height) * var(--image-ratio)))
      minmax(24rem, 1fr);
  }

  .random-layout.has-portrait-image .image-panel {
    align-items: flex-start;
    justify-content: flex-start;
    width: 100%;
  }

  .image-panel.is-portrait-image .preview-image {
    height: var(--landscape-focus-height);
    max-height: var(--landscape-focus-height);
    width: 100%;
  }

  .random-layout.has-portrait-image .info-panel {
    height: var(--landscape-focus-height);
    justify-self: stretch;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    width: 100%;
  }
}

@media (orientation: portrait) {
  .preview-image {
    width: 100%;
  }

  .info-panel {
    padding: 0.35rem 0.25rem 0;
  }
}

@media (max-width: 600px) {
  .random-shell {
    padding: 1rem 0.75rem 2rem;
  }

  .page-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .page-toolbar .v-btn {
    align-self: flex-start;
  }

  .meta-grid {
    grid-template-columns: 1fr;
  }

  .header-actions {
    margin-left: 0;
    margin-top: 0.75rem;
    width: 100%;
  }
}
</style>
