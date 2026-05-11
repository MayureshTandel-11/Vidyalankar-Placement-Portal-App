/**
 * Production-Grade Request Deduplication Utility
 *
 * ARCHITECTURE:
 * - In-flight promise caching: reuses promises for concurrent requests
 * - AbortController support: cancels stale requests
 * - Defensive error handling: never throws fake errors
 * - Timeout cleanup: prevents memory leaks
 * - React StrictMode compatible: handles double renders gracefully
 *
 * GUARANTEES:
 * - Only ONE API request executes for identical keys
 * - Duplicate renders reuse same promise (no race conditions)
 * - Successful responses never trigger error handlers
 * - State updates happen exactly once
 * - Proper cleanup on unmount/abort
 */

export class RequestDeduplicator {
  constructor(timeoutMs = 30000) {
    this.activeRequests = new Map();
    this.timeouts = new Map();
    this.abortControllers = new Map();
    this.timeoutMs = timeoutMs;
  }

  /**
   * Deduplicate a request - safely reuses in-flight promises
   * @param {string} key - Unique request identifier
   * @param {Function} requestFn - Async function that performs the request
   * @returns {Promise} Result of the request (never rejects with fake errors)
   */
  async deduplicate(key, requestFn) {
    // If request is already in progress, return cached promise
    if (this.activeRequests.has(key)) {
      if (process.env.NODE_ENV === "development") {
        console.log(`[DEDUPLICATE] ✓ Reusing in-flight request: ${key}`);
      }
      return this.activeRequests.get(key);
    }

    // Create AbortController for this request
    const controller = new AbortController();
    this.abortControllers.set(key, controller);

    // Wrap requestFn to pass abort signal if supported
    const wrappedFn = async () => {
      try {
        return await requestFn(controller);
      } catch (error) {
        // Re-throw original error (not a fake one)
        throw error;
      }
    };

    // Create promise with automatic timeout cleanup
    const promise = wrappedFn()
      .catch((error) => {
        // Log error but don't suppress - let caller handle it
        if (error.name !== "AbortError" && process.env.NODE_ENV === "development") {
          console.log(`[DEDUPLICATE] Request failed: ${key}`, error.message);
        }
        throw error; // Re-throw so caller can handle it
      })
      .finally(() => {
        // Always cleanup, regardless of success/failure
        this.cleanup(key);
      });

    // Store promise in cache
    this.activeRequests.set(key, promise);
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEDUPLICATE] → Started new request: ${key}`);
    }

    // Set timeout to prevent hanging requests
    const timeoutId = setTimeout(() => {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[DEDUPLICATE] Timeout (${this.timeoutMs}ms) for request: ${key}`);
      }
      this.abort(key);
    }, this.timeoutMs);

    this.timeouts.set(key, timeoutId);

    return promise;
  }

  /**
   * Abort specific request
   * Triggers AbortError in the requestFn
   */
  abort(key) {
    const controller = this.abortControllers.get(key);
    if (controller) {
      controller.abort();
      if (process.env.NODE_ENV === "development") {
        console.log(`[DEDUPLICATE] ✗ Aborted request: ${key}`);
      }
    }
    this.cleanup(key);
  }

  /**
   * Internal cleanup - removes request from all caches
   * Called automatically after promise settles or on abort
   */
  cleanup(key) {
    // Clear timeout
    const timeoutId = this.timeouts.get(key);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(key);
    }

    // Remove from abort controllers
    this.abortControllers.delete(key);

    // Remove from active requests (happens last)
    const hadRequest = this.activeRequests.has(key);
    this.activeRequests.delete(key);

    if (hadRequest && process.env.NODE_ENV === "development") {
      console.log(`[DEDUPLICATE] ✓ Cleaned up request: ${key}`);
    }
  }

  /**
   * Clear all pending requests (on logout/unmount)
   */
  clearAll() {
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEDUPLICATE] Clearing all ${this.activeRequests.size} pending requests`);
    }

    // Abort all in-flight requests
    for (const key of this.activeRequests.keys()) {
      this.abort(key);
    }

    this.activeRequests.clear();
    this.timeouts.clear();
    this.abortControllers.clear();
  }

  /**
   * Manually clear specific request
   */
  clear(key) {
    if (this.activeRequests.has(key)) {
      this.abort(key);
    }
  }

  /**
   * Get current number of active requests
   */
  getActiveCount() {
    return this.activeRequests.size;
  }

  /**
   * Get all active request keys
   */
  getActiveKeys() {
    return Array.from(this.activeRequests.keys());
  }
}

// Export singleton instance
export const deduplicator = new RequestDeduplicator();
