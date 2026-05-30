import { fetch } from "@tauri-apps/plugin-http";
import retry from "fetch-retry";

const fetchWithRetry = retry(fetch, { retries: 3, retryDelay: 1000 });

export class SessionManager {

    async request(input: RequestInfo | URL, init?: RequestInit) {
        return fetchWithRetry(input, init);
    }
}