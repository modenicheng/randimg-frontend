<script setup lang="ts">
import Axios from '../axios/axois';
import { onMounted, ref } from 'vue';

interface imageList { id: number, src: string, title: string, source_id: number, loaded: boolean | undefined, aspect_ratio: number }
let images = ref<[imageList]>();


let limit = ref(40)
const getImages = async (offset: number, limit: number) => {
	Axios.get(`/list?offset=${offset}&limit=${limit}`)
		.then(res => {
			if (res.status === 200) {
				images.value = res.data
				if (images.value) {
					cols.value = calcImageCol(images.value)
				} else {

				}
				currentOffset.value += limit
			}
		})
}

let col1 = []
let col2 = []
let col3 = []
let colHeight = {
	col1: 0,
	col2: 0,
	col3: 0
}
let colWidth = ref(window.innerWidth / 6)
const calcImageCol = (images: [imageList]) => {
	for (let image of images) {
		let h = 1 / image.aspect_ratio
		let minINdex = getMinCol(colHeight)
		switch (minINdex) {
			case 0:
				col1.push(image)
				colHeight.col1 += h
				break
			case 1:
				col2.push(image)
				colHeight.col2 += h
				break
			case 2:
				col3.push(image)
				colHeight.col3 += h
		}
	}
	return [col1, col2, col3]
}

const getMinCol = (colHeight: {
	col1: number,
	col2: number,
	col3: number
}) => {
	let m = Math.min(colHeight.col1, colHeight.col2, colHeight.col3)
	switch (m) {
		case colHeight.col1:
			return 0
		case colHeight.col2:
			return 1
		case colHeight.col3:
			return 2
	}
}
let cols = ref<imageList[][]>()
let currentOffset = ref(0)
getImages(currentOffset.value, limit.value)
const loadData = async ({ done }: any) => {
	console.log(currentOffset.value)
	await getImages(currentOffset.value, limit.value)
	done('ok')
}
onMounted(() => {
	addEventListener('resize', () => {
		colWidth.value = window.innerWidth / 6
	})
})
</script>
<template>
	<v-container v-if="cols"class='container'>
		<v-infinite-scroll :onLoad="loadData">
			<v-row no-gutters>
				<v-col>
					<template v-for="image of cols[0]">
						<v-img class="image" :src="image.src" @load="image.loaded = true" :width="colWidth"
							:height="colWidth / image.aspect_ratio">
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
						<v-img class="image" :src="image.src + '/scale_to_1080x1080'" @load="image.loaded = true"
							:width="colWidth" :height="colWidth / image.aspect_ratio">
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
						<v-img class="image" :src="image.src" @load="image.loaded = true" :width="colWidth"
							:height="colWidth / image.aspect_ratio">
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
				<v-alert type="warning">No more items!</v-alert>
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
	filter: brightness(0.8)
}
.container {
	width: auto;
}
</style>