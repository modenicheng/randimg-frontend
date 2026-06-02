<script setup lang="ts">
import Axios from "../axios/axios";
import { onMounted, onUnmounted, ref, nextTick } from 'vue';
import { useUserStore } from "../store/store";
import { mdiFilterOutline } from "@mdi/js";
import { normalizePrimaryColor } from "../utils/colorNormalization";
import ImageDetail from '../components/imageDetail.vue';
import { openExternalUrl } from "../utils/url";
import type { Author, TagCatalogEntry } from "../types/api";
const store = useUserStore()

const snackbar = ref({ show: false, text: '', color: 'error' })
const showError = (text: string) => {
  snackbar.value = { show: true, text, color: 'error' }
}

interface imageObject {
  id: number;
  author: Author;
  src: string;
  title: string;
  source_id: number;
  loaded: boolean | undefined;
  aspect_ratio: number;
  primary_color: [number, number, number] | null;
  accessible: boolean | undefined;
  patchLoading: boolean | undefined;
}
interface requestParams {
  offset?: number;
  limit?: number;
  tags?: string[];
  author?: string | number;
  desc?: boolean;
  ratioRange?: [number, number];
  accessible?: boolean;
  inaccessible?: boolean;
}


let is_empty = ref(false);

let refresh = ref(true)

let params = ref<requestParams>({
  ratioRange: [0, 10],
  accessible: true,
  inaccessible: true,
  desc: true,
  offset: 0,
})

let limit = ref<number>(40);

let allImages: imageObject[] = []
let getImagesFuncLock = ref(false)
const getImages = async () => {
  if (getImagesFuncLock.value) return
  getImagesFuncLock.value = true
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
  if (params.value.ratioRange) {
    queryParams.ratio_floor = params.value.ratioRange[0];
    queryParams.ratio_ceil = params.value.ratioRange[1];
  }
  if (params.value.accessible !== params.value.inaccessible) {
    queryParams.accessible = params.value.accessible;
  }
  await Axios.get('/list', { params: queryParams }).then((res) => {
    if (res.status === 200) {
      if (res.data) {
        const mapped = res.data.map((img: any) => ({
          ...img,
          primary_color: normalizePrimaryColor(img.primary_color),
          accessible: img.accessible ?? undefined,
        }))
        allImages.push(...mapped)
        cols.value = calcImageCol(allImages);
        currentOffset.value += limit.value as number;
        if (res.data.length < limit.value) {
          is_empty.value = true;
        } else {
          is_empty.value = false;
        }

      }
    }
    getImagesFuncLock.value = false
  }
  ).catch((e) => {
    getImagesFuncLock.value = false
    showError(e.response?.data?.message ?? '加载图片列表失败')
  });
};

let colWidth = ref(Math.floor(window.innerWidth / 7.5));
const calcImageCol = (images: imageObject[]): imageObject[][] => {
  const cols: imageObject[][] = [[], [], []];
  const heights = [0, 0, 0];
  for (const image of images) {
    const h = 1 / image.aspect_ratio;
    const minIndex = heights.indexOf(Math.min(...heights));
    cols[minIndex].push(image);
    heights[minIndex] += h;
  }
  return cols;
};
let cols = ref<imageObject[][]>();
let currentOffset = ref<number>(0);
const loadData = async ({ done }: any) => {
  await getImages();
  if (is_empty.value) {
    done("empty");
  } else {
    done("ok");
  }
};
let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
const onResize = () => {
  if (resizeTimeout) clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    colWidth.value = Math.floor(window.innerWidth / 7.5);
  }, 150);
};
onMounted(() => {
  getImages()
  getTags()
  Axios.get('/statistic').then(res => {
    totalImages.value = res.data.illust_count
  }).catch((e) => {
    console.error('Failed to load statistics:', e)
  })
  addEventListener("resize", onResize);
});
onUnmounted(() => {
  removeEventListener("resize", onResize);
  if (resizeTimeout) clearTimeout(resizeTimeout);
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
  clear()
  if (params.value.offset !== undefined) {
    currentOffset.value = params.value.offset as number
  } else {
    currentOffset.value = 0
  }
  await getImages()
  refresh.value = false
  await nextTick(() => {
    refresh.value = true;
    isUpdating.value = false
  })
}
const clear = () => {
  allImages = []
  cols.value = [[], [], []];
  currentOffset.value = 0
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
      <v-fab v-bind="props" :icon='mdiFilterOutline' class='fab'>
      </v-fab>
    </template>
    <template v-slot:default="{ isActive }">
      <v-card class="filter-card">
        <div class="text-h6 font-weight-bold">筛选条件</div>
        <v-divider style="margin: 0.5rem 0"></v-divider>
        <v-form>
          <v-slider :step="1" :min="0" :max="totalImages" thumb-label label="查询起始偏移/Offset" v-model="params.offset">
            <template v-slot:append>
              <v-text-field label="查询起始偏移/Offset" v-model="params.offset" density="compact" style="width: 6rem" type="number" hide-details
                single-line></v-text-field>
            </template>

          </v-slider>
          <v-autocomplete :loading="tagSelectorLoading" closable-chips clearable chips multiple label="标签/Tags"
            v-model="selectionTags" :items="tags" item-title="search_string" item-value="name"
            @update:model-value="params.tags = $event">
            <template v-slot:item="{ props, item }">
              <v-list-item v-bind="props" :subtitle="item.raw.translated_name" :title="item.raw.name"></v-list-item>
            </template>
          </v-autocomplete>
          <v-text-field v-model="params.author" label="作者/Author" />
          <v-range-slider thumb-label min="0" max="10" v-model="params.ratioRange" strict
            label="宽高比/Ratio Range"></v-range-slider>
          <v-checkbox v-model="params.desc" label="倒序排列"></v-checkbox>
          <template v-if='store.user.token'>
            <v-checkbox v-model="params.accessible" label="Accessible"></v-checkbox>
            <v-checkbox v-model="params.inaccessible" label="Inaccessible"></v-checkbox>
          </template>
        </v-form>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text="应用" @click="filterUpdate()"></v-btn>
          <v-btn text="确认" @click="filterUpdate(); isActive.value = false"></v-btn>
        </v-card-actions>
      </v-card>
    </template>
  </v-dialog>

  <v-overlay scroll-strategy="none" v-if="selectedImageId" z-index="10000" v-model="overlay"
    class="overlay align-center" @after-leave="overlayClosed()">
    <ImageDetail :imageId="selectedImageId" />
  </v-overlay>
  <v-container v-if="cols" class="container">
    <v-infinite-scroll v-if="refresh" :onLoad="loadData">
      <v-row no-gutters>
        <v-col v-for="colIndex of [0, 1, 2]" :key="colIndex">
          <template v-for="image of cols[colIndex]" :key="image.id">
            <v-hover v-slot="{ isHovering, props }">
              <v-img v-bind="props" class="image" :src="image.src + '/scale_to_1080x1080'" @load="image.loaded = true"
                :width="colWidth" :height="colWidth / image.aspect_ratio" :style="{
                  backgroundColor: image.primary_color
                    ? `rgba(${image.primary_color[0]}, ${image.primary_color[1]}, ${image.primary_color[2]}, 0.5)`
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
                    <div>#{{ image.id }}</div>
                  </div>
                </v-overlay>
              </v-img>
            </v-hover>
          </template>
        </v-col>
      </v-row>
      <template v-slot:empty>
        <div class="text-medium-emphasis text-center pa-4">~ 到底儿了 ~</div>
      </template>
    </v-infinite-scroll>
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
  width: auto;
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
}

.overlay {
  display: flex;
  justify-content: center;
  width: 100%;
  max-height: 100vh;
  overflow: auto;

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
}

.filter-card {
  padding: 1rem;

}
</style>
