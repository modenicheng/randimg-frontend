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
import { ref } from 'vue';
import Axios from '../axios/axios';

let url = ref()
let loading = ref(true)
/**
 * Request
 */
export interface RandomImageRequest {
    aspect_ratio: number;
    author: Author[];
    colors: Colors;
    height: number;
    id: number;
    src: string;
    source_id: number;
    source_url: string;
    tags: Tag[];
    title: string;
    width: number;
    [property: string]: any;
}

export interface Author {
    homepage?: string;
    id?: number;
    name?: string;
    platform?: string;
    [property: string]: any;
}

export interface Colors {
    color_primary: number[];
    color_series: Array<number[]>;
    [property: string]: any;
}

export interface Tag {
    id: number;
    name: string;
    num: number;
    [property: string]: any;
}

let image = ref<RandomImageRequest>()

const getImage = () => {
    loading.value = true
    Axios.get('/')
        .then(res => {
            let data: RandomImageRequest = res.data
            url.value = data.src
            image.value = data
            loading.value = false
        })
}

getImage()

</script>