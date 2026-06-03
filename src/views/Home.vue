<script setup lang="ts">
import { useRouter, useRoute } from "vue-router";
import type { RouteRecordName } from "vue-router";
import { computed, ref, watch } from "vue";
import { routes } from "../router/router";
import { useDisplay, useTheme } from 'vuetify'
import { useUserStore } from "../store/store";
import { mdiThemeLightDark } from '@mdi/js';

const store = useUserStore()
const router = useRouter();
const route = useRoute();
const drawer = ref(false);
const { mdAndUp } = useDisplay();
const navList = computed(() => {
  const home = routes.find(r => r.name === "Home")
  return (home?.children ?? []).filter(c =>
    c.meta.navigator && (!c.meta.requireAuth || store.user.token)
  )
})

const theme = useTheme()
theme.global.name.value = store.user.theme
const toggleTheme = () => {
  const nextTheme = theme.global.current.value.dark ? 'light' : 'dark'
  theme.global.name.value = nextTheme
  store.setTheme(nextTheme)
}

const navigateTo = (name: RouteRecordName | undefined) => {
  if (!name) return;
  router.push({ name });
  if (!mdAndUp.value) {
    drawer.value = false;
  }
}

watch(mdAndUp, (isDesktop) => {
  drawer.value = isDesktop;
}, { immediate: true });

</script>
<template>
  <v-layout class="rounded rounded-md">
    <v-app-bar elevation="1">
      <v-app-bar-nav-icon
        v-if="!mdAndUp"
        aria-label="展开菜单"
        @click.stop="drawer = !drawer"
      ></v-app-bar-nav-icon>
      <v-app-bar-title>随机图片API</v-app-bar-title>
      <v-spacer></v-spacer>
      <v-btn icon @click="toggleTheme()">
        <v-icon :icon="mdiThemeLightDark"></v-icon>
      </v-btn>

    </v-app-bar>

    <v-navigation-drawer
      v-model="drawer"
      :permanent="mdAndUp"
      :temporary="!mdAndUp"
    >
      <v-list>
        <v-list-item
          v-for="it in navList"
          :key="it.name"
          link
          :active="route.name === it.name"
          :title="it.meta.title"
          @click="navigateTo(it.name)"
        >
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
