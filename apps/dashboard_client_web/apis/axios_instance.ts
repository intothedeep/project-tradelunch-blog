import axios from 'axios';
import path from 'path';
import dotenv from 'dotenv';
import { API_BASE } from '@/env.schema';

dotenv.config();
console.log('>>', `axios env: ${process.env.NODE_ENV}`);

if (process.env.NODE_ENV == 'production') {
    // Load .env.production to override any variables from .env
    dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
    // console.log('>> ', `axios instance: loaded .env.production`);
}

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
