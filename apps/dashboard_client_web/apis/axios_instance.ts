import axios from 'axios';
import { API_BASE } from '@/env.schema';

// Env is loaded by Next.js automatically; API_BASE is validated in @/env.schema.
export const axios_instance = axios.create({
    baseURL: API_BASE,
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json',
    },
});

axios_instance.interceptors.request.use(
    (config) => {
        // console.log(config)
        // e.g. Add token
        // const token = localStorage.getItem("token");
        // if (token) config.headers.Authorization = `Bearer ${token}`;
        // console.log('Starting Request', config);
        return config;
    },
    (error) => Promise.reject(error)
);

axios_instance.interceptors.response.use(
    (response) => response.data,
    (error) => {
        console.error('Axios Error:', error);
        return Promise.reject(error);
    }
);

export default axios_instance;
