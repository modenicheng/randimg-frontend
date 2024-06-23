<script setup>
import { useRouter, useRoute } from 'vue-router';
import { ref } from 'vue'
import { routes } from '../router/router';
import siLog from 'si-log'
import Axios from '../axios/axois';

const l = siLog.create('Home.vue')
const router = useRouter()
const route = useRoute()
let navList = ref([])
for (let item of routes) {
  l.debug(item)
  if (item.name === 'Home') {
    for (let c of item.children) {
      if (c.meta.navigator) {
        navList.value.push(c)
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

    <v-main class="d-flex align-center justify-center" style="min-height: 300px;">
      <router-view></router-view>
    </v-main>
  </v-layout>
</template>