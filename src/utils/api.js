import { API_DOMAIN } from '../constants';

// ── Global unauthorized handler (set once by the dashboard) ───────────────────
let _unauthorizedHandler = null;

/**
 * Register a global callback that fires when a token refresh fails.
 * Call this once from the Dashboard on mount so all pages auto-logout on 401.
 */
export function setUnauthorizedHandler(handler) {
    _unauthorizedHandler = handler;
}

// ── Token storage keys ────────────────────────────────────────────────────────
const KEY_ACCESS  = 'access_token';
const KEY_REFRESH = 'refresh_token';
const KEY_AUTH    = 'roa_auth';
const KEY_ROLE    = 'user_role';
const KEY_EMAIL   = 'user_email';

// ── Token helpers ──────────────────────────────────────────────────────────────
export function getAccessToken() {
    return localStorage.getItem(KEY_ACCESS);
}

export function getRefreshToken() {
    return localStorage.getItem(KEY_REFRESH);
}

/**
 * Stores access_token and refresh_token from the API response.
 * Supports both flat  { access_token, refresh_token }
 * and nested          { token: { access_token, refresh_token } } formats.
 */
export function storeTokens(data) {
    if (!data) return;
    const accessToken  = data.token?.access_token  || data.access_token;
    const refreshToken = data.token?.refresh_token || data.refresh_token;
    if (accessToken)  localStorage.setItem(KEY_ACCESS,  accessToken);
    if (refreshToken) localStorage.setItem(KEY_REFRESH, refreshToken);
}

export function clearSession() {
    localStorage.removeItem(KEY_AUTH);
    localStorage.removeItem(KEY_ACCESS);
    localStorage.removeItem(KEY_REFRESH);
    localStorage.removeItem(KEY_ROLE);
    localStorage.removeItem(KEY_EMAIL);
}

export function getUserRole() {
    try {
        const raw = localStorage.getItem(KEY_ROLE);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function getUserEmail() {
    return localStorage.getItem(KEY_EMAIL);
}

export function isAdminUser() {
    try {
        const role = getUserRole();
        if (!role) return false;
        if (typeof role === 'string') return role.toLowerCase() === 'admin';
        return role?.name?.toLowerCase() === 'admin';
    } catch {
        return false;
    }
}

// ── JWT expiry helper ─────────────────────────────────────────────────────────
/**
 * Decodes a JWT payload and returns true if it has expired (or is within
 * `bufferSeconds` of expiring). Returns false if the token is invalid/missing.
 */
function isTokenExpired(token, bufferSeconds = 30) {
    if (!token) return true;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (!payload.exp) return false; // no expiry claim → treat as valid
        return Date.now() / 1000 >= payload.exp - bufferSeconds;
    } catch {
        return true; // malformed token → treat as expired
    }
}

// ── Refresh access token (deduplicated) ───────────────────────────────────────
let _refreshPromise = null;

export async function refreshAccessToken() {
    // Deduplicate: if a refresh is already in flight, wait for it
    if (_refreshPromise) return _refreshPromise;

    _refreshPromise = (async () => {
        const refreshToken = getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token available');

        const res = await fetch(`${API_DOMAIN}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.detail || `Token refresh failed (${res.status})`);
        }

        const data = await res.json();
        storeTokens(data);
        console.log('[Auth] Token refreshed successfully');
        return data.token?.access_token || data.access_token;
    })();

    try {
        return await _refreshPromise;
    } finally {
        _refreshPromise = null;
    }
}

// ── Authenticated fetch with proactive expiry check + 401 retry ───────────────
/**
 * Drop-in replacement for `fetch()` that:
 *  1. Checks if the access token is expired/near-expiry BEFORE the request
 *     and proactively refreshes it to avoid unnecessary 401s.
 *  2. Attaches the Bearer access token to every request.
 *  3. On a 401 response, attempts one silent token refresh and retries.
 *  4. If the refresh also fails, clears the session and triggers logout.
 *
 * NOTE: Does NOT override Content-Type if the caller already set it,
 *       and never sets Content-Type on FormData bodies.
 *
 * @param {string}      url
 * @param {RequestInit} options
 * @param {() => void}  [onUnauthorized]
 */
export async function authFetch(url, options = {}, onUnauthorized = null) {
    // Build request headers without clobbering caller-supplied Content-Type
    const buildHeaders = (token) => {
        const callerHeaders = options.headers || {};
        // If the body is FormData, let the browser set the Content-Type automatically
        const isFormData = options.body instanceof FormData;
        return {
            ...callerHeaders,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            // Only inject application/json if caller didn't specify and body is not FormData
            ...(!callerHeaders['Content-Type'] && !callerHeaders['content-type'] && !isFormData
                ? { 'Content-Type': 'application/json' }
                : {}),
        };
    };

    const makeRequest = (token) =>
        fetch(url, { ...options, headers: buildHeaders(token) });

    // ── 1. Proactively refresh if access token is expired/near-expiry ─────────
    let accessToken = getAccessToken();
    if (isTokenExpired(accessToken)) {
        try {
            accessToken = await refreshAccessToken();
        } catch (err) {
            // Refresh failed even before making the request → log out
            clearSession();
            const handler = onUnauthorized || _unauthorizedHandler;
            if (handler) handler();
            throw new Error('Session expired. Please log in again.');
        }
    }

    // ── 2. Make the actual request ────────────────────────────────────────────
    let res = await makeRequest(accessToken);

    // ── 3. On 401, attempt one refresh-and-retry ──────────────────────────────
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

// ── Session verification on page reload ───────────────────────────────────────
/**
 * Verifies the session on page load:
 * 1. If access token is still valid → confirm with /auth/me.
 * 2. If access token is expired but refresh token exists → refresh first, then /auth/me.
 * 3. If both fail or are missing → clear session and return false.
 */
export async function verifyAuthSession() {
    const accessToken  = getAccessToken();
    const refreshToken = getRefreshToken();

    if (!accessToken && !refreshToken) {
        clearSession();
        return false;
    }

    // Helper: validate session against /auth/me with a given token
    const checkMe = async (token) => {
        const meRes = await fetch(`${API_DOMAIN}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        if (!meRes.ok) return false;
        const meData = await meRes.json();
        if (meData?.is_active === false) return false;
        localStorage.setItem(KEY_AUTH, 'true');
        if (meData?.role)  localStorage.setItem(KEY_ROLE,  JSON.stringify(meData.role));
        if (meData?.email) localStorage.setItem(KEY_EMAIL, meData.email);
        return true;
    };

    // 1. If access token is still valid, verify with /auth/me directly
    if (!isTokenExpired(accessToken)) {
        try {
            if (await checkMe(accessToken)) return true;
        } catch (err) {
            console.warn('[Auth] /auth/me check failed:', err.message);
        }
    }

    // 2. Access token is expired or /auth/me failed → try refresh
    if (refreshToken) {
        try {
            const newAccessToken = await refreshAccessToken();
            if (await checkMe(newAccessToken)) return true;
        } catch (err) {
            console.warn('[Auth] Token refresh during session verify failed:', err.message);
        }
    }

    // 3. Everything failed → clear and return false
    clearSession();
    return false;
}

// ── Logout ─────────────────────────────────────────────────────────────────────
/**
 * Calls the logout API then clears the local session regardless of API success.
 */
export async function logoutUser() {
    const token = getAccessToken();
    try {
        await fetch(`${API_DOMAIN}/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        });
    } catch (err) {
        console.warn('[Auth] Logout API call failed (ignored):', err.message);
    } finally {
        clearSession();
    }
}
