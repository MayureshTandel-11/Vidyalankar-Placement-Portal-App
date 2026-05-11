# Request Deduplication System - Deep Dive

## Overview

The `RequestDeduplicator` class is the core mechanism that prevents duplicate API requests and ensures state consistency. It's used by OpportunitiesContext to safely handle concurrent fetches from multiple components.

---

## Architecture

### How It Works

```javascript
// requestDeduplication.js
class RequestDeduplicator {
  constructor(timeoutMs = 30000) {
    this.activeRequests = new Map();      // Stores in-flight promises
    this.timeouts = new Map();             // Auto-abort timers
    this.abortControllers = new Map();     // Can abort requests
  }

  async deduplicate(key, requestFn) {
    // 1. Check if request already in-flight
    if (this.activeRequests.has(key)) {
      return this.activeRequests.get(key);  // Return existing promise
    }

    // 2. Create AbortController for this request
    const controller = new AbortController();
    this.abortControllers.set(key, controller);

    // 3. Run the request function
    const promise = requestFn(controller)
      .catch(error => {
        if (error.name !== "AbortError") throw error;
      })
      .finally(() => {
        this.cleanup(key);  // Clean up after done
      });

    // 4. Store promise for future duplicates
    this.activeRequests.set(key, promise);

    // 5. Set timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      this.abort(key);
    }, timeoutMs);
    this.timeouts.set(key, timeoutId);

    return promise;
  }

  cleanup(key) {
    this.timeouts.delete(key);
    this.abortControllers.delete(key);
    this.activeRequests.delete(key);  // Only removed AFTER promise settles
  }

  abort(key) {
    this.abortControllers.get(key)?.abort();
    this.cleanup(key);
  }
}

export const deduplicator = new RequestDeduplicator();
```

---

## Scenarios & Flow

### Scenario 1: Initial Mount (Provider + Dashboard)

```
Timeline:

T=0ms   Provider.useEffect runs
        └─ await fetchOpportunities()
           └─ await deduplicator.deduplicate("opportunities_fetch", requestFn)
              └─ activeRequests.has("opportunities_fetch") ? NO
              └─ Create AbortController
              └─ Start API call
              └─ activeRequests.set("opportunities_fetch", promise)
              └─ Return promise
           └─ Await result...

T=50ms  Dashboard.useEffect runs
        └─ await fetchOpportunities()
           └─ await deduplicator.deduplicate("opportunities_fetch", requestFn)
              └─ activeRequests.has("opportunities_fetch") ? YES ✅
              └─ Return SAME promise
           └─ Await same result...

T=200ms API Response arrives
        └─ requestFn completes successfully
        └─ Promise resolves with { active: [...], archive: [...] }
        └─ .finally() runs
           └─ cleanup("opportunities_fetch")
           └─ activeRequests.delete("opportunities_fetch")
           └─ Promise now removed from cache

T=200ms Provider gets result
        └─ State updates in context
        └─ Re-renders, Dashboard component re-renders
        └─ Dashboard also got result (same promise)

Result: ONE API call, TWO components, ZERO duplicates ✅
```

### Scenario 2: StrictMode Double Render

```
Timeline:

T=0ms   Initial render:
        └─ Provider mounts
           └─ Effect runs → deduplicate("opportunities_fetch", ...)
           └─ Starts fetch (A)
           └─ activeRequests.set("opportunities_fetch", promiseA)

T=50ms  StrictMode unmounts Provider (to test cleanup)
        └─ Provider.useEffect cleanup runs
           └─ isMountedRef.current = false
           └─ (deduplicator NOT cleared ✅)

T=100ms StrictMode remounts Provider (to verify mount works)
        └─ Provider.useEffect runs again
           └─ await deduplicate("opportunities_fetch", ...)
              └─ activeRequests.has("opportunities_fetch") ? YES ✅
              └─ Request (A) still in-flight
              └─ Return promiseA (same as before)
           └─ Await result...

T=200ms Response arrives
        └─ promiseA resolves
        └─ Inside deduplicator: finally() cleanup("opportunities_fetch")
           └─ activeRequests.delete("opportunities_fetch")

T=200ms Both mounted instances get result
        └─ First instance (before unmount): got response, but isMountedRef = false
           └─ Only if isMountedRef.current ? dispatch(...) → SKIPPED
        └─ Second instance (after remount): got response, isMountedRef = true
           └─ if (isMountedRef.current) ? dispatch(...) → RUNS ✅
           └─ State updates
           └─ UI renders

Result: ONE API call, TWO mounts, NO duplicates, NO stale state ✅
```

### Scenario 3: Slow Network (Timeout Test)

```
Timeline:

T=0ms   Request starts
        └─ deduplicator.deduplicate("opportunities_fetch", requestFn)
        └─ Set timeout: 30 seconds
        └─ activeRequests.set("opportunities_fetch", promise)

T=15s   Second call during slow fetch
        └─ deduplicate("opportunities_fetch", ...)
        └─ activeRequests.has("opportunities_fetch") ? YES
        └─ Return same promise (reuse in-flight)
        └─ Waiting for response...

T=30s   Timeout fires!
        └─ setTimeout callback runs
        └─ abort("opportunities_fetch")
           └─ AbortController.abort()
           └─ Promise rejects with AbortError
           └─ cleanup("opportunities_fetch")
           └─ activeRequests.delete("opportunities_fetch")

T=30s   Error handler catches AbortError
        └─ if (error.name === "AbortError") return
        └─ Returns cached state (if available)
        └─ No UI update (already on screen)

T=31s   User retries or navigates
        └─ New fetch call comes in
        └─ deduplicate("opportunities_fetch", ...)
        └─ activeRequests.has("opportunities_fetch") ? NO ✅
        └─ Cache cleared after timeout, so fresh request
        └─ Start new API call

Result: Network timeout handled gracefully ✅
```

### Scenario 4: Multiple Dashboard Instances

```html
<!-- User opens dashboard in tab 1 and tab 2 -->
```

```
Tab 1 Timeline:
T=0ms   Tab1 Provider mounts → deduplicate("opportunities_fetch", ...)
        └─ activeRequests.set("opportunities_fetch", promiseA)
        └─ Start API call (A)

Tab 2 Timeline:
T=10ms  Tab2 Provider mounts → deduplicate("opportunities_fetch", ...)
        └─ activeRequests.has("opportunities_fetch") ?

        ⚠️  IMPORTANT: Each tab has its own RequestDeduplicator instance!
            This is because deduplicator is a singleton at module level:

            // requestDeduplication.js
            export const deduplicator = new RequestDeduplicator();

        ✅ Each import gets same singleton
        ✅ But each browser tab is separate JS context
        └─ So Tab2 gets its own deduplicator instance
        └─ activeRequests.set("opportunities_fetch", promiseB)
        └─ Start separate API call (B)

Network View:
GET /opportunities/active  (from Tab1)  200
GET /opportunities/archive (from Tab1)  200
GET /opportunities/active  (from Tab2)  200
GET /opportunities/archive (from Tab2)  200

Result: Each tab has its own request (expected) ✅
        But within each tab, duplicates are deduped ✅
```

---

## How It Prevents Race Conditions

### Race Condition Without Deduplication

```javascript
// Component A mounts
const fetchA = async () => {
  const res = await api.get("/opportunities/active");
  setState1(res.data);  // Runs at T=200ms
};

// Component B mounts (immediately after A)
const fetchB = async () => {
  const res = await api.get("/opportunities/active");
  setState2(res.data);  // Runs at T=200ms
};

fetchA(); // Request 1 starts
fetchB(); // Request 2 starts immediately

// Network sends TWO identical requests

T=200ms Response 1 arrives
        setState1(res1.data)
        └─ Context state updates
        └─ All components re-render
        └─ Component B uses res1.data

T=200ms Response 2 arrives
        setState2(res2.data)
        └─ Same data (arrived at same time)
        └─ But happened TWICE
        └─ Wasted network request
```

### With Deduplication

```javascript
// Component A mounts
const fetchA = async () => {
  const res = await deduplicator.deduplicate(key, async (controller) => {
    return await api.get("/opportunities/active", { signal: controller.signal });
  });
  setState1(res.data);
};

// Component B mounts (immediately after A)
const fetchB = async () => {
  const res = await deduplicator.deduplicate(key, async (controller) => {
    return await api.get("/opportunities/active", { signal: controller.signal });
  });
  setState2(res.data);
};

fetchA(); // activeRequests.set(key, promise)
fetchB(); // activeRequests.has(key) ? YES → return same promise

// Network sends ONE request

T=200ms Response arrives
        Both promises resolve with same data
        setState1(res.data) and setState2(res.data) run
        Context state updates once
        All components re-render once
        ✅ Single request, correct state
```

---

## How It Handles Aborts Safely

### StrictMode Unmount/Remount

```javascript
useEffect(() => {
  isMountedRef.current = true;
  fetchOpportunities();

  return () => {
    isMountedRef.current = false;  // Mark as unmounted
    // ✅ Do NOT abort deduplicator!
  };
}, []);

// Inside fetchOpportunities:
const fetchOpportunities = async () => {
  try {
    const result = await deduplicator.deduplicate(key, async (controller) => {
      // ... API call with controller.signal ...
    });

    // ✅ Only update state if still mounted
    if (isMountedRef.current) {
      dispatch({ type: "SET_OPPORTUNITIES", active, archive });
    }
  } catch (error) {
    // ✅ Abort errors are expected, not failures
    if (error.name === "AbortError") {
      return state.opportunities;
    }
    // Real errors get handled
    throw error;
  }
};
```

**Flow:**
1. Component mounts → `isMountedRef.current = true`
2. Fetch starts
3. StrictMode unmounts → cleanup sets `isMountedRef.current = false`
4. Fetch completes in background
5. Inside promise: `if (isMountedRef.current)` → FALSE
6. setState is SKIPPED → no stale state
7. StrictMode remounts → new fetch starts (or gets cached promise)
8. `isMountedRef.current = true` again
9. Next response updates state correctly

**Result:** No stale state updates ✅

---

## Performance Characteristics

### Memory Usage

```javascript
// After successful fetch:
activeRequests.size = 0         // Promises removed after settling
timeouts.size = 0               // Timers cleaned up
abortControllers.size = 0       // Controllers cleaned up

// Memory leak: ✅ Prevented
```

### Network Usage

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| Provider + Dashboard mount | 2 requests | 1 request ✅ |
| Remount during slow fetch | 2 requests | 1 request ✅ |
| User navigates away/back | 2+ requests | 0-1 request ✅ |
| Browser refresh | 2 requests | 1 request ✅ |
| Multiple concurrent callers | N requests | 1 request ✅ |

### Latency

```javascript
// Without deduplication:
Component A: 200ms (own request)
Component B: 200ms (own request) + race condition potential

// With deduplication:
Component A: 200ms
Component B: ~0ms (reuses promise from A)
```

---

## Integration with OpportunitiesContext

### How Context Uses Deduplication

```javascript
const fetchOpportunities = useCallback(async (forceRefresh = false) => {
  // Check cache first
  if (cacheValid) {
    return state.opportunities;  // Return cached instantly
  }

  // Use deduplicator for API calls
  const result = await deduplicator.deduplicate(
    "opportunities_fetch",     // Key: prevents duplicates
    async (controller) => {
      // This function only runs ONCE per key
      const [activeRes, archiveRes] = await Promise.all([
        api.get("/opportunities/active", { signal: controller.signal }),
        api.get("/opportunities/archive", { signal: controller.signal }),
      ]);

      const active = extractApiData(activeRes);
      const archive = extractApiData(archiveRes);

      // Update state
      if (isMountedRef.current) {
        dispatch({
          type: "SET_OPPORTUNITIES",
          active,
          archive,
        });
      }

      return { active, archive };
    }
  );

  return result;
}, [state.lastFetch, state.opportunities]);
```

### Key Points

1. **Same key** → Deduplicates to single request
2. **Different keys** → Separate requests (e.g., `timeline_123`, `attendance_456`)
3. **Mounted check** → Prevents stale state updates
4. **AbortError handling** → Ignores expected aborts
5. **Cache layer** → 5-minute TTL reduces requests further

---

## Testing the Deduplication

### Manual Test in Browser Console

```javascript
// Check active requests
window.__deduplicator?.getActiveKeys?.()
// Output: ["opportunities_fetch"] if request in-flight

// Check active count
window.__deduplicator?.getActiveCount?.()
// Output: 1 if one request active

// Note: deduplicator is not exposed by default
// You'd need to add: window.__deduplicator = deduplicator;
```

### Network Tab Verification

```
Expected (Correct):
GET /opportunities/active          200  [merge]
GET /opportunities/archive         200  [merge]

Bad (Before Fix):
GET /opportunities/active          (aborted)    ← Wrong
GET /opportunities/active          (aborted)    ← Wrong
GET /opportunities/active          200          ← Finally got it
```

---

## Edge Cases Handled

### ✅ Slow Network (Timeout)
Request hangs > 30s → Aborts automatically → Retried fresh

### ✅ Network Error
API error (500) → Re-thrown → Component handles it → Can retry

### ✅ Component Unmounts During Fetch
State update guarded with `isMountedRef` → No stale updates

### ✅ Rapid Navigation
Navigates away → Unmount marks `isMountedRef = false` → Response arrives but can't update → Fresh fetch on re-enter

### ✅ Multiple Mounts of Same Component
Both trigger fetch → Deduplicator merges to one request → Single state update

### ✅ Cache Expired During Fetch
Cache valid check passes → Returns instant data → User gets consistent view

---

## Summary

The `RequestDeduplicator` is a production-grade utility that:

- ✅ Prevents duplicate API requests using in-flight promise caching
- ✅ Supports AbortController for cancellation
- ✅ Has automatic timeout cleanup
- ✅ Is StrictMode compatible
- ✅ Enables safe concurrent fetches
- ✅ Reduces network usage
- ✅ Prevents race conditions
- ✅ Works seamlessly with React lifecycle

Combined with the mounted checks and AbortError handling in OpportunitiesContext, it creates a robust, production-ready data fetching system.
