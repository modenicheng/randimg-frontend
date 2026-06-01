<template>
  <div class="container-cols" v-if="imageDetailData" :style="{
    gridTemplateColumns: imageDetailData.aspect_ratio >= 1.25 ? '1fr' : 'auto 1fr',
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
        gridTemplateColumns: `repeat(${imageDetailData.aspect_ratio < 0.7 ? '5' : '10'}, 1fr)`,
        height: `${imageDetailData.aspect_ratio < 0.7 ? '4.3rem' : '2rem'}`,
      }" v-if="imageDetailData.colors">
        <div v-for="color of imageDetailData.colors.colors" :key="color">
          <v-tooltip location="top" class="color-card" :text="`rgb(${color[0]}, ${color[1]}, ${color[2]})`">
            <template v-slot:activator="{ props }">
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
      <div class="info">
        <h1 class="text-h4">{{ imageDetailData.title }}</h1>
        <div class="d-flex flex-wrap ga-2">
          <v-chip class="tag" v-for="tag of imageDetailData.tags" :key="tag.id">
            <div class="tag-info">
              <div>{{ tag.name }}</div>
              <div class="extra">{{ tag.translated_name }}</div>
            </div>
          </v-chip>
        </div>
        <v-divider></v-divider>
        <div class="author mt-4">
          <h3 class="text-h6">画师信息 / Author</h3>
          <div class="text-body-1 font-weight-medium">{{ imageDetailData.author.name }}</div>
          <div class="text-body-2">{{ imageDetailData.author.platform }}</div>
          <div class="text-body-2">{{ imageDetailData.author.platform_id }}</div>
          <v-btn variant="text" density="compact" @click="toUrl(`https://www.pixiv.net/users/${imageDetailData.author.platform_id}`)"><v-icon size="small" class="mr-1">mdi-open-in-new</v-icon>画师主页</v-btn>
        </div>
        <div class="origin mt-4">
          <h3 class="text-h6">原作信息 / Origin</h3>
          <v-btn variant="text" density="compact" @click="toUrl(imageDetailData.source_url)"><v-icon size="small" class="mr-1">mdi-open-in-new</v-icon>图片源/Source</v-btn>
          <div class="text-body-2">
            分辨率/Resolution: {{ imageDetailData.width }}×{{ imageDetailData.height }}
          </div>
          <div class="text-body-2">宽高比/AspectRatio: {{ imageDetailData.aspect_ratio }}</div>
        </div>
      </div>
      <v-card-actions>
        <v-btn class="font-weight-bold" @click="toUrl(imageDetailData.src)" text="在新标签页中打开此图像"></v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Axios from '../axios/axios';

const props = defineProps<{
  imageId: string;
}>();

const imageDetailData = ref();
const imgShowWidth = ref();
const imgShowHeight = ref();

const getImageDetail = async () => {
  const res = await Axios.get(`/image/${props.imageId}`);
  const d = res.data
  // 转换 colors 格式：后端返回 [{rgb:[r,g,b], lab:[l,a,b]}, ...] → 前端需要 {colors: [[r,g,b], ...]}
  if (Array.isArray(d.colors) && d.colors.length && d.colors[0]?.rgb) {
    d.colors = { colors: d.colors.map((c: any) => c.rgb) }
  }
  imageDetailData.value = d;
  if (imageDetailData.value.aspect_ratio < 0.7) {
    imgShowHeight.value = 0.8 * window.innerHeight;
    imgShowWidth.value = imgShowHeight.value * imageDetailData.value.aspect_ratio;
  } else if (imageDetailData.value.aspect_ratio < 1.25) {
    imgShowWidth.value = 0.3 * window.innerWidth;
    imgShowHeight.value = imgShowWidth.value / imageDetailData.value.aspect_ratio;
  } else {
    imgShowWidth.value = 0.5 * window.innerWidth;
    imgShowHeight.value = imgShowWidth.value / imageDetailData.value.aspect_ratio;
  }
};

const toUrl = (url: string) => {
  window.open(url, "_blank");
};

onMounted(() => {
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

.fab {
  position: fixed;
  bottom: 5rem;
  right: 5rem;
}

.filter-card {
  padding: 1rem;
}
</style>