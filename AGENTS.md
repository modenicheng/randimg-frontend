# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

- `yarn dev` — Start dev server (Vite, proxies `/api/v2` → `http://127.0.0.1:8000`)
- `yarn build` — Type-check with `vue-tsc -b` then build with Vite
- `yarn preview` — Preview the production build locally

Package manager: **yarn**

## Architecture

This is a **Vue 3 + TypeScript + Vite** single-page application frontend for a random image API service (`randimg`). The UI is in Chinese.

### Tech Stack

- **UI Framework**: Vuetify 3 (Material Design) with `@mdi/js` SVG icons (not the font icon set)
- **State Management**: Pinia with `pinia-plugin-persistedstate` for localStorage persistence
- **Routing**: Vue Router 4 with HTML5 history mode
- **HTTP Client**: Axios with a shared instance in `src/axios/axios.ts`
- **TypeScript**: Strict mode with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`

### Layout Structure

`App.vue` is a bare `<router-view>`. `Home.vue` is the real shell — it renders a Vuetify app bar + navigation drawer + `<router-view>`. All authenticated/main pages are children of the `Home` route. The `/login` route sits outside this layout.

Navigation items are dynamically built from the route definitions: routes with `meta.navigator: true` appear in the sidebar. Routes with `meta.requireAuth: true` only show when a token exists in the user store.

### Key Modules

- **`src/axios/axios.ts`** — Configured Axios instance. Base URL switches between `/api/v2` (dev, proxied by Vite) and `https://imgapi.modenc.top/api/v2` (production). Attaches `Bearer` token from the Pinia user store to every request.
- **`src/store/store.ts`** — Single `useUserStore` Pinia store holding `username`, `token`, and `theme`. Persisted to localStorage.
- **`src/router/router.ts`** — Exports both the router instance and the raw `routes` array (used by `Home.vue` to build the nav list).

### Task Status Semantics (TaskManager)

The backend uses string status values that don't map 1:1 to their display labels:

| API Status | Display Label | Color | Meaning |
|---|---|---|---|
| `pending` | 待处理 | blue | Waiting to be picked up |
| `running` | 运行中 | orange | Currently executing |
| `completed` | 已完成 | green | Finished successfully |
| `failed` | 重试中 | orange | Transient failure, will be retried up to `maxAttempts` |
| `killed` | 失败 | red | Retries exhausted or manually cancelled — final state |
| `partial_success` | 部分成功 | amber | Some subtasks succeeded, some failed |

Key: `failed` is **not** final — it means the task failed but has remaining retry attempts. `killed` is the true terminal failure state.

### Component Conventions

- Views go in `src/views/`, shared components in `src/components/`
- SFCs use `<script setup lang="ts">` style
- Theme (light/dark) is toggled via Vuetify's `useTheme()` and persisted in the user store

### `accessible` Field (ImageList)

`accessible` is a **database-level boolean** on the `image` table. It controls **non-admin user visibility** — when `false`, non-admin users cannot see the image. **Admin users (authenticated) always see all images by default.** The `accessible` query param on `GET /list` only accepts `"true"` / `"false"` (not `"all"`). When omitted, no filter is applied (admin sees everything). See `randimg-backend-rs/docs/api.md` for full details.
