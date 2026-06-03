<template>
  <v-container class="doc-root">
    <h1 class="doc-title">随机图片 API 文档</h1>

    <h2 class="text-h5">0. 基本信息</h2>
    <v-list density="compact" variant="text">
      <v-list-item>前端生产环境 Base URL：<code class="text-primary font-weight-bold">https://imgapi.modenc.top</code></v-list-item>
      <v-list-item>前端开发环境 Base URL：<code class="text-primary font-weight-bold">/api/v2</code>（Vite 代理）</v-list-item>
      <v-list-item>后端文档默认本地地址：<code class="text-primary font-weight-bold">http://127.0.0.1:8000</code></v-list-item>
      <v-list-item>鉴权方式：<code class="text-primary font-weight-bold">Authorization: Bearer &lt;token&gt;</code></v-list-item>
      <v-list-item>登录接口：<code class="text-primary font-weight-bold">POST /token</code>（<code class="text-primary font-weight-bold">application/json</code>）</v-list-item>
    </v-list>

    <h2 class="text-h5">1. 数据结构</h2>
    <h3 class="route text-h6">ImageObject（列表接口）</h3>
    <JsonCodeBlock :code="imageObjectJson" />

    <h3 class="route text-h6">RandomImageResponse / ImageDetail</h3>
    <JsonCodeBlock :code="imageDetailJson" />

    <h2 class="text-h5">2. 颜色功能亮点（Color Feature）</h2>
    <p class="text-body-1">
      每张图片都带有颜色分析结果，可直接用于主题适配、按钮取色、背景渐变、推荐色卡等场景。
    </p>
    <v-list density="compact" variant="text">
      <v-list-item><code class="text-primary font-weight-bold">colors.colors</code>：调色盘数组，固定包含 10 组 RGB 颜色，按灰度排序。</v-list-item>
      <v-list-item><code class="text-primary font-weight-bold">primary_color</code>：主色 RGB 数组 <code class="text-primary font-weight-bold">[r, g, b]</code>，用于背景色或主题色。</v-list-item>
    </v-list>
    <JsonCodeBlock :code="colorsJson" />
    <p class="text-body-1">说明：<code class="text-primary font-weight-bold">primary</code> 是"主色语义"，<code class="text-primary font-weight-bold">series</code> 是"可直接使用的 10 级调色盘语义"。</p>

    <h2 class="text-h5">3. 接口说明</h2>

    <div class="pl-4">
      <h3 class="route text-h6">GET /</h3>
      <p class="text-body-1">随机返回一张图片；支持返回 JSON 或图片重定向（307）。</p>
      <h4 class="text-subtitle-1">Query 参数</h4>
      <v-list density="compact" variant="text">
        <v-list-item><code class="text-primary font-weight-bold">format</code>: <code class="text-primary font-weight-bold">json</code> / <code class="text-primary font-weight-bold">image</code>（默认 <code class="text-primary font-weight-bold">json</code>）</v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">local</code>: <code class="text-primary font-weight-bold">true/false</code>（默认 <code class="text-primary font-weight-bold">false</code>）</v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">ratio_floor</code>, <code class="text-primary font-weight-bold">ratio_ceil</code>: 宽高比范围</v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">tags</code>: 逗号分隔标签</v-list-item>
      </v-list>

      <h3 class="route text-h6">GET /list</h3>
      <p class="text-body-1">分页查询图片列表。</p>
      <h4 class="text-subtitle-1">Query 参数</h4>
      <v-list density="compact" variant="text">
        <v-list-item><code class="text-primary font-weight-bold">offset</code>: 起始偏移（默认 0）</v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">limit</code>: 每次请求条数（后端默认 30，前端当前请求 40）</v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">desc</code>: 是否降序（默认 true）</v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">ratio_floor</code>, <code class="text-primary font-weight-bold">ratio_ceil</code>: 宽高比筛选（默认 0~10）</v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">author</code>: 作者 ID 或名字</v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">accessible</code>: <code class="text-primary font-weight-bold">true</code>/<code class="text-primary font-weight-bold">false</code></v-list-item>
        <v-list-item><code class="text-primary font-weight-bold">tags</code>: 标签名，多个以逗号拼接</v-list-item>
      </v-list>
      <p class="text-body-1">未携带有效 token 时，仅返回 <code class="text-primary font-weight-bold">accessible=true</code> 的图片。</p>

      <h3 class="route text-h6">GET /image/{image_id}</h3>
      <p class="text-body-1">按 ID 获取图片；支持 JSON 或图片重定向（307）。</p>

      <h3 class="route text-h6">PATCH /image/{image_id}</h3>
      <p class="text-body-1">更新图片信息（需鉴权）。前端当前主要用于更新 <code class="text-primary font-weight-bold">accessible</code>。</p>

      <h3 class="route text-h6">POST /token</h3>
      <p class="text-body-1">管理员登录接口，提交 JSON body <code class="text-primary font-weight-bold">{"username": "...", "password": "..."}</code>。</p>
      <JsonCodeBlock :code="tokenJson" />

      <h3 class="route text-h6">GET /tags</h3>
      <p class="text-body-1">获取标签列表，包含 <code class="text-primary font-weight-bold">id</code>、<code class="text-primary font-weight-bold">name</code>、<code class="text-primary font-weight-bold">translated_name</code>、<code class="text-primary font-weight-bold">search_string</code>。</p>

      <h3 class="route text-h6">GET /statistic</h3>
      <p class="text-body-1">获取统计信息；前端使用 <code class="text-primary font-weight-bold">illust_count</code> 作为筛选偏移上限。</p>
      <JsonCodeBlock :code="statisticJson" />
    </div>

    <h2 class="text-h5">4. 常见状态码</h2>
    <v-list density="compact" variant="text">
      <v-list-item><code class="text-primary font-weight-bold">200</code>：请求成功</v-list-item>
      <v-list-item><code class="text-primary font-weight-bold">400</code>：参数错误</v-list-item>
      <v-list-item><code class="text-primary font-weight-bold">401</code>：未授权 / token 无效</v-list-item>
      <v-list-item><code class="text-primary font-weight-bold">404</code>：资源不存在</v-list-item>
      <v-list-item><code class="text-primary font-weight-bold">500</code>：服务内部错误</v-list-item>
    </v-list>
  </v-container>
</template>
<script setup lang="ts">
import JsonCodeBlock from "../components/JsonCodeBlock.vue";

const imageObjectJson = `{
  "id": 123,
  "title": "string",
  "src": "https://...",
  "source_id": 999,
  "aspect_ratio": 1.33,
  "primary_color": [12, 23, 34],
  "accessible": true,
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
    { "id": 1, "name": "猫耳", "translated_name": "猫耳" }
  ],
  "colors": {
    "colors": [[24, 20, 34], [41, 35, 56], [63, 54, 89], [84, 71, 121],
               [103, 86, 148], [123, 100, 233], [149, 126, 238], [177, 157, 243],
               [205, 191, 247], [230, 221, 252]]
  },
  "primary_color": [123, 100, 233],
  "accessible": true
}`;

const colorsJson = `{
  "colors": {
    "colors": [
      [24, 20, 34],
      [41, 35, 56],
      [63, 54, 89],
      [84, 71, 121],
      [103, 86, 148],
      [123, 100, 233],
      [149, 126, 238],
      [177, 157, 243],
      [205, 191, 247],
      [230, 221, 252]
    ]
  }
}`;

const tokenJson = `{ "access_token": "...", "token_type": "bearer" }`;

const statisticJson = `{ "illust_count": 123, "tag_count": 456, "author_count": 78 }`;
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
