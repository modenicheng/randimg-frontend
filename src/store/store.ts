import { defineStore } from 'pinia'

const useUserStore = defineStore('user', {
    state: () => {
        return {
            user: {
                username: null,
                token: null
            }
        }
    },
    persist: true,
})

export { useUserStore }