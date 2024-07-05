<script setup lang="ts">
import Axios from "../axios/axios";
import { onMounted, ref } from "vue";

interface Author {
  id: number;
  name: string;
  platform: string;
  platform_id: number;
}
interface imageList {
  id: number;
  author: Author;
  src: string;
  title: string;
  source_id: number;
  loaded: boolean | undefined;
  aspect_ratio: number;
  primary_color: [number, number, number];
}
let images = ref<[imageList]>();
let is_empty = ref(false);

let limit = ref(40);
const getImages = async () => {
  await Axios.get(
    `/list?offset=${currentOffset.value}&limit=${limit.value}`
  ).then((res) => {
    if (res.status === 200) {
      if (res.data) {
        images.value = res.data;
        cols.value = calcImageCol(res.data);
        currentOffset.value += limit.value;
        if (res.data.length < limit.value) {
          is_empty.value = true;
        }
      } else {
      }
    }
  });
};

let col1 = [];
let col2 = [];
let col3 = [];
let colHeight = {
  col1: 0,
  col2: 0,
  col3: 0,
};
let colWidth = ref(Math.floor(window.innerWidth / 7.5));
const calcImageCol = (images: [imageList]) => {
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
let cols = ref<imageList[][]>();
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
    if (imageDetailData.value.aspect_ratio < 0.605) {
      imgShowHeight.value = 0.8 * window.innerHeight;
      imgShowWidth.value =
        imgShowHeight.value * imageDetailData.value.aspect_ratio;
    }
    // else if (imageDetailData.value.aspect_ratio > 0.8 && imageDetailData.value.aspect_ratio <= 1.35) {
    //   imgShowWidth.value = imgWidth.value / 30 * 40;
    //   imgShowHeight.value =
    //     imgShowWidth.value / imageDetailData.value.aspect_ratio;
    // } 
    else if (imageDetailData.value.aspect_ratio < 1.35) {
      imgShowWidth.value = 0.3 * window.innerWidth;
      imgShowHeight.value = imgShowWidth.value / imageDetailData.value.aspect_ratio;
    } else {
      imgShowWidth.value = 0.6 * window.innerWidth;
      imgShowHeight.value = imgShowWidth.value / imageDetailData.value.aspect_ratio;
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
</script>
<template>
  <v-overlay z-index="10000" v-model="overlay" class="overlay" @after-leave="overlayClosed()">
    <div class="container-cols" v-if="imageDetailData"
      :style="{ gridTemplateColumns: imageDetailData.aspect_ratio >= 1.35 ? '1fr' : 'auto 1fr' }">
      <div>
        <v-img :lazy-src="imageDetailData.src + '/scale_to_1080x1080'" :width="imgShowWidth" :height="imgShowHeight"
          :src="imageDetailData.src" @load="imageDetailData.loaded = true">
          <template v-slot:placeholder v-if="!imageDetailData.loaded">
            <div class="d-flex align-center justify-center fill-height">
              <v-progress-circular color="blue-lighten-4" indeterminate></v-progress-circular>
            </div>
          </template>
        </v-img>
        <div class="color-container"
          :style="{ gridTemplateColumns: `repeat(${imageDetailData.aspect_ratio < 0.605 ? '5' : '10'}, 1fr)`, height: `${imageDetailData.aspect_ratio < 0.605 ? '4.3rem' : '2rem'}` }">
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
      <v-card class="info">
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
          <div class="author" style="margin-top: 1rem;">
            <h3>画师信息 / Author</h3>
            <div class="name">{{ imageDetailData.author.name }}</div>
            <div class="platform">{{ imageDetailData.author.platform }}</div>
            <div>{{ imageDetailData.author.platform_id }}</div>
            <div class="link" @click="toUrl(`https://www.pixiv.net/users/${imageDetailData.author.platform_id}`)">画师主页 -
              {{ `https://www.pixiv.net/users/${imageDetailData.author.platform_id}` }}</div>
          </div>
          <div style="margin-top: 1rem;" class="origin">
            <h3>原作信息 / Origin</h3>
            <div class="link" @click="toUrl(imageDetailData.source_url)">图片源/Source - {{ imageDetailData.source_url }}
            </div>
            <div>分辨率/Resolution: {{ imageDetailData.width }}×{{ imageDetailData.height }}</div>
            <div>宽高比/AspectRatio: {{ imageDetailData.aspect_ratio }}</div>
          </div>
        </div>
        <v-card-actions>
          <v-btn style="font-weight: bold;" @click="toUrl(imageDetailData.src)" text='在新标签页中打开此图像'></v-btn>
        </v-card-actions>
      </v-card>
    </div>
  </v-overlay>
  <v-container v-if="cols" class="container">
    <v-infinite-scroll :onLoad="loadData">
      <v-row no-gutters>
        <v-col>
          <template v-for="image of cols[0]">
            <v-hover v-slot="{ isHovering, props }">
              <v-img v-bind="props" class="image" :src="image.src + '/scale_to_1080x1080'" @load="image.loaded = true"
                :width="colWidth" :height="colWidth / image.aspect_ratio" :style="{
                  backgroundColor: `rgba(${image.primary_color[0]}, ${image.primary_color[1]}, ${image.primary_color[2]}, 0.5)`,
                }" @click="showDetail(image.id)">
                <template v-slot:placeholder v-if="!image.loaded">
                  <div class="d-flex align-center justify-center fill-height">
                    <v-progress-circular color="grey-lighten-4" indeterminate></v-progress-circular>
                  </div>
                </template>
                <v-overlay :model-value="isHovering" class="img-overlay" contained>
                  <div class="inner-container" :style="{width: `${colWidth}px`}">
                    <div class="title">{{ image.title }}</div>
                    <div class="id">{{ image.source_id }}</div>
                    <div>{{ image.author.name }}</div>
                    <div>#{{ image.id }}</div>
                  </div>
                </v-overlay>
              </v-img>
            </v-hover>
          </template>
        </v-col>
        <v-col>
          <template v-for="image of cols[1]">
            <v-hover v-slot="{ isHovering, props }">
              <v-img v-bind="props" class="image" :src="image.src + '/scale_to_1080x1080'" @load="image.loaded = true"
                :width="colWidth" :height="colWidth / image.aspect_ratio" :style="{
                  backgroundColor: `rgba(${image.primary_color[0]}, ${image.primary_color[1]}, ${image.primary_color[2]}, 0.5)`,
                }" @click="showDetail(image.id)">
                <template v-slot:placeholder v-if="!image.loaded">
                  <div class="d-flex align-center justify-center fill-height">
                    <v-progress-circular color="grey-lighten-4" indeterminate></v-progress-circular>
                  </div>
                </template>
                <v-overlay :model-value="isHovering" class="img-overlay" contained>
                  <div class="inner-container" :style="{width: `${colWidth}px`}">
                    <div class="title">{{ image.title }}</div>
                    <div class="id">{{ image.source_id }}</div>
                    <div>{{ image.author.name }}</div>
                    <div>#{{ image.id }}</div>
                  </div>
                </v-overlay>
              </v-img>
            </v-hover>
          </template>
        </v-col>
        <v-col>
          <template v-for="image of cols[2]">
            <v-hover v-slot="{ isHovering, props }">
              <v-img v-bind="props" class="image" :src="image.src + '/scale_to_1080x1080'" @load="image.loaded = true"
                :width="colWidth" :height="colWidth / image.aspect_ratio" :style="{
                  backgroundColor: `rgba(${image.primary_color[0]}, ${image.primary_color[1]}, ${image.primary_color[2]}, 0.5)`,
                }" @click="showDetail(image.id)">
                <template v-slot:placeholder v-if="!image.loaded">
                  <div class="d-flex align-center justify-center fill-height">
                    <v-progress-circular color="grey-lighten-4" indeterminate></v-progress-circular>
                  </div>
                </template>
                <v-overlay content-class="content" :model-value="isHovering" class="img-overlay" contained style="width: 100%;">
                  <div class="inner-container" :style="{width: `${colWidth}px`}">
                    <div class="title">{{ image.title }}</div>
                    <div class="id">{{ image.source_id }}</div>
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
  border-radius: 0.5rem;
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
  width: 100%;

  div {
    width: 100%
  }

  .content {
    width: 100% !important;
  }

  .title {
    font-size: 1.5rem;
    font-weight: bold
  }

  .inner-container {
    user-select: none;
    -moz-user-select: none;
    padding: 0.2rem 0.5rem;
    width: 100%;
    color: rgb(var(--v-theme-background));
    background: linear-gradient(to top, rgba(var(--v-theme-on-surface), 0.8), rgba(var(--v-theme-on-surface), 0));
  }
}

.overlay {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;

  .container-cols {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 1rem;
    max-height: 100vh;
    overflow: auto;
  }

  .info {
    min-width: 30rem;
    max-width: 60vw;
    // width: max-content;
    padding: 1rem;
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
      background-color: rgba(130, 130, 130, 0.1)
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
</style>
