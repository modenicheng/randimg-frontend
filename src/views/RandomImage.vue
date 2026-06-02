<template>
    <v-img :src="url" :aspectRatio="image?.aspect_ratio" class="image" :height="image?.height" :width="image?.width">
        <template v-slot:placeholder v-if="!loading">
            <div class="d-flex align-center justify-center fill-height">
                <v-progress-circular color="grey-lighten-4" indeterminate></v-progress-circular>
            </div>
        </template>
    </v-img>
    {{ url }}
</template>
<style scoped lang="scss">
// .image {
//     max-height: 100%;
//     max-width: 100%;
//     width: 100%
// }
</style>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Axios from '../axios/axios';
import { normalizeColorPalette, normalizePrimaryColor } from '../utils/colorNormalization';
import type { Author, ImageTag } from '../types/api';

let url = ref()
let loading = ref(true)
/**
 * Request
 */
export interface RandomImageRequest {
    aspect_ratio: number;
    author: Author;
    colors: Colors;
    height: number;
    id: number;
    src: string;
    source_id: number;
    source_url: string;
    tags: ImageTag[];
    title: string;
    width: number;
    [property: string]: any;
}

export interface Colors {
    colors: Array<number[]>;
    [property: string]: any;
}

let image = ref<RandomImageRequest>()

const getImage = () => {
    loading.value = true
    Axios.get('/')
        .then(res => {
            let data = res.data
            normalizeColorPalette(data)
            data.primary_color = normalizePrimaryColor(data.primary_color)
            url.value = data.src
            image.value = data
            loading.value = false
        })
}

onMounted(() => {
    getImage()
})

</script>