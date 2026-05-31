<script setup>
import { useRouter, useRoute } from "vue-router";
import { ref } from "vue";
import { routes } from "../router/router";
import Axios from "../axios/axios";
import { useTheme } from 'vuetify'
import { useUserStore } from "../store/store";
import { mdiThemeLightDark } from '@mdi/js';

const icons = {mdiThemeLightDark}

const store = useUserStore()
const router = useRouter();
const route = useRoute();
let navList = ref([]);
for (let item of routes) {
  if (item.name === "Home") {
    for (let c of item.children) {
      if (c.meta.navigator && (!c.meta.requireAuth || store.user.token)) {
        navList.value.push(c);
      }
    }
  }
}

const theme = useTheme()
theme.global.name.value = store.user.theme
const toggleTheme = () => {
  theme.global.name.value = theme.global.current.value.dark ? 'light' : 'dark'
  store.setTheme(theme.global.name.value)
}

</script>
<template>
  <v-layout class="rounded rounded-md">
    <v-app-bar title="随机图片API">
      <v-spacer></v-spacer>
      <v-btn icon @click="toggleTheme()">
        <v-icon :icon="mdiThemeLightDark"></v-icon>
      </v-btn>

    </v-app-bar>

    <v-navigation-drawer>
      <v-list>
        <v-list-item link v-for="it in navList" :title="it.meta.title" @click="router.push({ name: it.name })">
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-main id="main" class="d-flex align-center main" style="min-height: 100%; flex-direction: column">
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
