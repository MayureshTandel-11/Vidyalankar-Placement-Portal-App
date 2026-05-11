/**
 * Request Cache Utility
 *
 * Caches GET request responses with TTL (time-to-live)
 * Invalidates cache when needed
 *
 * Usage:
 * const cache = new RequestCache();
 * const data = await cache.get('opportunities', () => api.get('/opportunities'), 5 * 60 * 1000);
 */

export class RequestCache {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Get cached value or fetch if expired/missing
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Async function to fetch data if cache miss/expired
   * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
   * @returns {Promise} Cached or fetched data
   */
  async get(key, fetchFn, ttl = 5 * 60 * 1000) {
    const cached = this.cache.get(key);
    const now = Date.now();

    // Return cached data if still valid
    if (cached && now - cached.timestamp < ttl) {
      console.log(`[CACHE] Cache hit for key: ${key}`);
      return cached.data;
    }

    // Fetch fresh data
    console.log(`[CACHE] Cache miss for key: ${key}, fetching fresh data`);
    try {
      const data = await fetchFn();
      this.cache.set(key, {
        data,
        timestamp: now
      });
      return data;
    } catch (error) {
      // If fetch fails and we have stale data, return it
      if (cached) {
        console.warn(`[CACHE] Fetch failed, returning stale data for key: ${key}`);
        return cached.data;
      }
      throw error;
    }
  }

  /**
   * Set cache value manually
   */
  set(key, data) {
    console.log(`[CACHE] Set cache for key: ${key}`);
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(key) {
    if (this.cache.has(key)) {
      console.log(`[CACHE] Invalidated cache for key: ${key}`);
      this.cache.delete(key);
    }
  }

  /**
   * Invalidate all cache entries
   */
  invalidateAll() {
    console.log(`[CACHE] Invalidating all cache (${this.cache.size} entries)`);
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export const requestCache = new RequestCache();
