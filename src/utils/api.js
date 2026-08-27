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

// ── Token helpers ──────────────────────────────────────────────────────────────
export function getAccessToken() {
    return localStorage.getItem('access_token');
}

export function getRefreshToken() {
    return localStorage.getItem('refresh_token');
}

export function storeTokens(data) {
    if (!data) return;
    const accessToken = data.token?.access_token || data.access_token;
    const refreshToken = data.token?.refresh_token || data.refresh_token;

    if (accessToken) {
        localStorage.setItem('access_token', accessToken);
    }
    if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken);
    }
}

export function clearSession() {
    localStorage.removeItem('roa_auth');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_email');
}

export function getUserRole() {
    try {
        const raw = localStorage.getItem('user_role');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function getUserEmail() {
    return localStorage.getItem('user_email');
}

/**
 * Verifies session on page reload:
 * 1. Hits /auth/me using current access token.
 * 2. If /auth/me fails or returns 401, attempts /auth/refresh using refresh token.
 * 3. Stores new access & refresh tokens on success.
 * 4. If refresh also fails or no refresh token is present, clears session.
 */
export async function verifyAuthSession() {
    const accessToken = getAccessToken();
    const refreshToken = getRefreshToken();

    if (!accessToken && !refreshToken) {
        clearSession();
        return false;
    }

    // 1. Try /auth/me if access token exists
    if (accessToken) {
        try {
            const meRes = await fetch(`${API_DOMAIN}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            if (meRes.ok) {
                const meData = await meRes.json();
                if (meData?.is_active === false) {
                    clearSession();
                    return false;
                }
                localStorage.setItem('roa_auth', 'true');
                if (meData?.role) {
                    localStorage.setItem('user_role', JSON.stringify(meData.role));
                }
                if (meData?.email) {
                    localStorage.setItem('user_email', meData.email);
                }
                return true;
            }
        } catch (err) {
            console.warn('[Auth] /auth/me check failed:', err.message);
        }
    }

    // 2. If /auth/me failed or access token was missing, try /auth/refresh
    if (refreshToken) {
        try {
            const refreshRes = await fetch(`${API_DOMAIN}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken }),
            });

            if (refreshRes.ok) {
                const data = await refreshRes.json();
                storeTokens(data);

                // Fetch latest user info with the refreshed access token
                const newAccessToken = getAccessToken();
                if (newAccessToken) {
                    try {
                        const newMeRes = await fetch(`${API_DOMAIN}/auth/me`, {
                            headers: {
                                'Authorization': `Bearer ${newAccessToken}`,
                                'Content-Type': 'application/json',
                            },
                        });
                        if (newMeRes.ok) {
                            const newMeData = await newMeRes.json();
                            if (newMeData?.is_active === false) {
                                clearSession();
                                return false;
                            }
                            if (newMeData?.role) localStorage.setItem('user_role', JSON.stringify(newMeData.role));
                            if (newMeData?.email) localStorage.setItem('user_email', newMeData.email);
                        }
                    } catch {
                        // ignore secondary me fetch error on refresh
                    }
                }

                localStorage.setItem('roa_auth', 'true');
                return true;
            }
        } catch (err) {
            console.warn('[Auth] /auth/refresh check failed:', err.message);
        }
    }

    // 3. Both failed or tokens missing – clear session and return false
    clearSession();
    return false;
}

// ── Refresh access token ───────────────────────────────────────────────────────
let _refreshPromise = null; // deduplicate concurrent refresh calls

export async function refreshAccessToken() {
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
            throw new Error(data.detail || 'Token refresh failed');
        }

        const data = await res.json();
        storeTokens(data);
        return data.token?.access_token || data.access_token;
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
        await fetch(`${API_DOMAIN}/auth/logout`, {
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
