import axios from 'axios'
import { useUserStore } from '../store/store'

const baseURL = import.meta.env.DEV
  ? '/api/v2'
  : 'https://imgapi.modenc.top/api/v2'

const Axios = axios.create({
    baseURL: baseURL,
    timeout: 10000,
})
Axios.interceptors.request.use(
    config => {
        const store = useUserStore()
        if (store.user.token) {
            config.headers.Authorization = `Bearer ${store.user.token}`
        }
        return config
    },
    error => {
        return Promise.reject(error);
    }
);
Axios.interceptors.response.use(
    response => {
        return response
    },
    error => {
        return Promise.reject(error)
    }
)
export default Axios