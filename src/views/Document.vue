<template>
  <div class="doc-root">
    <h1>随机图片API文档</h1>
    <h2>0. Introduction / 简介</h2>
    <p>
      这是一个简单的、由 python FastAPI
      作为后端的随机图片服务。它有着不同于其它随机图片服务的调用方式，还有相对而言一些独特（也许吧）的功能。
    </p>
    <h2>1. Features / 特性一览</h2>
    <div>
      <li>半自动化爬虫，爬取Pixiv指定用户的作品（排行榜、搜索待开发；前端爬虫任务管理待开发）</li>
      <li>图片经过人工审核</li>
      <li>支持 Tags / Author 筛选</li>
      <li>返回格式可选——可以图方便直接返回图片；也可以返回包含更多信息的 json 数据</li>
      <li>有 /list 接口，你可以拿到列表之后自己随机</li>
      <li>通过聚类算法提取出每张图片的10个主色，可用于网站主题适配，也可以用作配色参考</li>
      <li>支持返回缩略图</li>
      <li>计划支持随机头像（利用 dogecloud 自带的智能裁切）</li>
    </div>
    <h2>
      2. API / 接口
    </h2>
    <div style="padding: 0 1rem">
      <h3 class="route">/</h3>
      <div>
        随机获取一张图片
        <h4>
          Params / 参数
          <li>
            
          </li>
        </h4>
        <div>
          
        </div>
      </div>
      <h3 class="route">/list</h3>
      <h3 class="route">/token</h3>

    </div>
    <h2>Statistic / 统计数据</h2>
  </div>
</template>
<script lang="ts"></script>
<style lang="scss" scoped>
.route {
  border-bottom: 0.2rem solid rgb(var(--v-theme-primary));
  width: fit-content;
}

.route::before {
  content: "";
  margin-right: 0rem;
}

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
  margin-top: 1rem;
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
