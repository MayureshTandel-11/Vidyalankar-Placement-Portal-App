import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import {
  setAccessToken,
  clearAccessToken,
  refreshSession,
} from "../utils/apiClient";
import api from "../utils/apiClient";
import { initSocket, disconnectSocket } from "../utils/socket";
import { sanitizeAuthStateForStorage } from "../utils/authStorage";

const AuthContext = createContext(null);

/**
 * Auth Provider
 * - Access token lives in memory only (apiClient + React state)
 * - localStorage keeps user profile only (never the JWT)
 * - Session restore uses httpOnly refresh cookie via /auth/refresh
 */
export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(() => {
    try {
      const saved = localStorage.getItem("placement_auth");
      if (!saved) {
        return { token: "", user: null };
      }

      const parsed = JSON.parse(saved);
      const safeParsed = sanitizeAuthStateForStorage(parsed);

      // Migrate any legacy token out of localStorage immediately
      localStorage.setItem("placement_auth", JSON.stringify(safeParsed));

      if (typeof safeParsed !== "object" || !safeParsed.user) {
        console.warn("[AUTH] Invalid auth data in localStorage, clearing");
        localStorage.removeItem("placement_auth");
        clearAccessToken();
        return { token: "", user: null };
      }

      if (typeof safeParsed.user !== "object" || !safeParsed.user._id) {
        console.warn("[AUTH] Malformed user object, clearing");
        localStorage.removeItem("placement_auth");
        clearAccessToken();
        return { token: "", user: null };
      }

      if (import.meta.env.DEV) {
        console.log("[AUTH] Restored user from localStorage:", {
          userId: safeParsed.user._id,
          email: safeParsed.user.email,
          role: safeParsed.user.role,
        });
      }

      // Token is intentionally NOT restored from storage
      return { token: "", user: safeParsed.user };
    } catch (err) {
      console.error("[AUTH] Error restoring auth state:", err.message);
      clearAccessToken();
      localStorage.removeItem("placement_auth");
      return { token: "", user: null };
    }
  });

  const [isHydrated, setIsHydrated] = useState(false);
  const sessionRestoreAttempted = useRef(false);

  const persistUser = useCallback((user) => {
    const safeAuthState = sanitizeAuthStateForStorage({ user });
    localStorage.setItem("placement_auth", JSON.stringify(safeAuthState));
  }, []);

  const login = useCallback((token, user) => {
    if (!token || !user) {
      console.warn("[AUTH] Invalid login data", { token: !!token, user: !!user });
      return;
    }

    if (typeof token !== "string") {
      console.error("[AUTH] Invalid token type:", typeof token);
      return;
    }

    if (typeof user !== "object" || !user._id) {
      console.error("[AUTH] Invalid user object for login");
      return;
    }

    if (import.meta.env.DEV) {
      console.log("[AUTH LOGIN] User logged in:", {
        userId: user._id,
        email: user.email,
        role: user.role,
      });
    }

    setAccessToken(token);
    setAuth({ token, user });
    persistUser(user);
    initSocket();
  }, [persistUser]);

  const updateUser = useCallback((updates) => {
    setAuth((prev) => {
      if (!prev.user) {
        return prev;
      }

      const nextUser = { ...prev.user, ...updates };
      persistUser(nextUser);
      return { ...prev, user: nextUser };
    });
  }, [persistUser]);

  const logout = useCallback(async () => {
    if (import.meta.env.DEV) {
      console.log("[AUTH LOGOUT] User logged out");
    }

    try {
      // Clears httpOnly refresh cookie on the server (cookie-only endpoint)
      await api.post("/auth/logout");
    } catch (err) {
      // Still clear local session even if network/cookie clear fails
      if (import.meta.env.DEV) {
        console.warn("[AUTH LOGOUT] Server logout failed:", err.message);
      }
    }

    clearAccessToken();
    disconnectSocket();
    setAuth({ token: "", user: null });
    localStorage.removeItem("placement_auth");
  }, []);

  // Restore access token from refresh cookie after user hydration
  useEffect(() => {
    if (sessionRestoreAttempted.current) return;
    sessionRestoreAttempted.current = true;

    const restoreSession = async () => {
      if (!auth.user) {
        setIsHydrated(true);
        return;
      }

      try {
        const { accessToken, user } = await refreshSession();
        setAccessToken(accessToken);
        const nextUser = user && user._id ? user : auth.user;
        setAuth({ token: accessToken, user: nextUser });
        persistUser(nextUser);
        initSocket();
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn("[AUTH] Session restore failed:", err.message);
        }
        clearAccessToken();
        disconnectSocket();
        setAuth({ token: "", user: null });
        localStorage.removeItem("placement_auth");
      } finally {
        setIsHydrated(true);
      }
    };

    restoreSession();
    // Intentionally run once on mount with initial auth.user
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleLogout = (event) => {
      const reason = event.detail?.reason || "unknown";
      console.warn(`[AUTH] Logout event triggered - reason: ${reason}`);
      logout();
    };

    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, [logout]);

  useEffect(() => {
    const handleTokenRefresh = (event) => {
      const newToken = event.detail?.accessToken;
      if (newToken && auth.user) {
        if (import.meta.env.DEV) {
          console.log("[AUTH] Token refreshed via event");
        }
        setAuth((prev) => ({ ...prev, token: newToken }));
        // Do not write access token to localStorage
      }
    };

    window.addEventListener("auth:token-refreshed", handleTokenRefresh);
    return () => window.removeEventListener("auth:token-refreshed", handleTokenRefresh);
  }, [auth.user]);

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, updateUser, isHydrated }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
