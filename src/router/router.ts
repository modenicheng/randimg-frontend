import { createWebHistory, createRouter } from "vue-router"
const routes = [
    {
        path: '/login',
        name: 'login',
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
                path: 'image/:id',
                name: 'image',
                component: () => import("../views/Image.vue"),
                meta: {
                    navigator: false
                }
            },
            {
                path: 'image-list',
                name: 'image-list',
                component: () => import('../views/ImageList.vue'),
                meta: {
                    navigator: true,
                    title: '图片列表'
                }
            }
        ]
    },
    { path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('../components/HelloWorld.vue') },

]
const router = createRouter({
    history: createWebHistory(),
    routes,
})
export default router
export { routes }