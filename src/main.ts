import { createApp } from 'vue'
import App from './App.vue'

import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { VDateInput } from 'vuetify/labs/VDateInput'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

import router from './router/router'

import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

const app = createApp(App)
const vuetify = createVuetify({
    components: { ...components, VDateInput },
    directives,
    icons: {
        defaultSet: 'mdi',
        aliases: { ...aliases },
        sets: {
            mdi,
        },
    }
})

app.use(vuetify)
    .use(pinia)
    .use(router)
    .mount('#app')
