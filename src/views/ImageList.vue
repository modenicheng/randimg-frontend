<script setup lang="ts">
import Axios from "../axios/axios";
import { computed, onMounted, ref, watch } from "vue";

interface imageList {
  id: number;
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
    if (imageDetailData.value.aspect_ratio < 0.6) {
      imgShowHeight.value = 38 * parseFloat(getComputedStyle(document.documentElement).fontSize)
      imgShowWidth.value = imgShowHeight.value * imageDetailData.value.aspect_ratio
    } else {
      imgShowWidth.value = imgWidth.value
      imgShowHeight.value = imgShowWidth.value / imageDetailData.value.aspect_ratio
    }
  });

};
const overlayClosed = () => {
  imageDetailData.value = null;
}
let imgShowWidth = ref()
let imgShowHeight = ref()
let imgWidth = computed(() => {
  return 25 * parseFloat(getComputedStyle(document.documentElement).fontSize)
})
const imgRef = ref()
</script>
<template>
  <v-overlay v-model="overlay" class="overlay" @after-leave="overlayClosed()">
    <div class="container-cols">
      <div v-if="imageDetailData">
        <v-img :lazy-src="imageDetailData.src + '/scale_to_1080x1080'" :width="imgShowWidth" :height="imgShowHeight"
          ref="imgRef" :src="imageDetailData.src" @load="imageDetailData.loaded = true">
          <template v-slot:placeholder v-if="!imageDetailData.loaded">
            <div class="d-flex align-center justify-center fill-height">
              <v-progress-circular color="blue-lighten-4" indeterminate></v-progress-circular>
            </div>
          </template>
        </v-img>
        <div class="color-container">
          <div v-for="color of imageDetailData.colors.colors">
            <v-tooltip location="top" class="color-card" :text="`rgb(${color[0]}, ${color[1]}, ${color[2]})`">
              <template class="color-card" v-slot:activator="{ props }">
                <v-card class="color-card" v-bind="props"
                  :style="{ backgroundColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})` }"></v-card>
              </template>
            </v-tooltip>
          </div>
        </div>
      </div>
      <v-card class="info">
        <div class="info" v-if="imageDetailData">
          <h2>{{ imageDetailData.title }}</h2>
          <div class="tags">
            <v-chip class="tag" v-for="tag of imageDetailData.tags">
              <div>{{ tag.name }}</div>
              <!-- <div>{{ tag.translated_name }}</div> -->
            </v-chip>
          </div>
          <v-divider></v-divider>
          <div>{{ imageDetailData.author }}</div>
          <div>{{ imageDetailData.source_url }}</div>
        </div>
      </v-card>
    </div>
  </v-overlay>
  <v-container v-if="cols" class="container">
    <v-infinite-scroll :onLoad="loadData">
      <v-row no-gutters>
        <v-col>
          <template v-for="image of cols[0]">
            <v-img class="image" :src="image.src + '/scale_to_1080x1080'" @load="image.loaded = true" :width="colWidth"
              :height="colWidth / image.aspect_ratio" :style="{
                backgroundColor: `rgba(${image.primary_color[0]}, ${image.primary_color[1]}, ${image.primary_color[2]}, 0.5)`,
              }" @click="showDetail(image.id)">
              <template v-slot:placeholder v-if="!image.loaded">
                <div class="d-flex align-center justify-center fill-height">
                  <v-progress-circular color="grey-lighten-4" indeterminate></v-progress-circular>
                </div>
              </template>
            </v-img>
          </template>
        </v-col>
        <v-col>
          <template v-for="image of cols[1]">
            <v-img class="image" :src="image.src + '/scale_to_1080x1080'" @load="image.loaded = true" :width="colWidth"
              :height="colWidth / image.aspect_ratio" :style="{
                backgroundColor: `rgba(${image.primary_color[0]}, ${image.primary_color[1]}, ${image.primary_color[2]}, 0.5)`,
              }" @click="showDetail(image.id)">
              <template v-slot:placeholder v-if="!image.loaded">
                <div class="d-flex align-center justify-center fill-height">
                  <v-progress-circular color="grey-lighten-4" indeterminate></v-progress-circular>
                </div>
              </template>
            </v-img>
          </template>
        </v-col>
        <v-col>
          <template v-for="image of cols[2]">
            <v-img class="image" :src="image.src + '/scale_to_1080x1080'" @load="image.loaded = true" :width="colWidth"
              :height="colWidth / image.aspect_ratio" :style="{
                backgroundColor: `rgba(${image.primary_color[0]}, ${image.primary_color[1]}, ${image.primary_color[2]}, 0.5)`,
              }" @click="showDetail(image.id)">
              <template v-slot:placeholder v-if="!image.loaded">
                <div class="d-flex align-center justify-center fill-height">
                  <v-progress-circular color="grey-lighten-4" indeterminate></v-progress-circular>
                </div>
              </template>
            </v-img>
          </template>
        </v-col>
      </v-row>
      <template v-slot:empty>
        <div style="color: rgb(110, 110, 110); margin: 1rem">~ 到底儿了 ~</div>
      </template>
    </v-infinite-scroll>
  </v-container>
  <v-pagination></v-pagination>
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
  filter: brightness(0.8);
}

.container {
  width: auto;
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
  }

  .info {
    min-width: 30rem;
    max-width: 60vw;
    width: max-content;
    padding: 1rem;
    height: auto;

    .tags {
      width: 100%;

      .tag {
        margin: 0 0.5rem 0.5rem 0;
      }
    }
  }

  .color-container {
    .color-card {
      width: 100%;
      height: 100%
    }

    margin: 1rem 0 0 0;
    display:grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 0.5rem;
    height: 2rem;
  }

}
</style>
