import { defineStore } from 'pinia'

const useUserStore = defineStore('user', {
    state: () => {
        return {
            user: {
                username: null,
                token: null,
                theme: 'light',
            }
        }
    },
    actions: {
        setTheme (theme: string) {
            this.user.theme = theme
        }
    },
    persist: true,
})

export { useUserStore }