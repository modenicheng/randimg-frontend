<script setup>
import { useRouter, useRoute } from "vue-router";
import { ref } from "vue";
import { routes } from "../router/router";
import Axios from "../axios/axios";

const router = useRouter();
const route = useRoute();
let navList = ref([]);
for (let item of routes) {
  if (item.name === "Home") {
    for (let c of item.children) {
      if (c.meta.navigator) {
        navList.value.push(c);
      }
    }
  }
}
</script>
<template>
  <v-layout class="rounded rounded-md">
    <v-app-bar title="随机图片API"></v-app-bar>

    <v-navigation-drawer>
      <v-list>
        <v-list-item link v-for="it in navList" :title="it.meta.title" @click="router.push({ name: it.name })">
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-main id="main" class="d-flex align-center justify-center main" style="min-height: 100%; flex-direction: column">
      <!-- <v-main id="main"> -->
      <router-view></router-view>
    </v-main>
  </v-layout>
</template>
<style scoped lang="scss">
.main {
  min-height: 100%;
  width: 100%;
  position: absolute
}
</style>
