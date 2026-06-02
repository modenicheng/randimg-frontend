import { defineStore } from 'pinia'

interface UserState {
    username: string | null
    token: string | null
    theme: 'light' | 'dark'
}

const useUserStore = defineStore('user', {
    state: (): { user: UserState } => ({
        user: {
            username: null,
            token: null,
            theme: 'light',
        }
    }),
    actions: {
        setTheme (theme: 'light' | 'dark') {
            this.user.theme = theme
        }
    },
    persist: true,
})

export { useUserStore }