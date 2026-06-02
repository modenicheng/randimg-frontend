<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import siLog from 'si-log'
import Axios from '../axios/axios';
import { useUserStore } from '../store/store';

const store = useUserStore()
const router = useRouter()
const l = siLog.create('Login.vue')

l.debug(router.currentRoute)
let isLoading = ref(false)
let data = ref({
    username: '',
    password: '',
})
const submit = () => {
    isLoading.value = true
    Axios.post('/token', {
        username: data.value.username,
        password: data.value.password,
    })
        .then(res => {
            l.debug(res)
            store.user.token = res.data.access_token
            store.user.username = data.value.username
            router.push('/')
            isLoading.value = false
        }).catch(
            err => {
                l.debug(err.response?.data ?? err.message)
                isLoading.value = false
                er.value = true
            }
        )
}
let valid = ref(false)
let rules = [
    (value: string) => {
        if (value) {
            return true
        }
        return 'This field is required 该字段必填'
    }
]
let er = ref(false)
</script>
<template>
    <div class="center">
        <v-card title="Login 登入" :loading="isLoading" class="login-card">
            <v-form v-model="valid" :disabled="isLoading">
                <v-col>
                    <v-text-field :rules="rules" v-model="data.username" label="Username" required></v-text-field>
                    <v-text-field type="password" :rules="rules" v-model="data.password" label="Password" @keyup.enter="submit()">
                        </v-text-field>
                    <v-btn @click="submit()" :disabled="isLoading || !valid" width="100%">SUBMIT</v-btn>
                    <v-alert variant="tonal" v-if="er" type="error" style="margin: 1rem 0 0" text="用户名或密码错误！">
                    </v-alert>
                </v-col>
            </v-form>
        </v-card>
    </div>
</template>
<style scoped>
.center {
    height: 100%;
    width: 100%;
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
}

.login-card {
    min-width: 300px;
    width: 30%;
    max-width: 600px;
}
</style>