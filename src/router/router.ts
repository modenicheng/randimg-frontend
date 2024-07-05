import { createWebHistory, createRouter } from "vue-router";
const routes = [
  {
    path: "/login",
    name: "login",
    component: () => import("../views/Login.vue"),
    meta: {
      title: "登录",
      keepAlive: true,
    },
  },
  {
    path: "/",
    name: "Home",
    component: () => import("../views/Home.vue"),
    children: [
      {
        path: "",
        name: "index",
        component: () => import("../views/Index.vue"),
        meta: {
          navigator: true,
          title: "主页",
        },
      },
      {
        path: "doc",
        name: "doc",
        component: () => import("../views/Document.vue"),
        meta: {
          navigator: true,
          title: "文档",
        },
      },
      {
        path: "random-image",
        name: "random-image",
        component: () => import("../views/RandomImage.vue"),
        meta: {
          navigator: true,
          title: "随机图片",
        },
      },
      {
        path: "image/:id",
        component: () => import("../views/Image.vue"),
        meta: {
          navigator: false,
        },
      },
      {
        path: "image-list",
        name: "image-list",
        component: () => import("../views/ImageList.vue"),
        meta: {
          navigator: true,
          title: "图片列表",
        },
      },
      {
        path: "/:pathMatch(.*)*",
        name: "NotFound",
        component: () => import("../views/404.vue"),
        meta: {
            navigator: false,
            title: "404",
          },
      },
    ],
  },
];
const router = createRouter({
  history: createWebHistory(),
  routes,
});
export default router;
export { routes };
