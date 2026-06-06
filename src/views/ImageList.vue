<script setup lang="ts">
import Axios from "../axios/axios";
import { isAxiosError } from "axios";
import { onMounted, onUnmounted, ref, nextTick } from 'vue';
import { useUserStore } from "../store/store";
import { mdiFilterOutline } from "@mdi/js";
import { normalizePrimaryColor } from "../utils/colorNormalization";
import type { PrimaryColor } from "../utils/colorNormalization";
import ImageDetail from '../components/imageDetail.vue';
import type { Author, TagCatalogEntry } from "../types/api";
const store = useUserStore()

const snackbar = ref({ show: false, text: '', color: 'error' })
const showError = (text: string) => {
  snackbar.value = { show: true, text, color: 'error' }
}
const getRequestErrorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === 'object' && 'message' in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === 'string' && message) return message;
    }
    if (typeof data === 'string' && data) return data;
  }
  return fallback;
}

interface imageObject {
  id: number;
  author: Author;
  src: string;
  title: string;
  source_id: number;
  loaded: boolean | undefined;
  aspect_ratio: number;
  primary_color: PrimaryColor | null;
  accessible: boolean | undefined;
  patchLoading: boolean | undefined;
}
interface requestParams {
  offset?: number;
  limit?: number;
  tags?: string[];
  author?: string | number;
  desc?: boolean;
  sort_by?: string;
  ratioRange?: [number, number];
  width_floor?: number | string | null;
  width_ceil?: number | string | null;
  height_floor?: number | string | null;
  height_ceil?: number | string | null;
  colorEnabled?: boolean;
  color?: string;
  mode?: 'primary' | 'palette';
  max_dist?: number | string | null;
  accessible?: boolean;
  inaccessible?: boolean;
}

const sortByItems = [
  { title: 'ID', value: 'id' },
  { title: '宽度', value: 'width' },
  { title: '高度', value: 'height' },
  { title: '宽高比', value: 'aspect_ratio' },
  { title: '来源发布时间', value: 'source_created_at' },
  { title: '入库时间', value: 'created_at' },
  { title: '热度', value: 'popularity' },
  { title: '颜色距离', value: 'distance' },
];

const colorModeItems = [
  { title: '主色', value: 'primary' },
  { title: '调色盘', value: 'palette' },
];


let is_empty = ref(false);

const createDefaultParams = (): requestParams => ({
  ratioRange: [0, 10],
  accessible: true,
  inaccessible: true,
  sort_by: 'id',
  colorEnabled: false,
  color: '#ff0000',
  mode: 'primary',
  max_dist: 1500,
  desc: true,
  offset: 0,
});

let params = ref<requestParams>(createDefaultParams())

let limit = ref<number>(40);

let allImages: imageObject[] = []
let getImagesFuncLock = ref(false)
const loadError = ref<string | null>(null);
let activeRequestGeneration: number | null = null;
let listRequestGeneration = ref(0);

const setNumberQueryParam = (queryParams: Record<string, any>, key: string, value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') return;
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(numericValue)) {
    queryParams[key] = numericValue;
  }
};

const colorToRgbQuery = (color: string | undefined) => {
  if (!color) return null;
  const normalized = color.trim();
  const rgbMatch = normalized.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i)
    ?? normalized.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);

  if (rgbMatch) {
    const values = rgbMatch.slice(1, 4).map(value => Number.parseInt(value, 10));
    if (values.every(value => value >= 0 && value <= 255)) {
      return values.join(',');
    }
    return null;
  }

  const hex = normalized.startsWith('#') ? normalized.slice(1) : normalized;
  const fullHex = hex.length === 3
    ? hex.split('').map(value => value + value).join('')
    : hex.slice(0, 6);

  if (!/^[0-9a-fA-F]{6}$/.test(fullHex)) return null;

  const r = Number.parseInt(fullHex.slice(0, 2), 16);
  const g = Number.parseInt(fullHex.slice(2, 4), 16);
  const b = Number.parseInt(fullHex.slice(4, 6), 16);
  return `${r},${g},${b}`;
};

const colorInputToCss = (color: string | undefined) => {
  const rgb = colorToRgbQuery(color);
  return rgb ? `rgb(${rgb})` : 'transparent';
};

const hasColorFilter = () => Boolean(params.value.colorEnabled && colorToRgbQuery(params.value.color));

const getImages = async (generation = listRequestGeneration.value): Promise<boolean> => {
  if (getImagesFuncLock.value && activeRequestGeneration === generation) return false
  getImagesFuncLock.value = true
  activeRequestGeneration = generation
  let tagQuery
  if (params.value.tags?.length) {
    tagQuery = params.value.tags.join(",");
  }
  // accessible: 对应后端 image.accessible 字段，仅接受 "true"/"false"
  // 两个都勾选或都不勾选 → 不发参数 → 后端不过滤 → 管理员看到全部图片
  // 仅勾选 accessible → ?accessible=true → 只看 accessible=true 的图片
  // 仅勾选 inaccessible → ?accessible=false → 只看 accessible=false 的图片
  const queryParams: Record<string, any> = {
    offset: currentOffset.value,
    limit: limit.value,
    desc: params.value.desc,
  };
  if (tagQuery) queryParams.tags = tagQuery;
  if (params.value.author) queryParams.author = params.value.author;
  if (params.value.sort_by && (params.value.sort_by !== 'distance' || hasColorFilter())) {
    queryParams.sort_by = params.value.sort_by;
  }
  if (params.value.ratioRange) {
    queryParams.ratio_floor = params.value.ratioRange[0];
    queryParams.ratio_ceil = params.value.ratioRange[1];
  }
  setNumberQueryParam(queryParams, 'width_floor', params.value.width_floor);
  setNumberQueryParam(queryParams, 'width_ceil', params.value.width_ceil);
  setNumberQueryParam(queryParams, 'height_floor', params.value.height_floor);
  setNumberQueryParam(queryParams, 'height_ceil', params.value.height_ceil);
  const rgbQuery = colorToRgbQuery(params.value.color);
  if (params.value.colorEnabled && rgbQuery) queryParams.rgb = rgbQuery;
  if (hasColorFilter()) {
    if (params.value.mode) queryParams.mode = params.value.mode;
    setNumberQueryParam(queryParams, 'max_dist', params.value.max_dist);
  }
  if (params.value.accessible !== params.value.inaccessible) {
    queryParams.accessible = params.value.accessible;
  }
  try {
    const res = await Axios.get('/list', { params: queryParams });
    if (generation !== listRequestGeneration.value) return false;
    if (res.status === 200) {
      if (res.data) {
        const mapped = res.data.map((img: any) => ({
          ...img,
          primary_color: normalizePrimaryColor(img.primary_color),
          accessible: img.accessible ?? undefined,
        }))
        allImages.push(...mapped)
        cols.value = calcImageCol(allImages);
        updateWaterfallFrameHeight();
        currentOffset.value += limit.value as number;
        if (res.data.length < limit.value) {
          is_empty.value = true;
        } else {
          is_empty.value = false;
        }

      }
    }
    loadError.value = null;
    return true;
  } catch (error) {
    if (generation !== listRequestGeneration.value) return false;
    const message = getRequestErrorMessage(error, '加载图片列表失败');
    loadError.value = message;
    showError(message);
    return false;
  } finally {
    if (activeRequestGeneration === generation) {
      getImagesFuncLock.value = false
      activeRequestGeneration = null
    }
  }
};

type ElementRef = HTMLElement | { $el?: HTMLElement } | null;

const containerRef = ref<ElementRef>(null);
const COLUMN_OUTER_GAP = 16;
const MIN_COLUMN_COUNT = 2;
const MAX_COLUMN_COUNT = 4;
const ORIGINAL_COLUMN_WIDTH_DIVISOR = 7.5;
const MIN_COLUMN_WIDTH_REM = 12;
const MAX_COLUMN_WIDTH_REM = 20;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const getElementFromRef = (target: ElementRef) => {
  if (target instanceof HTMLElement) return target;
  if (target?.$el instanceof HTMLElement) return target.$el;
  return null;
};
const getRemInPx = () => Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
const getColumnWidthBounds = () => {
  const rem = getRemInPx();
  return {
    min: MIN_COLUMN_WIDTH_REM * rem,
    max: MAX_COLUMN_WIDTH_REM * rem,
  };
};
const getClampedColumnWidth = () => {
  const bounds = getColumnWidthBounds();
  return clamp(
    Math.floor(window.innerWidth / ORIGINAL_COLUMN_WIDTH_DIVISOR),
    bounds.min,
    bounds.max
  );
};

let colWidth = ref(getClampedColumnWidth());
let columnCount = ref(3);
let waterfallWidth = ref(0);
let waterfallScale = ref(1);
let waterfallFrameHeight = ref(0);
let waterfallOffsetX = ref(0);
const loadMoreRef = ref<HTMLElement | null>(null);
const isLoadingImages = ref(false);
let resizeObserver: ResizeObserver | null = null;
let drawerObserver: MutationObserver | null = null;
let infiniteObserver: IntersectionObserver | null = null;
let scrollCheckFrame: number | null = null;
let loadMoreFrame: number | null = null;

const getNaturalColumnWidth = () => getClampedColumnWidth();
const getColumnOuterWidth = () => colWidth.value + COLUMN_OUTER_GAP;

const getContainerWidth = () => {
  const container = getElementFromRef(containerRef.value);
  if (!container) return window.innerWidth;
  const style = getComputedStyle(container);
  const containerRect = container.getBoundingClientRect();
  const drawer = document.querySelector('.v-navigation-drawer--active:not(.v-navigation-drawer--rail)');
  const drawerRect = drawer?.getBoundingClientRect();
  const drawerOverlap = drawerRect
    ? Math.max(0, Math.min(containerRect.right, drawerRect.right) - Math.max(containerRect.left, drawerRect.left))
    : 0;

  waterfallOffsetX.value = drawerOverlap / 2;

  return Math.max(
    1,
    container.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight) - drawerOverlap
  );
};

const updateWaterfallFrameHeight = () => {
  if (!cols.value?.length) {
    waterfallFrameHeight.value = 0;
    return;
  }

  const maxColumnHeight = Math.max(
    0,
    ...cols.value.map(col =>
      col.reduce((height, image) => height + colWidth.value / image.aspect_ratio + COLUMN_OUTER_GAP, 0)
    )
  );
  waterfallFrameHeight.value = Math.ceil(maxColumnHeight * waterfallScale.value);
};

const updateWaterfallLayout = () => {
  const width = getContainerWidth();
  colWidth.value = getNaturalColumnWidth();
  const nextColumnCount = clamp(
    Math.round(width / getColumnOuterWidth()),
    MIN_COLUMN_COUNT,
    MAX_COLUMN_COUNT
  );

  columnCount.value = nextColumnCount;
  waterfallWidth.value = nextColumnCount * getColumnOuterWidth();
  waterfallScale.value = Math.min(1, width / waterfallWidth.value);
  if (allImages.length) {
    cols.value = calcImageCol(allImages);
  }
  updateWaterfallFrameHeight();
};

const calcImageCol = (images: imageObject[]): imageObject[][] => {
  const cols: imageObject[][] = Array.from({ length: columnCount.value }, () => []);
  const heights = Array.from({ length: columnCount.value }, () => 0);
  for (const image of images) {
    const h = colWidth.value / image.aspect_ratio + COLUMN_OUTER_GAP;
    const minIndex = heights.indexOf(Math.min(...heights));
    cols[minIndex].push(image);
    heights[minIndex] += h;
  }
  return cols;
};
let cols = ref<imageObject[][]>();
let currentOffset = ref<number>(0);

const isLoadMoreVisible = () => {
  const sentinel = loadMoreRef.value;
  if (!sentinel) return false;

  const rect = sentinel.getBoundingClientRect();
  return rect.top <= window.innerHeight + 400 && rect.bottom >= -400;
};

const ensureLoadMore = async (options: { force?: boolean; reload?: boolean } = {}) => {
  if (isLoadingImages.value && !options.reload) return;
  if (is_empty.value && !options.reload) return;
  if (loadError.value && !options.force && !options.reload) return;
  if (options.force || options.reload) loadError.value = null;

  isLoadingImages.value = true;
  const generation = listRequestGeneration.value;
  const loaded = await getImages(generation);
  await nextTick();
  updateWaterfallFrameHeight();
  if (generation === listRequestGeneration.value) {
    isLoadingImages.value = false;
  }
  if (!loaded) return;

  if (loadMoreFrame !== null) cancelAnimationFrame(loadMoreFrame);
  loadMoreFrame = requestAnimationFrame(() => {
    loadMoreFrame = null;
    if (!is_empty.value && !loadError.value && isLoadMoreVisible()) {
      ensureLoadMore();
    }
  });
};

const retryLoadMore = () => {
  ensureLoadMore({ force: true });
};

const observeLoadMore = () => {
  if (!loadMoreRef.value || infiniteObserver) return;

  infiniteObserver = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting)) {
      ensureLoadMore();
    }
  }, { rootMargin: '400px 0px' });
  infiniteObserver.observe(loadMoreRef.value);
};

const checkLoadMoreOnScroll = () => {
  if (scrollCheckFrame !== null) return;

  scrollCheckFrame = requestAnimationFrame(() => {
    scrollCheckFrame = null;
    if (isLoadMoreVisible()) {
      ensureLoadMore();
    }
  });
};
let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
const onResize = () => {
  if (resizeTimeout) clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    updateWaterfallLayout();
  }, 150);
};
const observeContainer = () => {
  const container = getElementFromRef(containerRef.value);
  if (!container || resizeObserver) return;

  resizeObserver = new ResizeObserver(updateWaterfallLayout);
  resizeObserver.observe(container);
};
const observeDrawerState = () => {
  if (drawerObserver) return;
  drawerObserver = new MutationObserver((mutations) => {
    if (mutations.some(mutation => (mutation.target as Element).classList?.contains('v-navigation-drawer'))) {
      updateWaterfallLayout();
    }
  });
  drawerObserver.observe(document.body, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ['class', 'style'],
  });
};
onMounted(async () => {
  updateWaterfallLayout()
  await ensureLoadMore()
  await nextTick()
  observeContainer()
  observeDrawerState()
  observeLoadMore()
  updateWaterfallLayout()
  getTags()
  Axios.get('/statistic').then(res => {
    totalImages.value = res.data.illust_count
  }).catch((e) => {
    console.error('Failed to load statistics:', e)
  })
  addEventListener("resize", onResize);
  addEventListener("scroll", checkLoadMoreOnScroll, { passive: true });
});
onUnmounted(() => {
  removeEventListener("resize", onResize);
  removeEventListener("scroll", checkLoadMoreOnScroll);
  if (resizeTimeout) clearTimeout(resizeTimeout);
  if (scrollCheckFrame !== null) cancelAnimationFrame(scrollCheckFrame);
  if (loadMoreFrame !== null) cancelAnimationFrame(loadMoreFrame);
  resizeObserver?.disconnect();
  drawerObserver?.disconnect();
  infiniteObserver?.disconnect();
});

let overlay = ref(false);
let selectedImageId = ref<string | null>(null);
const showDetail = (imageId: number) => {
  selectedImageId.value = String(imageId);
  overlay.value = true;
};
const overlayClosed = () => {
  selectedImageId.value = null;
};



let totalImages = ref(100);

const patchImage = (image: imageObject) => {
  image.patchLoading = true
  const newValue = !image.accessible
  Axios.patch(`/image/${image.id}`, { accessible: newValue }).then(res => {
    if (res.status === 200) {
      const prevLoaded = image.loaded
      Object.assign(image, res.data)
      image.loaded = prevLoaded
      // Re-normalize primary_color only if PATCH response actually included it
      if (res.data.primary_color !== undefined) {
        image.primary_color = normalizePrimaryColor(res.data.primary_color);
      }
    }
  }).catch((e) => {
    console.error(e)
    image.accessible = !newValue
    showError(e.response?.data?.message ?? '更新图片状态失败')
  }).finally(() => {
    image.patchLoading = false
  });
};
let isHoverBtn = ref(false);

let isUpdating = ref(false);
const filterUpdate = async () => {
  if (isUpdating.value) return
  isUpdating.value = true
  resetImageList()
  if (params.value.offset !== undefined) {
    currentOffset.value = params.value.offset as number
  } else {
    currentOffset.value = 0
  }
  await ensureLoadMore({ reload: true })
  updateWaterfallFrameHeight()
  await nextTick()
  isUpdating.value = false
  updateWaterfallFrameHeight()
}

const resetFilters = async () => {
  if (isUpdating.value) return
  params.value = createDefaultParams()
  selectionTags.value = []
  await filterUpdate()
}

const resetImageList = () => {
  listRequestGeneration.value += 1
  allImages = []
  cols.value = Array.from({ length: columnCount.value }, () => []);
  currentOffset.value = 0
  is_empty.value = false
  isLoadingImages.value = false
  loadError.value = null
  if (loadMoreFrame !== null) {
    cancelAnimationFrame(loadMoreFrame)
    loadMoreFrame = null
  }
  updateWaterfallFrameHeight()
}
let tags = ref<TagCatalogEntry[]>([]);
let selectionTags = ref<string[]>([]);
let tagSelectorLoading = ref(false)
const getTags = () => {
  tagSelectorLoading.value = true
  Axios.get("/tags").then((res) => {
    if (res.status === 200) {
      tags.value = res.data
    }
  }).catch((e) => {
    console.error('Failed to load tags:', e)
  }).finally(() => {
    tagSelectorLoading.value = false
  })
}
</script>
<template>
  <v-dialog max-width="600">
    <template v-slot:activator="{ props }">
      <v-btn v-bind="props" :icon="mdiFilterOutline" class="fab" elevation="6" size="large"></v-btn>
    </template>
    <template v-slot:default="{ isActive }">
      <v-card class="filter-card">
        <v-card-title class="filter-card-title">
          筛选条件
        </v-card-title>
        <v-divider></v-divider>
        <v-form class="filter-form">
          <v-slider class="filter-slider" :step="1" :min="0" :max="totalImages" thumb-label
            label="查询起始偏移/Offset" v-model="params.offset" hide-details>
            <template v-slot:append>
              <v-text-field label="查询起始偏移/Offset" v-model="params.offset" density="compact"
                class="offset-field" type="number" hide-details single-line></v-text-field>
            </template>

          </v-slider>
          <v-autocomplete :loading="tagSelectorLoading" closable-chips clearable chips multiple label="标签/Tags"
            v-model="selectionTags" :items="tags" item-title="search_string" item-value="name"
            density="comfortable" hide-details="auto" @update:model-value="params.tags = $event">
            <template v-slot:item="{ props, item }">
              <v-list-item v-bind="props" :subtitle="item.raw.translated_name" :title="item.raw.name"></v-list-item>
            </template>
          </v-autocomplete>
          <v-text-field v-model="params.author" label="作者/Author" density="comfortable" hide-details="auto" />
          <v-select v-model="params.sort_by" :items="sortByItems" item-title="title" item-value="value"
            label="排序字段/Sort By" density="comfortable" hide-details="auto"></v-select>
          <v-range-slider class="filter-slider" thumb-label min="0" max="10" v-model="params.ratioRange" strict
            label="宽高比/Ratio Range" hide-details></v-range-slider>
          <div class="filter-grid">
            <v-text-field v-model="params.width_floor" label="最小宽度" type="number" min="0"
              density="comfortable" hide-details="auto" />
            <v-text-field v-model="params.width_ceil" label="最大宽度" type="number" min="0"
              density="comfortable" hide-details="auto" />
            <v-text-field v-model="params.height_floor" label="最小高度" type="number" min="0"
              density="comfortable" hide-details="auto" />
            <v-text-field v-model="params.height_ceil" label="最大高度" type="number" min="0"
              density="comfortable" hide-details="auto" />
          </div>
          <v-checkbox v-model="params.colorEnabled" label="按颜色筛选" density="compact" hide-details></v-checkbox>
          <div v-if="params.colorEnabled" class="color-picker-filter">
            <v-select v-model="params.mode" :items="colorModeItems" item-title="title" item-value="value"
              label="匹配模式" density="comfortable" hide-details="auto" />
            <v-menu :close-on-content-click="false" location="bottom end">
              <template v-slot:activator="{ props: menuProps }">
                <v-text-field v-model="params.color" v-bind="menuProps" label="目标颜色" variant="outlined"
                  placeholder="#ff0000" density="comfortable" hide-details="auto">
                  <template v-slot:append-inner>
                    <span class="selected-color-swatch" :style="{ backgroundColor: colorInputToCss(params.color) }"></span>
                  </template>
                </v-text-field>
              </template>
              <v-color-picker v-model="params.color" hide-inputs mode="hex" width="320" />
            </v-menu>
            <v-slider v-model="params.max_dist" label="最大颜色距离" :min="0" :max="5000" :step="100"
              thumb-label class="color-distance-slider filter-slider" hide-details></v-slider>
          </div>
          <div class="checkbox-grid">
            <v-checkbox v-model="params.desc" label="倒序排列" density="compact" hide-details></v-checkbox>
            <template v-if='store.user.token'>
              <v-checkbox v-model="params.accessible" label="Accessible" density="compact" hide-details></v-checkbox>
              <v-checkbox v-model="params.inaccessible" label="Inaccessible" density="compact" hide-details></v-checkbox>
            </template>
          </div>
        </v-form>
        <v-card-actions class="filter-actions">
          <v-spacer></v-spacer>
          <v-btn text="重置" variant="text" :disabled="isUpdating" @click="resetFilters()" />
          <v-btn text="应用" variant="text" :loading="isUpdating" @click="filterUpdate()" />
          <v-btn text="确认" variant="text" :loading="isUpdating" @click="filterUpdate(); isActive.value = false" />
        </v-card-actions>
      </v-card>
    </template>
  </v-dialog>

  <v-overlay scroll-strategy="block" v-if="selectedImageId" z-index="10000" v-model="overlay"
    class="overlay align-center" @after-leave="overlayClosed()">
    <ImageDetail :imageId="selectedImageId" @close="overlay = false" />
  </v-overlay>
  <v-container v-if="cols" ref="containerRef" class="container">
    <div class="masonry-frame" :style="{ height: `${waterfallFrameHeight}px` }">
      <v-row
        no-gutters
        class="masonry-row"
        :style="{
          width: `${waterfallWidth}px`,
          transform: `translateX(calc(-50% + ${waterfallOffsetX}px)) scale(${waterfallScale})`,
        }"
      >
        <v-col
          v-for="(col, colIndex) of cols"
          :key="colIndex"
          class="masonry-col"
          :style="{ flexBasis: `${getColumnOuterWidth()}px`, maxWidth: `${getColumnOuterWidth()}px` }"
        >
          <template v-for="image of col" :key="image.id">
            <v-hover v-slot="{ isHovering, props }">
              <v-img v-bind="props" class="image" :src="image.src + '/scale_to_1080x1080'" @load="image.loaded = true"
                :width="colWidth" :height="colWidth / image.aspect_ratio" :style="{
                  backgroundColor: image.primary_color
                    ? `rgba(${image.primary_color.rgb[0]}, ${image.primary_color.rgb[1]}, ${image.primary_color.rgb[2]}, 0.5)`
                    : 'rgba(0,0,0,0)',
                }" @click="isHoverBtn ? null : showDetail(image.id)">
                <v-chip v-if='store.user.token' label :color="image.accessible ? 'green' : 'red'" class="admin-chip"
                  :style="{ opacity: isHovering ? '0' : '1', transition: 'opacity 0.2s' }" size="small">{{
                    image.accessible ? "可访问" : "不可访问"
                  }}</v-chip>
                <template v-slot:placeholder v-if="!image.loaded">
                  <div class="d-flex align-center justify-center fill-height">
                    <v-progress-circular color="grey-lighten-4" indeterminate></v-progress-circular>
                  </div>
                </template>
                <v-overlay :model-value="isHovering ?? false" class="img-overlay" :width="colWidth"
                  :height="colWidth / image.aspect_ratio" contained :content-props="{ class: 'overlay-content' }">
                  <v-btn v-if='store.user.token' :loading="image.patchLoading"
                    :color="image.patchLoading ? 'warning' : image.accessible ? 'green' : 'red'" class="admin-btn"
                    size="x-small" @click="patchImage(image)" @mouseover="isHoverBtn = true"
                    @mouseleave="isHoverBtn = false">{{
                      image.accessible ? "可访问" : "不可访问" }}</v-btn>
                  <div class="inner-container" :width="colWidth" :height="colWidth / image.aspect_ratio"
                    :style="{ height: `${colWidth / image.aspect_ratio}px` }">
                    <div class="title" :style="{ width: `${colWidth}px` }">
                      {{ image.title }}
                    </div>
                    <div>{{ image.author.name }}</div>
                    <div class="d-flex align-center ga-1">
                      <span>#{{ image.id }}</span>
                      <v-tooltip v-if="image.primary_color" location="top">
                        <template v-slot:activator="{ props: tipProps }">
                          <span v-bind="tipProps" class="color-swatch" :style="{
                            backgroundColor: `rgb(${image.primary_color.rgb[0]}, ${image.primary_color.rgb[1]}, ${image.primary_color.rgb[2]})`,
                          }"></span>
                        </template>
                        <div class="color-tooltip">
                          <div>RGB: {{ image.primary_color.rgb.join(', ') }}</div>
                          <div>LAB: {{ image.primary_color.lab.map(v => v.toFixed(1)).join(', ') }}</div>
                        </div>
                      </v-tooltip>
                    </div>
                  </div>
                </v-overlay>
              </v-img>
            </v-hover>
          </template>
        </v-col>
      </v-row>
    </div>
    <div ref="loadMoreRef" class="infinite-sentinel">
      <v-progress-circular v-if="isLoadingImages && !is_empty" color="primary" indeterminate></v-progress-circular>
      <div v-else-if="loadError" class="load-error text-medium-emphasis">
        <span>{{ loadError }}</span>
        <v-btn size="small" variant="text" color="primary" @click="retryLoadMore">重试</v-btn>
      </div>
      <div v-else-if="is_empty" class="text-medium-emphasis text-center pa-4">~ 到底儿了 ~</div>
    </div>
  </v-container>

  <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000" location="top">
    {{ snackbar.text }}
  </v-snackbar>
</template>
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
  width: 100%;
  max-width: 1280px;
  padding-inline: 0.5rem;
}

.masonry-frame {
  position: relative;
  width: 100%;
  overflow: visible;
}

.masonry-row {
  position: absolute;
  top: 0;
  left: 50%;
  justify-content: center;
  align-items: flex-start;
  transform-origin: top center;
}

.masonry-col {
  flex-grow: 0;
  flex-shrink: 0;
  min-width: 0;
}

.infinite-sentinel {
  align-items: center;
  display: flex;
  justify-content: center;
  min-height: 4rem;
}

.load-error {
  align-items: center;
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  min-height: 4rem;
  text-align: center;
}

.img-overlay {
  display: flex;
  align-items: flex-end;

  div {
    width: 100%;
  }

  .content {
    width: 100% !important;
  }

  .title {
    font-size: 1.5rem;
    font-weight: bold;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;

    width: 90%;
    word-break: keep-all;
    word-wrap: normal;
  }

  .admin-btn {
    right: 0.2rem;
    top: 0.2rem;
    position: absolute;
    font-weight: bold;
  }

  .admin-chip {
    right: 0.2rem !important;
    top: 0.2rem !important;
    position: absolute !important;
    font-weight: bold;
    transition: opacity 0.2s;
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

  .color-swatch {
    display: inline-block;
    width: 0.85rem;
    height: 0.85rem;
    border-radius: 0.15rem;
    border: 1px solid rgba(255, 255, 255, 0.5);
    vertical-align: middle;
    flex-shrink: 0;
  }

  .color-tooltip {
    font-size: 0.75rem;
    line-height: 1.4;
    white-space: nowrap;
  }
}

.overlay {
  display: flex;
  justify-content: center;
  width: 100%;
  max-height: 100vh;
  overflow: auto;
  overscroll-behavior: contain;

  .container-cols {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.5rem;
    overflow: scroll !important;
    padding: 1rem;

    .img-container {
      display: flex;
      flex-direction: column;
      justify-items: end;
      padding: 0;
    }

    .color-container {
      .color-card {
        width: 100%;
        height: 100%;
      }

      margin: 0.6rem 0 0 0;
      display: grid;
      grid-template-columns: repeat(10, 1fr);
      gap: 0.3rem;
    }
  }

  .info {
    min-width: 20rem;
    padding: 1rem;
    max-height: 100%;
    height: auto;

    .author {
      margin: 0.5rem 0;

      div {
        margin-left: 1.5rem;
      }
    }

    .origin {
      margin: 0.5rem 0;

      div {
        margin-left: 1.5rem;
      }
    }

    .link {
      cursor: pointer;
      width: fit-content;
      transition: all 0.2s;
      border-radius: 0.2rem;
      padding: 0 0.4rem;
      transform: translateX(-0.4rem);
    }

    .link:hover {
      background-color: rgba(130, 130, 130, 0.1);
    }

    .link:visited {
      text-decoration: none;
    }

    .tags {
      width: 100%;

      .tag {
        margin: 0 0.5rem 0.5rem 0;
        border-radius: 0.3rem;
        height: 3rem;

        .tag-info {
          display: flex;
          align-items: center;
          flex-direction: column;

          .extra {
            font-size: 0.7rem;
            color: rgba(130, 130, 130, 0.9);
          }
        }
      }
    }
  }


}

.fab {
  position: fixed;
  bottom: 5rem;
  right: 5rem;
  z-index: 20;
}

.filter-card {
  overflow: hidden;
}

.filter-card-title {
  padding: 0.75rem 1rem;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.4;
}

.filter-actions {
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 1rem 0.75rem;
}

.filter-form {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
}

.filter-slider {
  margin-inline: 0.25rem;
}

.offset-field {
  width: 6rem;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.color-picker-filter {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.color-distance-slider {
  grid-column: 1 / -1;
}

.checkbox-grid {
  align-items: center;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.25rem 0.75rem;
  margin-top: -0.25rem;
}

.selected-color-swatch {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.24);
  border-radius: 0.2rem;
  display: inline-block;
  height: 1rem;
  width: 1rem;
}

@media (max-width: 600px) {
  .container {
    padding-inline: 0.25rem;
  }

  .fab {
    right: max(1rem, env(safe-area-inset-right));
    bottom: max(1rem, env(safe-area-inset-bottom));
  }

  .filter-grid {
    grid-template-columns: 1fr;
  }

  .color-picker-filter {
    grid-template-columns: 1fr;
  }

  .checkbox-grid {
    grid-template-columns: 1fr;
  }

  .filter-actions {
    justify-content: flex-end;
  }
}
</style>
