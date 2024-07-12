<template>
  <div class="doc-root">
    <h1>随机图片API文档</h1>
    <h2>0. Introduction/简介</h2>
    <p>
      这是一个简单的、由 python FastAPI
      作为后端的随机图片服务。它有着不同于其它随机图片服务的调用方式，还有相对而言一些独特的功能。
    </p>
    <h2>1. Features/特性一览</h2>
    <div>
      <li>半自动化爬虫，爬取Pixiv指定用户的作品（排行榜、搜索待开发）</li>
      <li>以</li>
      <li></li>
      <li></li>
      <li></li>
    </div>
  </div>
</template>
<script lang="ts"></script>
<style lang="scss" scoped>
.doc-root {
  display: flex;
  justify-content: left;
  flex-direction: column;
  width: 80%;
  padding: 4rem 0;
  gap: 1rem;
}
h1 {
  position: relative;
}
h2 {
  position: relative;
  left: -1.5rem;
}
h2::before {
  content: "#";
  margin-right: 0.5rem;
  position: relative;
  color: rgb(var(--v-theme-primary));
}
h3 {
  position: relative;
  left: -1.5rem;
}
h3::before {
  content: "#";
  margin-right: 0.5rem;
  position: relative;
  color: rgb(var(--v-theme-primary));
}
</style>
