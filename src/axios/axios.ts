import axios from 'axios'
import { useUserStore } from '../store/store'
const store = useUserStore()

let token = store.user.token

let baseURL = !import.meta.env.DEV || document.cookie.includes('PROD') ?  'https://img.modenc.top:8000' : 'http://127.0.0.1:8001'

const Axios = axios.create({
    baseURL: baseURL,
    timeout: 10000,
    headers: {
        Authorization: token ? `Bearer ${token}` : undefined
    }
})
Axios.interceptors.request.use(
    config => {
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
        return error.response
    }
)
export default Axios