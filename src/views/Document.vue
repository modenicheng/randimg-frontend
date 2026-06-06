<template>
  <v-container class="doc-root">
    <h1 class="doc-title">随机图片 API 文档</h1>

    <h2 class="text-h5">0. 基本信息</h2>
    <v-list density="compact" variant="text">
      <v-list-item>生产环境 Base URL：<code class="text-primary font-weight-bold">https://imgapi.modenc.top/api/v2</code></v-list-item>
      <v-list-item>开发环境 Base URL：<code class="text-primary font-weight-bold">/api/v2</code>（Vite 代理）</v-list-item>
      <v-list-item>所有时间字段使用 UTC+8（Asia/Shanghai）格式：<code class="text-primary font-weight-bold">YYYY-MM-DD HH:MM:SS</code></v-list-item>
      <v-list-item>本页只列出公开调用接口，不包含管理、爬虫、任务或登录相关接口。</v-list-item>
    </v-list>

    <h2 class="text-h5">1. 数据结构</h2>
    <h3 class="route text-h6">ImageObject（列表接口）</h3>
    <JsonCodeBlock :code="imageObjectJson" />

    <h3 class="route text-h6">ImageDetail / RandomImageResponse</h3>
    <JsonCodeBlock :code="imageDetailJson" />

    <h2 class="text-h5">2. 颜色检索</h2>
    <p class="text-body-1">
      随机图、图片列表和专用颜色搜索接口都支持按颜色筛选。可传入 RGB 或 LAB 目标色，后端会按 CIELAB 距离匹配图片主色或调色盘。
    </p>
    <v-list density="compact" variant="text">
      <v-list-item><code class="text-primary font-weight-bold">rgb</code>：目标色，格式为 <code class="text-primary font-weight-bold">r,g,b</code>，例如 <code class="text-primary font-weight-bold">255,0,0</code>。</v-list-item>
      <v-list-item><code class="text-primary font-weight-bold">lab</code>：目标色，格式为 <code class="text-primary font-weight-bold">l,a,b</code>，例如 <code class="text-primary font-weight-bold">50,0,0</code>。</v-list-item>
      <v-list-item><code class="text-primary font-weight-bold">rgb</code> 与 <code class="text-primary font-weight-bold">lab</code> 互斥，请只传其中一个。</v-list-item>
      <v-list-item><code class="text-primary font-weight-bold">mode=primary</code> 匹配主色；<code class="text-primary font-weight-bold">mode=palette</code> 匹配 10 色调色盘。</v-list-item>
      <v-list-item><code class="text-primary font-weight-bold">max_dist</code> 是 LAB 空间中的平方距离，默认 <code class="text-primary font-weight-bold">2500</code>；数值越小匹配越严格。</v-list-item>
    </v-list>
    <JsonCodeBlock :code="colorsJson" />

    <h2 class="text-h5">3. 接口说明</h2>

    <div class="pl-4">
      <h3 class="route text-h6">GET /health</h3>
      <p class="text-body-1">健康检查。</p>
      <JsonCodeBlock :code="healthJson" />

      <h3 class="route text-h6">GET /</h3>
      <p class="text-body-1">随机返回一张图片；支持返回 JSON 或图片重定向。</p>
      <h4 class="text-subtitle-1">Query 参数</h4>
      <v-list density="compact" variant="text">
        <v-list-item><code class="text-primary font-weight-bold">format</code>: <code class="text-primary font-weight-bold">json</code> / <code class="text-primary font-weight-bold">image</code>，默认 <code class="text-primary font-weight-bold">json</code></v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">local</code>: 是否直接返回本地文件，默认 <code class="text-primary font-weight-bold">false</code></v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">ratio_floor</code>, <code class="text-primary font-weight-bold">ratio_ceil</code>: 宽高比范围，默认 <code class="text-primary font-weight-bold">0</code> 到 <code class="text-primary font-weight-bold">10</code></v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">width_floor</code>, <code class="text-primary font-weight-bold">width_ceil</code>: 图片宽度范围</v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">height_floor</code>, <code class="text-primary font-weight-bold">height_ceil</code>: 图片高度范围</v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">author</code>: 作者名，大小写不敏感</v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">tags</code>: 标签名，多个用英文逗号分隔</v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">rgb</code> / <code class="text-primary font-weight-bold">lab</code>, <code class="text-primary font-weight-bold">mode</code>, <code class="text-primary font-weight-bold">max_dist</code>: 颜色筛选参数</v-list-item>
      </v-list>

      <h3 class="route text-h6">GET /image/{id}</h3>
      <p class="text-body-1">按 ID 获取图片详情；支持 JSON 或图片重定向。</p>
      <h4 class="text-subtitle-1">Query 参数</h4>
      <v-list density="compact" variant="text">
        <v-list-item><code class="text-primary font-weight-bold">format</code>: <code class="text-primary font-weight-bold">json</code> / <code class="text-primary font-weight-bold">image</code>，默认 <code class="text-primary font-weight-bold">json</code></v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">local</code>: 是否直接返回本地文件，默认 <code class="text-primary font-weight-bold">false</code></v-list-item>
      </v-list>

      <h3 class="route text-h6">GET /list</h3>
      <p class="text-body-1">分页查询图片列表，支持筛选、排序和颜色检索。</p>
      <h4 class="text-subtitle-1">Query 参数</h4>
      <v-list density="compact" variant="text">
        <v-list-item><code class="text-primary font-weight-bold">offset</code>: 起始偏移，默认 <code class="text-primary font-weight-bold">0</code>，最大 <code class="text-primary font-weight-bold">100000</code></v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">limit</code>: 每页数量，默认 <code class="text-primary font-weight-bold">30</code>，最大 <code class="text-primary font-weight-bold">300</code></v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">desc</code>: 是否降序，默认 <code class="text-primary font-weight-bold">true</code></v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">sort_by</code>: 排序字段，可选 <code class="text-primary font-weight-bold">id</code>、<code class="text-primary font-weight-bold">width</code>、<code class="text-primary font-weight-bold">height</code>、<code class="text-primary font-weight-bold">aspect_ratio</code>、<code class="text-primary font-weight-bold">source_created_at</code>、<code class="text-primary font-weight-bold">created_at</code>、<code class="text-primary font-weight-bold">popularity</code>、<code class="text-primary font-weight-bold">distance</code></v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">ratio_floor</code>, <code class="text-primary font-weight-bold">ratio_ceil</code>: 宽高比范围</v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">width_floor</code>, <code class="text-primary font-weight-bold">width_ceil</code>: 图片宽度范围</v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">height_floor</code>, <code class="text-primary font-weight-bold">height_ceil</code>: 图片高度范围</v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">author</code>: 作者名</v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">tags</code>: 标签名，多个用英文逗号分隔</v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">rgb</code> / <code class="text-primary font-weight-bold">lab</code>, <code class="text-primary font-weight-bold">mode</code>, <code class="text-primary font-weight-bold">max_dist</code>: 颜色筛选参数</v-list-item>
      </v-list>
      <p class="text-body-1"><code class="text-primary font-weight-bold">sort_by=distance</code> 需要和颜色筛选参数一起使用，用于按颜色距离从近到远排序。</p>

      <h3 class="route text-h6">GET /color/search</h3>
      <p class="text-body-1">专用颜色搜索接口，返回按颜色距离排序的图片。</p>
      <h4 class="text-subtitle-1">Query 参数</h4>
      <v-list density="compact" variant="text">
        <v-list-item><code class="text-primary font-weight-bold">rgb</code>: 目标色，格式 <code class="text-primary font-weight-bold">r,g,b</code>；与 <code class="text-primary font-weight-bold">lab</code> 互斥</v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">lab</code>: 目标色，格式 <code class="text-primary font-weight-bold">l,a,b</code>；与 <code class="text-primary font-weight-bold">rgb</code> 互斥</v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">mode</code>: <code class="text-primary font-weight-bold">primary</code> / <code class="text-primary font-weight-bold">palette</code>，默认 <code class="text-primary font-weight-bold">primary</code></v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">max_dist</code>: 最大颜色距离；省略时不限制</v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">limit</code>: 返回数量，默认 <code class="text-primary font-weight-bold">20</code>，最大 <code class="text-primary font-weight-bold">100</code></v-list-item>
      </v-list>

      <h3 class="route text-h6">GET /statistic</h3>
      <p class="text-body-1">获取图库统计信息。</p>
      <JsonCodeBlock :code="statisticJson" />

      <h3 class="route text-h6">GET /tags</h3>
      <p class="text-body-1">分页获取标签列表。</p>
      <v-list density="compact" variant="text">
        <v-list-item><code class="text-primary font-weight-bold">limit</code>: 每页数量，默认 <code class="text-primary font-weight-bold">30</code>，最大 <code class="text-primary font-weight-bold">300</code></v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">offset</code>: 起始偏移，默认 <code class="text-primary font-weight-bold">0</code></v-list-item>
      </v-list>
      <JsonCodeBlock :code="tagsJson" />

      <h3 class="route text-h6">GET /authors</h3>
      <p class="text-body-1">分页获取作者列表。</p>
      <v-list density="compact" variant="text">
        <v-list-item><code class="text-primary font-weight-bold">limit</code>: 每页数量，默认 <code class="text-primary font-weight-bold">30</code>，最大 <code class="text-primary font-weight-bold">300</code></v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">offset</code>: 起始偏移，默认 <code class="text-primary font-weight-bold">0</code></v-list-item>
      </v-list>

      <h3 class="route text-h6">GET /authors/{id}</h3>
      <p class="text-body-1">按 ID 获取单个作者及其关联图片。</p>
      <JsonCodeBlock :code="authorJson" />
    </div>

    <h2 class="text-h5">4. 常见状态码</h2>
    <v-list density="compact" variant="text">
      <v-list-item><code class="text-primary font-weight-bold">200</code>：请求成功</v-list-item>
      <v-list-item><code class="text-primary font-weight-bold">302</code>：图片重定向</v-list-item>
      <v-list-item><code class="text-primary font-weight-bold">400</code>：参数错误</v-list-item>
      <v-list-item><code class="text-primary font-weight-bold">404</code>：资源不存在</v-list-item>
      <v-list-item><code class="text-primary font-weight-bold">500</code>：服务内部错误</v-list-item>
    </v-list>
    <JsonCodeBlock :code="errorJson" />
  </v-container>
</template>
<script setup lang="ts">
import JsonCodeBlock from "../components/JsonCodeBlock.vue";

const imageObjectJson = `{
  "id": 123,
  "title": "string",
  "src": "https://...",
  "source_id": 999,
  "width": 1200,
  "height": 900,
  "aspect_ratio": 1.333,
  "primary_color": {
    "rgb": [123, 100, 233],
    "lab": [52.4, 41.2, -58.1]
  },
  "author": {
    "id": 1,
    "name": "string",
    "platform": "pixiv",
    "platform_id": 123456
  }
}`;

const imageDetailJson = `{
  "id": 123,
  "title": "string",
  "src": "https://...",
  "width": 1200,
  "height": 900,
  "aspect_ratio": 1.333,
  "source_id": 999,
  "source_url": "https://...",
  "author": {
    "id": 1,
    "name": "string",
    "platform": "pixiv",
    "platform_id": 123456
  },
  "tags": [
    { "id": 1, "name": "landscape", "translated_name": "风景" }
  ],
  "colors": {
    "colors": [
      { "rgb": [24, 20, 34], "lab": [8.8, 5.3, -9.4] },
      { "rgb": [123, 100, 233], "lab": [52.4, 41.2, -58.1] }
    ]
  },
  "primary_color": {
    "rgb": [123, 100, 233],
    "lab": [52.4, 41.2, -58.1]
  }
}`;

const colorsJson = `{
  "primary_color": {
    "rgb": [123, 100, 233],
    "lab": [52.4, 41.2, -58.1]
  },
  "colors": {
    "colors": [
      { "rgb": [24, 20, 34], "lab": [8.8, 5.3, -9.4] },
      { "rgb": [41, 35, 56], "lab": [16.1, 8.2, -13.4] },
      { "rgb": [63, 54, 89], "lab": [25.4, 13.8, -22.6] }
    ]
  }
}`;

const healthJson = `{ "status": "ok" }`;

const statisticJson = `{ "illust_count": 12345, "tag_count": 678, "author_count": 234 }`;

const tagsJson = `[
  {
    "id": 1,
    "name": "landscape",
    "translated_name": "风景",
    "search_string": "landscape|风景"
  }
]`;

const authorJson = `{
  "id": 1,
  "name": "string",
  "platform": "pixiv",
  "platform_id": 123456,
  "images": []
}`;

const errorJson = `{ "error": "Human-readable error message" }`;
</script>
<style lang="scss" scoped>
.route {
  border-bottom: 0.125rem solid rgb(var(--v-theme-primary));
  width: fit-content;
}

.doc-root {
  width: min(100%, 960px);
  padding: clamp(2rem, 5vw, 4rem) clamp(1.25rem, 4vw, 3rem) 4.5rem;
  color: rgb(var(--v-theme-on-surface));
  font-size: 1rem;
  line-height: 1.75;
}

.doc-title {
  margin: 0 0 2rem;
  font-size: clamp(2rem, 5vw, 2.75rem);
  font-weight: 500;
  line-height: 1.2;
}

h2 {
  margin: 3rem 0 1rem;
  font-size: clamp(1.375rem, 3vw, 1.625rem);
  font-weight: 500;
  line-height: 1.35;
}

h2::before {
  content: "#";
  margin-right: 0.625rem;
  color: rgb(var(--v-theme-primary));
}

h3 {
  margin: 2rem 0 0.75rem;
  font-size: clamp(1.125rem, 2.4vw, 1.25rem);
  font-weight: 500;
  line-height: 1.4;
}

h3::before {
  content: "#";
  margin-right: 0.5rem;
  color: rgb(var(--v-theme-primary));
}

h4 {
  margin: 1.25rem 0 0.5rem;
  font-weight: 500;
  line-height: 1.45;
}

p {
  max-width: 70ch;
  margin: 0.75rem 0 1rem;
  line-height: 1.75;
}

code {
  display: inline-block;
  padding: 0.0625rem 0.375rem;
  border: 1px solid rgba(var(--v-theme-primary), 0.18);
  border-radius: 4px;
  background: rgba(var(--v-theme-primary), 0.06);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.88em;
  line-height: 1.45;
  word-break: break-word;
  vertical-align: baseline;
}

:global(.v-theme--dark) code {
  border-color: rgba(var(--v-theme-primary), 0.28);
  background: rgba(var(--v-theme-primary), 0.12);
}

:deep(.v-list) {
  max-width: 76ch;
  padding: 0.25rem 0 0.75rem;
  background: transparent;
}

:deep(.v-list-item) {
  min-height: auto;
  padding: 0.375rem 0;
}

:deep(.v-list-item__content) {
  line-height: 1.75;
}

.pl-4 {
  padding-left: clamp(0.75rem, 2vw, 1.5rem) !important;
  border-left: 1px solid rgb(var(--v-theme-outline-variant));
}

@media (max-width: 600px) {
  .doc-root {
    padding: 1.75rem 1rem 3rem;
    line-height: 1.7;
  }

  .doc-title {
    margin-bottom: 1.5rem;
  }

  h2 {
    margin-top: 2.5rem;
  }

  h3 {
    margin-top: 1.75rem;
  }
}
</style>
