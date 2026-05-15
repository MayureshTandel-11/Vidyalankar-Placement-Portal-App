import axios from "axios";
import { authDebug } from "./authDebug";

/**
 * Frontend API Client with Security Features:
 * - Access token stored in memory (React state/context), never in localStorage/sessionStorage
 * - Refresh token in httpOnly cookie (set by server)
 * - Automatic token refresh on 401 errors
 * - Retry failed requests after refresh
 * - VITE_API_URL validation at build time
 */

// Validate VITE_API_URL at build time
if (!import.meta.env.VITE_API_URL) {
  throw new Error(
    "VITE_API_URL environment variable is not defined. " +
    "Add VITE_API_URL to your .env file (e.g., VITE_API_URL=http://localhost:5001/api)"
  );
}

const API_URL = import.meta.env.VITE_API_URL;
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5001";

// Store for current access token (in memory only)
let accessToken = null;
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  isRefreshing = false;
  failedQueue = [];
};

/**
 * Create axios instance with secure configuration
 */
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Include refresh token cookie in requests
  timeout: 10000,
});

/**
 * Request interceptor: Add access token to Authorization header
 * EXCEPT for login/register routes (public endpoints)
 * Deduplication is handled at the React component level using RequestDeduplicator
 */
api.interceptors.request.use(
  (config) => {
    // Public auth routes - do NOT add authorization header
    const publicRoutes = ["/auth/login", "/auth/register", "/auth/verify-otp", "/auth/forgot-password"];
    const isPublicRoute = publicRoutes.some(route => config.url?.includes(route));

    if (isPublicRoute) {
      // Remove any existing Authorization header for public routes
      delete config.headers.Authorization;
      if (process.env.NODE_ENV === "development") {
        console.log(`[API] ${config.method?.toUpperCase()} ${config.url} [PUBLIC]`);
      }
      return config;
    }

    // Protected routes - add authorization header if token exists
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
      if (process.env.NODE_ENV === "development") {
        console.log(`[API] ${config.method?.toUpperCase()} ${config.url} [AUTH]`);
      }
    } else {
      if (process.env.NODE_ENV === "development") {
        console.log(`[API] ${config.method?.toUpperCase()} ${config.url} [NO_TOKEN]`);
      }
    }
    return config;
  },
  (error) => {
    console.error("[API REQUEST ERROR]", error.message);
    return Promise.reject(error);
  }
);

/**
 * Response interceptor: Handle 401 errors with token refresh
 * On 401, attempt to refresh token and retry original request once
 * Cleans up deduplication map after request completes
 */
api.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[API ✓] ${response.status} ${response.config.url}`);
    }
    return response;
  },
  (error) => {
    const { config, response } = error;
    const status = response?.status;
    const url = config?.url;
    const method = config?.method?.toUpperCase();
    const data = response?.data;

    // Handle 401 Unauthorized - attempt token refresh
    if (status === 401 && data?.tokenExpired) { // Backend send data which contains : tokenExpired: boolean value 

      if (config._retry) {
        return Promise.reject(error);
      }

      config._retry = true;

      console.warn(`[API 401] ${method} ${url}`, data?.message);

      // Credential failures must NOT trigger refresh (avoids infinite retry / stuck login)
      const skipRefresh =
        url?.includes("/auth/login") ||
        url?.includes("/auth/register") ||
        url?.includes("/auth/verify-otp") ||
        url?.includes("/auth/forgot-password");
      if (skipRefresh) {
        return Promise.reject(error);
      }


      // Don't refresh if already refreshing
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            if (token) {
              config.headers.Authorization = `Bearer ${token}`;
              return api(config);
            }
            return Promise.reject(error);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      // Don't try to refresh if this is a refresh request
      if (url?.includes("/auth/refresh")) {
        console.warn("[API] Refresh token also expired - logout required");
        accessToken = null;
        // Trigger logout event
        window.dispatchEvent(new CustomEvent("auth:logout", { detail: { reason: "token_expired" } }));
        return Promise.reject(error);
      }

      isRefreshing = true;

      // Attempt to refresh token
      return api
        .post("/auth/refresh")
        .then((response) => {
          const newAccessToken = response.data?.data?.accessToken;
          if (!newAccessToken) {
            throw new Error("No access token in refresh response");
          }

          accessToken = newAccessToken;
          config.headers.Authorization = `Bearer ${newAccessToken}`;

          authDebug.tokenOp("REFRESH", newAccessToken, {
            status: "✓ Success",
            originalUrl: config.url
          });
          console.log("[API ✓] Token refreshed, retrying original request");
          processQueue(null, newAccessToken);

          // Notify socket to reconnect with new token
          window.dispatchEvent(new CustomEvent("auth:token-refreshed", { detail: { accessToken: newAccessToken } }));

          // Retry original request with new token
          return api(config);
        })
        .catch((refreshError) => {
          console.error("[API] Token refresh failed:", refreshError.message);
          accessToken = null;
          processQueue(refreshError, null);

          // Trigger logout
          window.dispatchEvent(new CustomEvent("auth:logout", { detail: { reason: "refresh_failed" } }));
          return Promise.reject(refreshError);
        });
    }

    // Handle other HTTP errors
    if (status === 403) {
      console.error(`[API 403 FORBIDDEN] ${method} ${url}`, data?.message);
    } else if (status === 400) {
      console.error(`[API 400 BAD REQUEST] ${method} ${url}`, data?.message);
    } else if (status === 500) {
      console.error(`[API 500 ERROR] ${method} ${url}`, data?.message);
    } else if (status === 429) {
      console.error(`[API 429 RATE LIMITED] ${method} ${url}`);
    } else if (!status) {
      console.error(`[API ERROR] Network/CORS issue on ${method} ${url}`);
    } else {
      console.error(`[API ${status}] ${method} ${url}`, data?.message);
    }

    return Promise.reject(error);
  }
);

/**
 * Set access token in memory
 * Called after successful login/registration/refresh
 * Only updates if token has changed
 */
export const setAccessToken = (token) => {
  // Only update if token actually changed
  if (accessToken === token) {
    if (process.env.NODE_ENV === "development") {
      console.log("[AUTH] Token unchanged, skipping duplicate set");
    }
    return;
  }

  accessToken = token;
  authDebug.tokenOp("SET", token, {
    status: token ? "✓ Set" : "⚠ Cleared",
    length: token?.length || 0
  });
};

/**
 * Get current access token
 */
export const getAccessToken = () => accessToken;

/**
 * Clear access token (on logout)
 * Note: Refresh token is cleared by the server via Set-Cookie header
 */
export const clearAccessToken = () => {
  accessToken = null;
  isRefreshing = false;
  failedQueue = [];
  if (process.env.NODE_ENV === "development") {
    console.log("[AUTH] Access token cleared from memory");
  }
};

/**
 * Extract data from API response
 */
export const extractApiData = (response) => response?.data?.data ?? response?.data ?? null;

/**
 * Extract error message from API response
 */
export const extractApiError = (error, fallbackMessage) =>
  error?.response?.data?.errors?.[0]?.message ||
  error?.response?.data?.error?.message ||
  error?.response?.data?.message ||
  error?.message ||
  fallbackMessage;

/**
 * Get API URL (for debugging)
 */
export const getApiUrl = () => API_URL;

/**
 * Get Socket.IO URL (for socket connections)
 */
export const getSocketUrl = () => SOCKET_URL;

/** Student profile photo: JSON body with base64 `data`, `contentType`, `fileName` */
export const uploadStudentPhoto = (body) =>
  api.put("/student/upload-photo", body, { timeout: 60000 });

/** Delete student profile photo */
export const deleteStudentPhoto = () =>
  api.delete("/student/photo", { timeout: 60000 });

/** Faculty/Admin: binary download */
export const downloadStudentPhoto = (studentId) =>
  api.get(`/student/download-photo/${encodeURIComponent(String(studentId).trim())}`, {
    responseType: "blob",
    timeout: 60000,
  });

/** Delete student resume */
export const deleteResume = () =>
  api.delete("/student/resume", { timeout: 60000 });

export default api;
