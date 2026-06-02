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
    platform_id?: number | string;
    [property: string]: any;
}

export interface Colors {
    colors: Array<number[]>;
    [property: string]: any;
}

export interface Tag {
    id: number;
    name: string;
    translated_name?: string;
    [property: string]: any;
}

let image = ref<RandomImageRequest>()

const getImage = () => {
    loading.value = true
    Axios.get('/')
        .then(res => {
            let data = res.data
            // 转换 colors 格式
            if (Array.isArray(data.colors) && data.colors.length && data.colors[0]?.rgb) {
                data.colors = { colors: data.colors.map((c: any) => c.rgb) }
            }
            // 转换 primary_color 格式
            if (data.primary_color?.rgb) {
                data.primary_color = data.primary_color.rgb
            }
            url.value = data.src
            image.value = data
            loading.value = false
        })
}

onMounted(() => {
    getImage()
})

</script>