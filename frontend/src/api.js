/**
 * DEPRECATED: This file is now a compatibility layer for older code.
 * All code should import directly from 'src/utils/apiClient' instead.
 *
 * This file re-exports the apiClient instance to maintain backward compatibility
 * with existing imports throughout the codebase.
 *
 * NEW IMPORTS (preferred):
 *   import api, { setAccessToken, clearAccessToken, extractApiData, extractApiError } from '@/utils/apiClient'
 *
 * OLD IMPORTS (still work but deprecated):
 *   import api, { setAccessToken, clearAccessToken, extractApiData, extractApiError } from '@/api'
 */

// Re-export everything from apiClient
export {
  setAccessToken,
  clearAccessToken,
  extractApiData,
  extractApiError,
  getAccessToken,
  getApiUrl,
  getSocketUrl
} from "./utils/apiClient";

// Re-export the default api instance
import api from "./utils/apiClient";

export default api;
