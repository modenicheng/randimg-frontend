<template>
  <div class="head-page">
    <h1>随机图片API</h1>
    <br>
    <div class="extra">这只是一个什么都没有的主页</div>
    <div class="extra">不过它非常简约</div>
    <!-- <div class="extra">在这里，简约成了这个主页最大的意义和价值</div> -->
    <br>
    <div class="extra">欢迎使用本随机图片 API</div>
    <div class="extra">（搭建这个 API 的人并不知道该给它起什么名字）</div>
  </div>
</template>
<script setup lang="ts">
</script>
<style scoped lang="scss">
.head-page {
  // position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  width: 100%;
  padding: 10rem;
  height: 100vh;
}
div {
  user-select: none;
}
.extra {
  opacity: 0.6;
}
</style>
