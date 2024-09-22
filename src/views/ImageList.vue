<script setup lang="ts">
import Axios from "../axios/axios";
import { onMounted, ref, nextTick } from 'vue';
import { useUserStore } from "../store/store";
import { mdiFilterOutline } from "@mdi/js";
const store = useUserStore()

interface Author {
  id: number;
  name: string;
  platform: string;
  platform_id: number;
}
interface imageObject {
  id: number;
  author: Author;
  src: string;
  title: string;
  source_id: number;
  loaded: boolean | undefined;
  aspect_ratio: number;
  primary_color: [number, number, number];
  accessable: boolean | undefined;
  patchLoading: boolean | undefined;
}
interface requestParams {
  offset?: number;
  limit?: number;
  tags?: string | string[],
  author?: string | number,
  desc?: boolean;
  ratioRange?: [number, number];
  accessable?: boolean;
  unaccessable?: boolean;
}


let images = ref<[imageObject] | undefined>();
let is_empty = ref(false);

let refresh = ref(true)

let params = ref<requestParams>({
  ratioRange: [0, 10],
  accessable: true,
  unaccessable: true,
  desc: true,
})

let limit = ref(40);

let getImagesFuncLock = ref(false)
const getImages = async () => {
  if (getImagesFuncLock.value) return
  getImagesFuncLock.value = true
  let tagQuery
  if (params.value.tags) {
    tagQuery = typeof params.value.tags === "string"
      ? params.value.tags
      : params.value.tags.join(",");
  }
  let accessable
  if (params.value.accessable && params.value.unaccessable) {
    accessable = "all"
  } else if (params.value.accessable === true) {
    accessable = 'true'
  } else if (params.value.unaccessable === true) {
    accessable = 'false'
  }
  let query = `?offset=${currentOffset.value}&limit=${limit.value}${tagQuery ? `&tags=${tagQuery}&` : ""}${params.value.author ? `&author=${params.value.author}` : ''}${params.value.ratioRange ? `&ratio_floor=${params.value.ratioRange[0]}&ratio_ceil=${params.value.ratioRange[1]}` : ''}${accessable ? `&accessable=${accessable}` : ''}${params.value.desc ? `&desc=true` : '&desc=false'}`
  await Axios.get(
    `/list${query}`,
  ).then((res) => {
    if (res.status === 200) {
      if (res.data) {
        images.value = res.data;
        cols.value = calcImageCol(res.data);
        currentOffset.value += limit.value;
        if (res.data.length < limit.value) {
          is_empty.value = true;
        } else {
          is_empty.value = false;
        }

      } else {
      }
    }
    getImagesFuncLock.value = false
  }
  ).catch(() => {
    getImagesFuncLock.value = false
  });
};

let col1: imageObject[] = [];
let col2: imageObject[] = [];
let col3: imageObject[] = [];
let colHeight = {
  col1: 0,
  col2: 0,
  col3: 0,
};
let colWidth = ref(Math.floor(window.innerWidth / 7.5));
const calcImageCol = (images: [imageObject]) => {
  for (let image of images) {
    let h = 1 / image.aspect_ratio;
    let minINdex = getMinCol(colHeight);
    switch (minINdex) {
      case 0:
        col1.push(image);
        colHeight.col1 += h;
        break;
      case 1:
        col2.push(image);
        colHeight.col2 += h;
        break;
      case 2:
        col3.push(image);
        colHeight.col3 += h;
    }
  }
  return [col1, col2, col3];
};

const getMinCol = (colHeight: { col1: number; col2: number; col3: number }) => {
  let m = Math.min(colHeight.col1, colHeight.col2, colHeight.col3);
  switch (m) {
    case colHeight.col1:
      return 0;
    case colHeight.col2:
      return 1;
    case colHeight.col3:
      return 2;
  }
};
let cols = ref<imageObject[][]>();
let currentOffset = ref(0);
getImages();
const loadData = async ({ done }: any) => {
  await getImages();
  if (is_empty.value) {
    done("empty");
  } else {
    done("ok");
  }
};
onMounted(() => {
  addEventListener("resize", () => {
    colWidth.value = Math.floor(window.innerWidth / 7.5);
  });
});

let overlay = ref(false);
let imageDetailData = ref();
const showDetail = (imageId: number) => {
  try {
    imageDetailData.value.loaded = false;
  } catch { }

  overlay.value = true;
  Axios.get(`/image/${imageId}`).then((res) => {
    imageDetailData.value = res.data;
    if (imageDetailData.value.aspect_ratio < 0.7) {
      imgShowHeight.value = 0.8 * window.innerHeight;
      imgShowWidth.value =
        imgShowHeight.value * imageDetailData.value.aspect_ratio;
    }
    else if (imageDetailData.value.aspect_ratio < 1.25) {
      imgShowWidth.value = 0.3 * window.innerWidth;
      imgShowHeight.value =
        imgShowWidth.value / imageDetailData.value.aspect_ratio;
    } else {
      imgShowWidth.value = 0.5 * window.innerWidth;
      imgShowHeight.value =
        imgShowWidth.value / imageDetailData.value.aspect_ratio;
    }
  });
};
const overlayClosed = () => {
  imageDetailData.value = null;
};
let imgShowWidth = ref();
let imgShowHeight = ref();

const toUrl = (url: string) => {
  window.open(url, "_blank");
};

const patchImage = (image: imageObject) => {
  image.patchLoading = true
  image.accessable = !image.accessable
  Axios.patch(`/image/${image.id}`, image).then(res => {
    if (res.status === 200) {
      image.patchLoading = false
      image = res.data
      return res.data
    }
  }).catch((e) => {
    console.error(e)
    image.accessable = !image.accessable
    image.patchLoading = false
  });
};
let isHoverBtn = ref(false);

let isUpdating = ref(false);
const filterUpdate = async () => {
  if (isUpdating.value) return
  isUpdating.value = true
  clear()
  await getImages()
  refresh.value = false
  await nextTick(() => {
    refresh.value = true;
    isUpdating.value = false
  })
}
const clear = () => {
  colHeight = {
    col1: 0,
    col2: 0,
    col3: 0
  }
  col1 = []
  col2 = []
  col3 = []
  cols.value = [[], [], []];
  images.value = undefined;
  currentOffset.value = 0
}
let tags = ref([]);
let tagSelectorLoading = ref(false)
const getTags = () => {
  Axios.get("/tags").then((res) => {
    tagSelectorLoading.value = true
    if (res.status === 200) {
      tags.value = res.data
      tagSelectorLoading.value = false
      return res.data
    }
  })
}
getTags()
</script>
<template>
  <v-dialog max-width="600" @afterLeave="filterUpdate()">
    <template v-slot:activator="{ props }">
      <v-fab v-bind="props" :icon='mdiFilterOutline' class='fab'>
      </v-fab>
    </template>
    <template v-slot:default="{ isActive }">
      <v-card class="filter-card">
        <div style="font-weight: bolder; font-size: 1.3rem;">筛选条件</div>
        <v-divider style="margin: 0.5rem 0"></v-divider>
        <v-form>
          <v-autocomplete :loading="tagSelectorLoading" closable-chips clearable chips multiple label="标签/Tags"
            v-model="params.tags" :items="tags" item-title="search_string" item-value="name">
            <template v-slot:item="{ props, item }">
              <v-list-item v-bind="props" :subtitle="item.raw.translated_name" :title="item.raw.name"></v-list-item>
            </template>
          </v-autocomplete>
          <v-text-field v-model="params.author" label="作者/Author" />
          <v-range-slider thumb-label="true" min="0" max="10" v-model="params.ratioRange" strict
            label="宽高比/Ratio Range"></v-range-slider>
          <v-checkbox v-model="params.desc" label="倒序排列"></v-checkbox>
          <span v-if='store.user.token'>
            <v-checkbox v-model="params.accessable" label="Only Accessible"></v-checkbox>
            <v-checkbox v-model="params.unaccessable" label="Only Not Accessible"></v-checkbox>
          </span>
        </v-form>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text="应用" @click="filterUpdate()"></v-btn>
          <v-btn text="确认" @click="isActive.value = false"></v-btn>
        </v-card-actions>
      </v-card>
    </template>
  </v-dialog>

  <v-overlay scroll-strategy="none" v-if="imageDetailData" z-index="10000" v-model="overlay"
    :class="imageDetailData.aspect_ratio >= 1.25 ? 'overlay' : 'overlay align-center'" @after-leave="overlayClosed()">
    <div class="container-cols" v-if="imageDetailData" :style="{
      gridTemplateColumns:
        imageDetailData.aspect_ratio >= 1.25 ? '1fr' : 'auto 1fr',
    }">
      <div class="img-container">
        <v-img :lazy-src="imageDetailData.src + '/scale_to_1080x1080'" :width="imgShowWidth" :height="imgShowHeight"
          :src="imageDetailData.src" @load="imageDetailData.loaded = true">
          <template v-slot:placeholder v-if="!imageDetailData.loaded">
            <div class="d-flex align-center justify-center fill-height">
              <v-progress-circular color="blue-lighten-4" indeterminate></v-progress-circular>
            </div>
          </template>
        </v-img>
        <div class="color-container" :style="{
          gridTemplateColumns: `repeat(${imageDetailData.aspect_ratio < 0.7 ? '5' : '10'
            }, 1fr)`,
          height: `${imageDetailData.aspect_ratio < 0.7 ? '4.3rem' : '2rem'}`,
        }" v-if="imageDetailData.colors">
          <div v-for="color of imageDetailData.colors.colors">
            <v-tooltip location="top" class="color-card" :text="`rgb(${color[0]}, ${color[1]}, ${color[2]})`">
              <template class="color-card" v-slot:activator="{ props }">
                <v-card hover class="color-card" v-bind="props" :style="{
                  backgroundColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
                }"></v-card>
              </template>
            </v-tooltip>
          </div>
        </div>
      </div>
      <v-card class="info" :style="{
        width: `${imgShowWidth}px`,
      }">
        <div class="info" v-if="imageDetailData">
          <h1>{{ imageDetailData.title }}</h1>
          <div class="tags">
            <v-chip class="tag" v-for="tag of imageDetailData.tags">
              <div class="tag-info">
                <div>{{ tag.name }}</div>
                <div class="extra">{{ tag.translated_name }}</div>
              </div>
            </v-chip>
          </div>
          <v-divider></v-divider>
          <div class="author" style="margin-top: 1rem">
            <h3>画师信息 / Author</h3>
            <div class="name">{{ imageDetailData.author.name }}</div>
            <div class="platform">{{ imageDetailData.author.platform }}</div>
            <div>{{ imageDetailData.author.platform_id }}</div>
            <div class="link" @click="
              toUrl(
                `https://www.pixiv.net/users/${imageDetailData.author.platform_id}`
              )
              ">
              画师主页 -
              {{
                `https://www.pixiv.net/users/${imageDetailData.author.platform_id}`
              }}
            </div>
          </div>
          <div style="margin-top: 1rem" class="origin">
            <h3>原作信息 / Origin</h3>
            <div class="link" @click="toUrl(imageDetailData.source_url)">
              图片源/Source - {{ imageDetailData.source_url }}
            </div>
            <div>
              分辨率/Resolution: {{ imageDetailData.width }}×{{
                imageDetailData.height
              }}
            </div>
            <div>宽高比/AspectRatio: {{ imageDetailData.aspect_ratio }}</div>
          </div>
        </div>
        <v-card-actions>
          <v-btn style="font-weight: bold" @click="toUrl(imageDetailData.src)" text="在新标签页中打开此图像"></v-btn>
        </v-card-actions>
      </v-card>
    </div>
  </v-overlay>
  <v-container v-if="cols" class="container">
    <v-infinite-scroll v-if="refresh" :onLoad="loadData">
      <v-row no-gutters>
        <v-col v-for="colIndex of [0, 1, 2]">
          <template v-for="image of cols[colIndex]">
            <v-hover v-slot="{ isHovering, props }">
              <v-img v-bind="props" class="image" :src="image.src + '/scale_to_1080x1080'" @load="image.loaded = true"
                :width="colWidth" :height="colWidth / image.aspect_ratio" :style="{
                  backgroundColor: image.primary_color
                    ? `rgba(${image.primary_color[0]}, ${image.primary_color[1]}, ${image.primary_color[2]}, 0.5)`
                    : 'rgba(0,0,0,0)',
                }" @click="isHoverBtn ? null : showDetail(image.id)">
                <v-chip v-if='store.user.token' label :color="image.accessable ? 'green' : 'red'" class="admin-chip"
                  :style="{ opacity: isHovering ? '0' : '1', transition: 'opacity 0.2s' }" size="small">{{
                    image.accessable ? "可访问" : "不可访问"
                  }}</v-chip>
                <template v-slot:placeholder v-if="!image.loaded">
                  <div class="d-flex align-center justify-center fill-height">
                    <v-progress-circular color="grey-lighten-4" indeterminate></v-progress-circular>
                  </div>
                </template>
                <v-overlay :model-value="isHovering" class="img-overlay" :width="colWidth"
                  :height="colWidth / image.aspect_ratio" contained :content-props="{ class: 'overlay-content' }">
                  <v-btn v-if='store.user.token' :loading="image.patchLoading"
                    :color="image.patchLoading ? 'warning' : image.accessable ? 'green' : 'red'" class="admin-btn"
                    size="x-small" @click="patchImage(image)" @mouseover="isHoverBtn = true"
                    @mouseleave="isHoverBtn = false">{{
                      image.accessable ? "可访问" : "不可访问" }}</v-btn>
                  <div class="inner-container" :width="colWidth" :height="colWidth / image.aspect_ratio"
                    :style="{ height: `${colWidth / image.aspect_ratio}px` }">
                    <div class="title" :style="{ width: `${colWidth}px` }">
                      {{ image.title }}
                    </div>
                    <!-- <div class="id">{{ image.source_id }}</div> -->
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
        <div style="color: rgb(110, 110, 110); margin: 1rem">~ 到底儿了 ~</div>
      </template>
    </v-infinite-scroll>
  </v-container>
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
  // filter: brightness(0.8);
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
      // height: 120%;
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
    // max-width: 60vw;
    // width: max-content;
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
