const API_BASE = 'https://roa-data-backend.vercel.app';

// ── Global unauthorized handler (set once by the dashboard) ───────────────────
let _unauthorizedHandler = null;

/**
 * Register a global callback that fires when a token refresh fails.
 * Call this once from the Dashboard on mount so all pages auto-logout on 401.
 */
export function setUnauthorizedHandler(handler) {
    _unauthorizedHandler = handler;
}

// ── Token helpers ──────────────────────────────────────────────────────────────
export function getAccessToken() {
    return sessionStorage.getItem('access_token');
}

export function getRefreshToken() {
    return sessionStorage.getItem('refresh_token');
}

function storeTokens({ access_token, refresh_token }) {
    sessionStorage.setItem('access_token', access_token);
    if (refresh_token) {
        sessionStorage.setItem('refresh_token', refresh_token);
    }
}

function clearSession() {
    sessionStorage.removeItem('roa_auth');
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
}

// ── Refresh access token ───────────────────────────────────────────────────────
let _refreshPromise = null; // deduplicate concurrent refresh calls

export async function refreshAccessToken() {
    if (_refreshPromise) return _refreshPromise;

    _refreshPromise = (async () => {
        const refreshToken = getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token available');

        const res = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.detail || 'Token refresh failed');
        }

        const data = await res.json();
        storeTokens(data);
        return data.access_token;
    })();

    try {
        return await _refreshPromise;
    } finally {
        _refreshPromise = null;
    }
}

// ── Authenticated fetch with automatic 401 retry ───────────────────────────────
/**
 * Drop-in replacement for `fetch()` that:
 *  1. Attaches the Bearer access token to every request.
 *  2. On a 401, attempts one silent token refresh and retries the request.
 *  3. If the refresh also fails, clears the session and triggers the onUnauthorized callback.
 *
 * @param {string} url
 * @param {RequestInit} options
 * @param {() => void} [onUnauthorized] – called when session is expired beyond recovery
 */
export async function authFetch(url, options = {}, onUnauthorized = null) {
    const makeRequest = (token) =>
        fetch(url, {
            ...options,
            headers: {
                ...(options.headers || {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                'Content-Type': options.headers?.['Content-Type'] || 'application/json',
            },
        });

    let res = await makeRequest(getAccessToken());

    if (res.status === 401) {
        try {
            const newToken = await refreshAccessToken();
            res = await makeRequest(newToken);
        } catch {
            clearSession();
            const handler = onUnauthorized || _unauthorizedHandler;
            if (handler) handler();
            throw new Error('Session expired. Please log in again.');
        }
    }

    return res;
}

// ── Logout ─────────────────────────────────────────────────────────────────────
/**
 * Calls the logout API with the current access token, then clears the session.
 * If the API call fails, we still clear the local session to avoid a stuck state.
 */
export async function logoutUser() {
    const token = getAccessToken();
    try {
        await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        });
    } catch (err) {
        // Silently ignore network errors – we still clear the local session below
        console.warn('[Auth] Logout API call failed:', err.message);
    } finally {
        clearSession();
    }
}
