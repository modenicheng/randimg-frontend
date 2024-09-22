<template>
    <div>
        <ImageDetail :imageId="imageId" />
    </div>
</template>

<script setup lang="ts">
import ImageDetail from '../components/imageDetail.vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const imageId: string = route.params.id as string;

</script>