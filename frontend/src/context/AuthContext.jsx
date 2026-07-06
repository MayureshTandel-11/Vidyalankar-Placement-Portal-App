import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { setAccessToken, clearAccessToken } from "../utils/apiClient";
import { initSocket, disconnectSocket } from "../utils/socket";
import { sanitizeAuthStateForStorage } from "../utils/authStorage";

const AuthContext = createContext(null);

/**
 * Production-grade Auth Provider
 * Features:
 * - In-memory token storage (never localStorage/sessionStorage for sensitive tokens)
 * - Proper token persistence via localStorage for non-sensitive user data only
 * - Safe token hydration on app load
 * - Automatic socket reconnection on token changes
 * - Event-driven logout on token expiration
 * - No token state conflicts
 */
export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(() => {
    try {
      // On initial mount, try to restore from localStorage
      // IMPORTANT: Token is stored in apiClient in-memory, not localStorage
      const saved = localStorage.getItem("placement_auth");
      if (!saved) {
        return { token: "", user: null };
      }

      const parsed = JSON.parse(saved);
      const safeParsed = sanitizeAuthStateForStorage(parsed);

      if (JSON.stringify(safeParsed) !== saved) {
        localStorage.setItem("placement_auth", JSON.stringify(safeParsed));
      }

      // Defensive: validate parsed data structure
      if (typeof safeParsed !== "object" || !safeParsed.user) {
        console.warn("[AUTH] Invalid auth data in localStorage, clearing");
        localStorage.removeItem("placement_auth");
        clearAccessToken();
        return { token: "", user: null };
      }

      // Validate user object has required fields
      if (typeof safeParsed.user !== "object" || !safeParsed.user._id) {
        console.warn("[AUTH] Malformed user object, clearing");
        localStorage.removeItem("placement_auth");
        clearAccessToken();
        return { token: "", user: null };
      }

      if (process.env.NODE_ENV === "development") {
        console.log("[AUTH] Restored user from localStorage:", {
          userId: safeParsed.user._id,
          email: safeParsed.user.email,
          role: safeParsed.user.role
        });
      }

      // Set token in apiClient if present
      if (safeParsed.token) {
        setAccessToken(safeParsed.token);
      }

      return safeParsed;
    } catch (err) {
      console.error("[AUTH] Error restoring auth state:", err.message);
      clearAccessToken();
      localStorage.removeItem("placement_auth");
      return { token: "", user: null };
    }
  });

  const [isHydrated, setIsHydrated] = useState(false);

  /**
   * Login: set token and user info
   * Token is stored in apiClient (in-memory)
   * User info is stored in localStorage (non-sensitive)
   */
  const login = useCallback((token, user) => {
    if (!token || !user) {
      console.warn("[AUTH] Invalid login data", { token: !!token, user: !!user });
      return;
    }

    // Validate token is a string
    if (typeof token !== "string") {
      console.error("[AUTH] Invalid token type:", typeof token);
      return;
    }

    // Validate user object
    if (typeof user !== "object" || !user._id) {
      console.error("[AUTH] Invalid user object for login");
      return;
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[AUTH LOGIN] User logged in:", {
        userId: user._id,
        email: user.email,
        role: user.role
      });
    }

    // Set token in apiClient (in-memory only)
    setAccessToken(token);

    // Update state and persist only lightweight auth info
    const authState = { token, user };
    const safeAuthState = sanitizeAuthStateForStorage(authState);
    setAuth(authState);
    localStorage.setItem("placement_auth", JSON.stringify(safeAuthState));

    // Initialize socket connection with new token
    initSocket();
  }, []);

  const updateUser = useCallback((updates) => {
    setAuth((prev) => {
      if (!prev.user) {
        return prev;
      }

      const nextUser = { ...prev.user, ...updates };
      const nextState = { ...prev, user: nextUser };
      const safeNextState = sanitizeAuthStateForStorage(nextState);
      localStorage.setItem("placement_auth", JSON.stringify(safeNextState));
      return nextState;
    });
  }, []);

  /**
   * Logout: clear all auth state
   * Clears token from apiClient and localStorage
   */
  const logout = useCallback(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("[AUTH LOGOUT] User logged out");
    }

    clearAccessToken();
    disconnectSocket();
    setAuth({ token: "", user: null });
    localStorage.removeItem("placement_auth");
  }, []);

  /**
   * Sync logout when token becomes empty
   * Ensures consistency if auth state is cleared externally
   */
  useEffect(() => {
    if (!auth.token && auth.user) {
      // Token cleared but user still present - inconsistent state
      if (process.env.NODE_ENV === "development") {
        console.log("[AUTH] Token cleared, syncing logout");
      }
      clearAccessToken();
      localStorage.removeItem("placement_auth");
      setAuth({ token: "", user: null });
    }
  }, [auth.token, auth.user]);

  /**
   * Listen for logout events triggered by apiClient
   * (e.g., token expired, refresh failed)
   */
  useEffect(() => {
    const handleLogout = (event) => {
      const reason = event.detail?.reason || "unknown";
      console.warn(`[AUTH] Logout event triggered - reason: ${reason}`);
      logout();
    };

    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, [logout]);

  /**
   * Listen for token refresh events
   * Update token in context when apiClient refreshes it
   */
  useEffect(() => {
    const handleTokenRefresh = (event) => {
      const newToken = event.detail?.accessToken;
      if (newToken && auth.user) {
        if (process.env.NODE_ENV === "development") {
          console.log("[AUTH] Token refreshed via event");
        }
        // Update auth state with new token
        const authState = { token: newToken, user: auth.user };
        const safeAuthState = sanitizeAuthStateForStorage(authState);
        setAuth(authState);
        localStorage.setItem("placement_auth", JSON.stringify(safeAuthState));
      }
    };

    window.addEventListener("auth:token-refreshed", handleTokenRefresh);
    return () => window.removeEventListener("auth:token-refreshed", handleTokenRefresh);
  }, [auth.user]);

  /**
   * Mark as hydrated after initial mount
   * Allows consumers to know when auth state is ready
   */
  useEffect(() => {
    if (!isHydrated) {
      if (process.env.NODE_ENV === "development") {
        console.log("[AUTH] Auth hydration complete", {
          hasToken: !!auth.token,
          hasUser: !!auth.user
        });
      }
      setIsHydrated(true);
    }
  }, [isHydrated, auth.token, auth.user]);

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
