import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import api from "../api";
import { extractApiData } from "../utils/apiClient";
import { deduplicator } from "../utils/requestDeduplication";

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const opportunitiesReducer = (state, action) => {
  switch (action.type) {
    case "SET_OPPORTUNITIES":
      return {
        ...state,
        opportunities: { active: action.active, archive: action.archive },
        lastFetch: Date.now(),
        loading: false,
      };
    case "UPDATE_OPPORTUNITY":
      const updateOpp = (list, id, updates) =>
        list.map((opp) =>
          opp._id === id ? { ...opp, ...updates } : opp
        );

      return {
        ...state,
        opportunities: {
          active: updateOpp(state.opportunities.active || [], action.id, action.updates),
          archive: updateOpp(state.opportunities.archive || [], action.id, action.updates),
        },
      };
    case "INVALIDATE_CACHE":
      return { ...state, lastFetch: 0 };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "INVALIDATE_TIMELINE_CACHE":
      const updatedTimelines = { ...state.timelines };
      delete updatedTimelines[action.opportunityId];
      return { ...state, timelines: updatedTimelines };
    case "SET_TIMELINE":
      return {
        ...state,
        timelines: {
          ...state.timelines,
          [action.opportunityId]: {
            data: Array.isArray(action.data) ? action.data : [],
            activeStages: Array.isArray(action.activeStages) ? action.activeStages : [],
            timestamp: Date.now(),
          },
        },
      };
    case "SET_ATTENDANCE":
      return {
        ...state,
        attendance: {
          ...state.attendance,
          [`${action.opportunityId}:${action.stage}`]: {
            data: Array.isArray(action.data) ? action.data : [],
            timestamp: Date.now(),
          },
        },
      };
    default:
      return state;
  }
};

const initialState = {
  opportunities: { active: [], archive: [] },
  timelines: {},
  attendance: {},
  applicantCounts: {},
  lastFetch: 0,
  loading: false,
};

const OpportunitiesContext = createContext();

export const OpportunitiesProvider = ({ children }) => {
  const [state, dispatch] = useReducer(opportunitiesReducer, initialState);

  // Track mount/unmount cycle for deduplication cleanup (NOT for guarding fetches)
  const isMountedRef = useRef(true);

  /**
   * Fetch opportunities from API
   * Respects cache duration and uses deduplicator for duplicate prevention
   * CRITICAL: Does NOT use mount guards - deduplicator handles duplicate requests
   */
  const fetchOpportunities = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    const cacheValid = !forceRefresh &&
                       (now - state.lastFetch < CACHE_DURATION) &&
                       (state.opportunities.active.length > 0 || state.opportunities.archive.length > 0);

    // Return cached data if valid
    if (cacheValid) {
      if (process.env.NODE_ENV === "development") {
        console.log("[OPPORTUNITIES ✓] Using cached data", {
          active: state.opportunities.active.length,
          archive: state.opportunities.archive.length,
          cacheAge: now - state.lastFetch
        });
      }
      return state.opportunities;
    }

    // Use deduplicator to prevent duplicate API calls
    const deduplicateKey = "opportunities_fetch";

    try {
      dispatch({ type: "SET_LOADING", loading: true });

      const result = await deduplicator.deduplicate(deduplicateKey, async (controller) => {
        if (process.env.NODE_ENV === "development") {
          console.log("[OPPORTUNITIES] Fetching active and archive opportunities...");
        }

        const [activeRes, archiveRes] = await Promise.all([
          api.get("/opportunities/active", { signal: controller?.signal }),
          api.get("/opportunities/archive", { signal: controller?.signal }),
        ]);

        // Defensive: validate and sanitize API responses
        const active = Array.isArray(extractApiData(activeRes)) ? extractApiData(activeRes) : [];
        const archive = Array.isArray(extractApiData(archiveRes)) ? extractApiData(archiveRes) : [];

        if (process.env.NODE_ENV === "development") {
          console.log("[OPPORTUNITIES] Fetch successful", { active: active.length, archive: archive.length });
        }

        // CRITICAL: Only update state if component is still mounted
        // This prevents stale state updates from aborted StrictMode requests
        if (isMountedRef.current) {
          dispatch({
            type: "SET_OPPORTUNITIES",
            active,
            archive,
          });
        }

        return { active, archive };
      });

      return result || state.opportunities;
    } catch (error) {
      // CRITICAL: Ignore AbortError - it's expected on unmount/remount
      // Do NOT treat it as a failure that should update state
      if (error.name === "AbortError") {
        if (process.env.NODE_ENV === "development") {
          console.log("[OPPORTUNITIES] Request aborted (expected on unmount/remount)");
        }
        return state.opportunities;
      }

      // Real errors should only update loading state
      console.error("[OPPORTUNITIES ERROR] Fetch failed:", error.message);
      dispatch({ type: "SET_LOADING", loading: false });

      // Return current state on error (don't wipe valid data)
      return state.opportunities;
    }
  }, [state.lastFetch, state.opportunities]);

  /**
   * Initial fetch on provider mount
   * StrictMode-safe: deduplicator prevents duplicate requests
   * No mount guards needed - deduplicator handles everything
   */
  useEffect(() => {
    // Mark component as mounted
    isMountedRef.current = true;

    if (process.env.NODE_ENV === "development") {
      console.log("[OPPORTUNITIES] Provider mounted, triggering fetch");
    }

    // Fetch opportunities on mount
    // The deduplicator will prevent duplicate requests even if StrictMode remounts
    fetchOpportunities(false);

    // Cleanup on unmount
    return () => {
      // Mark component as unmounted
      isMountedRef.current = false;

      if (process.env.NODE_ENV === "development") {
        console.log("[OPPORTUNITIES] Provider unmounted");
      }
      // CRITICAL: Do NOT clear deduplicator here
      // Clearing it would abort valid in-flight requests
      // Let promises complete naturally or get cancelled by AbortController
    };
  }, []); // Empty dependencies - runs only on mount/unmount

  /**
   * Fetch timeline with caching and deduplication
   */
  const fetchTimeline = useCallback(
    async (opportunityId) => {
      // Guard: validate input
      if (!opportunityId || opportunityId === "null") {
        console.warn("[TIMELINE] Invalid opportunity ID:", opportunityId);
        return { timeline: [], activeStages: [] };
      }

      const cacheKey = `timeline_${opportunityId}`;

      try {
        const result = await deduplicator.deduplicate(cacheKey, async (controller) => {
          // Check cache first
          const cached = state.timelines[opportunityId];
          if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            if (process.env.NODE_ENV === "development") {
              console.log(`[TIMELINE ✓] Using cached data for: ${opportunityId}`);
            }
            return {
              timeline: Array.isArray(cached.data) ? cached.data : [],
              activeStages: Array.isArray(cached.activeStages) ? cached.activeStages : [],
            };
          }

          // Fetch fresh data
          const response = await api.get(`/timeline/${opportunityId}`, {
            signal: controller?.signal
          });
          const data = extractApiData(response);

          // Defensive: validate response structure
          const timelineData = Array.isArray(data?.timeline) ? data.timeline : [];
          const activeStagesData = Array.isArray(data?.activeStages) ? data.activeStages : [];

          dispatch({
            type: "SET_TIMELINE",
            opportunityId,
            data: timelineData,
            activeStages: activeStagesData,
          });

          return { timeline: timelineData, activeStages: activeStagesData };
        });

        return result || { timeline: [], activeStages: [] };
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("[TIMELINE ERROR] Fetch failed:", error.message);
        }
        return { timeline: [], activeStages: [] };
      }
    },
    [state.timelines]
  );

  /**
   * Fetch attendance with caching and deduplication
   */
  const fetchAttendance = useCallback(
    async (opportunityId, stage) => {
      // Guard: validate inputs
      if (!opportunityId || !stage || opportunityId === "null" || stage === "null") {
        console.warn("[ATTENDANCE] Invalid opportunity ID or stage:", { opportunityId, stage });
        return [];
      }

      const cacheKey = `attendance_${opportunityId}_${stage}`;

      try {
        const result = await deduplicator.deduplicate(cacheKey, async (controller) => {
          // Check cache first
          const key = `${opportunityId}:${stage}`;
          const cached = state.attendance[key];

          if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            if (process.env.NODE_ENV === "development") {
              console.log(`[ATTENDANCE ✓] Using cached data for: ${opportunityId}/${stage}`);
            }
            return Array.isArray(cached.data) ? cached.data : [];
          }

          // Fetch fresh data
          const response = await api.get(`/attendance/${opportunityId}/${stage}`, {
            signal: controller?.signal
          });
          const data = extractApiData(response);

          // Defensive: validate response is an array
          const attendanceData = Array.isArray(data) ? data : [];

          dispatch({
            type: "SET_ATTENDANCE",
            opportunityId,
            stage,
            data: attendanceData,
          });

          return attendanceData;
        });

        return result || [];
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("[ATTENDANCE ERROR] Fetch failed:", error.message);
        }
        return [];
      }
    },
    [state.attendance]
  );

  /**
   * Update opportunity applied status
   */
  const updateOpportunityApplied = useCallback((id, hasApplied = true) => {
    dispatch({
      type: "UPDATE_OPPORTUNITY",
      id,
      updates: { hasApplied },
    });
  }, []);

  /**
   * Memoize context value to prevent unnecessary re-renders
   */
  const value = useMemo(
    () => ({
      opportunities: state.opportunities,
      timelines: state.timelines,
      attendance: state.attendance,
      applicantCounts: state.applicantCounts,
      loading: state.loading,
      fetchOpportunities,
      fetchTimeline,
      fetchAttendance,
      updateOpportunityApplied,
      invalidateTimelineCache: (opportunityId) => {
        if (process.env.NODE_ENV === "development") {
          console.log("[OPPORTUNITIES] Invalidating timeline cache:", opportunityId);
        }
        dispatch({ type: "INVALIDATE_TIMELINE_CACHE", opportunityId });
        deduplicator.clear(`timeline_${opportunityId}`);
      },
      refetch: () => {
        if (process.env.NODE_ENV === "development") {
          console.log("[OPPORTUNITIES] Manual refetch triggered");
        }
        dispatch({ type: "INVALIDATE_CACHE" });
        deduplicator.clear("opportunities_fetch");
        return fetchOpportunities(true);
      },
    }),
    [
      state.opportunities,
      state.timelines,
      state.attendance,
      state.applicantCounts,
      state.loading,
      fetchOpportunities,
      fetchTimeline,
      fetchAttendance,
      updateOpportunityApplied,
    ]
  );

  return (
    <OpportunitiesContext.Provider value={value}>
      {children}
    </OpportunitiesContext.Provider>
  );
};

/**
 * Custom hook to use opportunities context
 * Throws error if used outside provider
 */
export const useOpportunities = () => {
  const context = useContext(OpportunitiesContext);
  if (!context) {
    throw new Error("useOpportunities must be used within OpportunitiesProvider");
  }
  return context;
};
