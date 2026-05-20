<template>
  <div class="doc-root">
    <h1>随机图片 API 文档</h1>

    <h2>0. 基本信息</h2>
    <ul>
      <li>前端生产环境 Base URL：<code>https://imgapi.modenc.top</code></li>
      <li>前端开发环境 Base URL：<code>http://127.0.0.1:8001</code></li>
      <li>后端文档默认本地地址：<code>http://127.0.0.1:8000</code></li>
      <li>鉴权方式：<code>Authorization: Bearer &lt;token&gt;</code></li>
      <li>登录接口：<code>POST /token</code>（<code>application/x-www-form-urlencoded</code>）</li>
    </ul>

    <h2>1. 数据结构</h2>
    <h3 class="route">ImageObject</h3>
    <pre>{
  "id": 123,
  "title": "string",
  "src": "https://...",
  "source_id": 999,
  "aspect_ratio": 1.33,
  "primary_color": [12, 23, 34],
  "accessable": true,
  "author": {
    "id": 1,
    "name": "string",
    "platform": "pixiv",
    "platform_id": 123456
  }
}</pre>

    <h3 class="route">RandomImageResponse / ImageDetail</h3>
    <pre>{
  "id": 123,
  "title": "string",
  "src": "https://...",
  "width": 1200,
  "height": 900,
  "aspect_ratio": 1.333,
  "source_id": 999,
  "source_url": "https://...",
  "author": [
    {
      "id": 1,
      "name": "string",
      "homepage": "https://...",
      "platform": "pixiv"
    }
  ],
  "tags": [
    { "id": 1, "name": "猫耳", "num": 888 }
  ],
  "colors": {
    "color_primary": [123, 100, 233],
    "color_series": [[123, 100, 233], [20, 20, 20]]
  },
  "accessable": true,
  "uploaded": true,
  "processed": true,
  "processing": false
}</pre>


    <h2>2. 颜色功能亮点（Color Feature）</h2>
    <p>
      每张图片都带有颜色分析结果，可直接用于主题适配、按钮取色、背景渐变、推荐色卡等场景。
    </p>
    <ul>
      <li><code>colors.color_primary</code>：主色（Primary Color），默认代表该图最具视觉代表性的颜色。</li>
      <li><code>colors.color_series</code>：调色盘数组，固定包含 10 组 RGB 颜色。</li>
      <li><code>color_series</code> 的 10 个颜色按灰度（明度）排序，通常可理解为从更暗到更亮的渐进序列。</li>
      <li>前端可以直接按序渲染色条，或将第 1~3 个暗色用于文字背景、第 8~10 个亮色用于高亮元素。</li>
    </ul>
    <pre>{
  "colors": {
    "color_primary": [123, 100, 233],
    "color_series": [
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
}</pre>
    <p>说明：<code>primary</code> 是“主色语义”，<code>series</code> 是“可直接使用的 10 级调色盘语义”。</p>

    <h2>3. 接口说明</h2>

    <div style="padding: 0 1rem">
      <h3 class="route">GET /</h3>
      <p>随机返回一张图片；支持返回 JSON 或图片重定向（307）。</p>
      <h4>Query 参数</h4>
      <ul>
        <li><code>format</code>: <code>json</code> / <code>image</code>（默认 <code>json</code>）</li>
        <li><code>local</code>: <code>true/false</code>（默认 <code>false</code>）</li>
        <li><code>ratio_floor</code>, <code>ratio_ceil</code>: 宽高比范围</li>
        <li><code>tags</code>: 逗号分隔标签</li>
      </ul>

      <h3 class="route">GET /list</h3>
      <p>分页查询图片列表。</p>
      <h4>Query 参数</h4>
      <ul>
        <li><code>offset</code>: 起始偏移（默认 0）</li>
        <li><code>limit</code>: 每次请求条数（后端默认 30，前端当前请求 40）</li>
        <li><code>desc</code>: 是否降序（默认 true）</li>
        <li><code>ratio_floor</code>, <code>ratio_ceil</code>: 宽高比筛选（默认 0~10）</li>
        <li><code>author</code>: 作者 ID 或名字</li>
        <li><code>accessable</code>: <code>true</code>/<code>false</code>/<code>all</code></li>
        <li><code>tags</code>: 标签名，多个以逗号拼接</li>
      </ul>
      <p>未携带有效 token 时，仅返回 <code>accessable=true</code> 的图片。</p>

      <h3 class="route">GET /image/{image_id}</h3>
      <p>按 ID 获取图片；支持 JSON 或图片重定向（307）。</p>

      <h3 class="route">PATCH /image/{image_id}</h3>
      <p>更新图片信息（需鉴权）。前端当前主要用于更新 <code>accessable</code>。</p>

      <h3 class="route">POST /token</h3>
      <p>管理员登录接口，提交 <code>username</code>、<code>password</code>。</p>
      <pre>{ "access_token": "...", "token_type": "bearer" }</pre>

      <h3 class="route">GET /tags</h3>
      <p>获取标签列表，包含 <code>id</code>、<code>name</code>、<code>translated_name</code>、<code>search_string</code>。</p>

      <h3 class="route">GET /statistic</h3>
      <p>获取统计信息；前端使用 <code>illust_count</code> 作为筛选偏移上限。</p>
      <pre>{ "illust_count": 123, "tag_count": 456, "author_count": 78 }</pre>
    </div>

    <h2>4. 常见状态码</h2>
    <ul>
      <li><code>200</code>：请求成功</li>
      <li><code>400</code>：参数错误</li>
      <li><code>401</code>：未授权 / token 无效</li>
      <li><code>404</code>：资源不存在</li>
      <li><code>500</code>：服务内部错误</li>
    </ul>
  </div>
</template>
<script lang="ts"></script>
<style lang="scss" scoped>
.route {
  border-bottom: 0.2rem solid rgb(var(--v-theme-primary));
  width: fit-content;
}

.doc-root {
  display: flex;
  justify-content: left;
  flex-direction: column;
  width: 80%;
  padding: 4rem 0;
  gap: 1rem;
}

pre {
  overflow-x: auto;
  background: rgba(var(--v-theme-on-surface), 0.06);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
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

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
</style>
