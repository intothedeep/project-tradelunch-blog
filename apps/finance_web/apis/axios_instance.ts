import axios from 'axios';
import { API_BASE } from '@/env.schema';

// Env is loaded by Next.js automatically; API_BASE is validated in @/env.schema.
console.log('axios::API_BASE::', API_BASE);
export const axios_instance = axios.create({
    baseURL: API_BASE,
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// No global auth interceptor on purpose. This instance is isomorphic (imported
// by both Server Components and client hooks), so a global token-from-storage
// interceptor would read nothing on the server and silently send anonymous
// requests. Clerk tokens are attached explicitly per call instead: the caller
// obtains one via useAuth().getToken() (client) or auth().getToken() (server)
// and passes it as a `token` argument to the .api.ts function — see getMe.api.ts.

axios_instance.interceptors.response.use(
    (response) => response.data,
    (error) => {
        console.error('Axios Error:', error);
        return Promise.reject(error);
    }
);

export default axios_instance;
