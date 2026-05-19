import { useState, useEffect, useRef, useMemo } from "react";
import api from "../api";
import { useOpportunities } from "../context/OpportunitiesContext";
import { getSocket } from "../utils/socket";
import { AlertCircle, CheckCircle, MessageSquare, User, Clock } from "lucide-react";
import { Spinner, StatusMessage } from "./ui";
import {
  dedupeTimelineEntries,
  filterTimelineForRole,
  isRoundSelectionComment,
} from "../utils/timelineHelpers";
import {
  canStudentSeeTimelineEntry,
  filterActiveStagesForStudent,
} from "../utils/studentProgression";
import { getTimelineEntryBadgeLabel } from "../utils/timelineHelpers";

const stageColors = {
  "General Update": "bg-[#FFE5E5] text-[#B70D23] border-[#D9394A]",
  "Aptitude Test": "bg-[#FFE5E5] text-[#B70D23] border-[#D9394A]",
  "Group Discussion": "bg-[#FFE5E5] text-[#B70D23] border-[#D9394A]",
  "Technical Interview": "bg-[#FFE5E5] text-[#B70D23] border-[#D9394A]",
  "HR Interview": "bg-[#FFE5E5] text-[#B70D23] border-[#D9394A]",
  Result: "bg-[#FFE5E5] text-[#B70D23] border-[#D9394A]",
};

const stageOrder = [
  "Aptitude Test",
  "Group Discussion",
  "Technical Interview",
  "HR Interview",
  "Result",
];  // Note: "General Update" removed - congratulations now appear as normal timeline entries

  const OpportunityTimeline = ({
  opportunityId,
  opportunity = null,
  userRole,
  currentStudentId = null,
  activeStages,
  stageManualSelections = [],
  applications = [],
}) => {
  const { fetchTimeline, invalidateTimelineCache } = useOpportunities();
  const [timelineEntries, setTimelineEntries] = useState([]);
  const [localActiveStages, setLocalActiveStages] = useState(activeStages || []);
  const [newComment, setNewComment] = useState("");
  const [selectedStage, setSelectedStage] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activateStage, setActivateStage] = useState(false);
  const [studentAttendance, setStudentAttendance] = useState([]);
  const socket = getSocket();
  const lastFetchRef = useRef(0);
  const isFacultyOrAdmin = userRole === "faculty" || userRole === "admin";
  const isStudent = userRole === "student";

  const progressionOpportunity = useMemo(
    () =>
      opportunity || {
        _id: opportunityId,
        applications: applications || [],
        stageManualSelections: stageManualSelections || [],
      },
    [opportunity, opportunityId, applications, stageManualSelections]
  );

  // FIX ISSUE 3: Extract selected students from stageManualSelections for Result stage
  // Get students selected in HR Interview (previous stage to Result)
  const hrSelectedStudents = stageManualSelections?.find((s) => s.stage === "HR Interview")?.selectedStudentIds || [];

  useEffect(() => {
    if (activeStages && activeStages.length > 0) {
      setLocalActiveStages(activeStages);
    }
  }, [activeStages]);


  useEffect(() => {
    const isValidId = /^[0-9a-fA-F]{24}$/.test(opportunityId);
    if (!isValidId) {
      setError('Invalid opportunity - cannot load timeline');
      setIsLoading(false);
      return;
    }

    const now = Date.now();
    const CACHE_DURATION = 30000; // 30s
    if (now - lastFetchRef.current < CACHE_DURATION) {
      setIsLoading(false);
      return;
    }

    const doFetch = async () => {
      try {
        setIsLoading(true);
        const fetchStartTime = Date.now();

        console.log("[TIMELINE FETCH] Starting fetch", {
          opportunityId,
          userRole,
          timestamp: new Date().toISOString(),
        });

        const result = await fetchTimeline(opportunityId);

        console.log('[TIMELINE FETCH] Data received', {
          duration: Date.now() - fetchStartTime,
          timelineCount: Array.isArray(result?.timeline) ? result.timeline.length : 0,
          activeStagesCount: Array.isArray(result?.activeStages) ? result.activeStages.length : 0,
        });

        const attendance = Array.isArray(result?.studentAttendance)
          ? result.studentAttendance
          : [];
        const timeline = dedupeTimelineEntries(
          filterTimelineForRole(
            Array.isArray(result?.timeline) ? result.timeline : [],
            userRole,
            currentStudentId,
            progressionOpportunity,
            attendance
          )
        );
        const stages = Array.isArray(result?.activeStages) ? result.activeStages : [];

        console.log('[TIMELINE FETCH] After filtering/deduping', {
          finalCount: timeline.length,
          stagesCount: stages.length,
        });

        setTimelineEntries(timeline);
        setLocalActiveStages(stages);
        if (isStudent) {
          setStudentAttendance(attendance);
        }
        lastFetchRef.current = now;
      } catch (err) {
        setError(err.response?.data?.message || "Failed to fetch timeline");
        console.error('Timeline fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    doFetch();
  }, [opportunityId, fetchTimeline, userRole, currentStudentId, progressionOpportunity, isStudent]);

//   useEffect(() => {
//     if (!socket) return; // Guard against null socket

//     const handleTimelineEntry = ({ entry, activeStages: newActiveStages }) => {
//       console.log('[Timeline Socket] New entry received:', entry, 'activeStages:', newActiveStages);
//       // setTimelineEntries((prev) => {
//       //   const updated = [...(Array.isArray(prev) ? prev : []), entry];
//       //   return updated;
//       // });
//       setTimelineEntries((prev) => {
//    const exists = prev.some(
//       (item) => item._id === entry._id
//    );

//    if (exists) {
//       return prev;
//    }

//    return [...prev, entry];
// });
//       if (Array.isArray(newActiveStages) && newActiveStages.length > 0) {
//         setLocalActiveStages(newActiveStages);
//         invalidateTimelineCache(opportunityId);
//       }
//     };

//     socket.on("timeline:new_entry", handleTimelineEntry);

//     return () => {
//       socket.off("timeline:new_entry", handleTimelineEntry);
//     };
//   }, [socket, opportunityId, invalidateTimelineCache]);


useEffect(() => {
  if (!socket) return;

  const handleTimelineEntry = ({ entry, activeStages: newActiveStages }) => {
    if (!entry) return;

    console.log("[TIMELINE SOCKET RECEIVED] New entry event received", {
      entryId: entry._id,
      stage: entry.stage,
      studentId: entry.studentId || null,
      timestamp: new Date().toISOString(),
    });

    if (isFacultyOrAdmin && isRoundSelectionComment(entry.comment)) {
      console.log("[TIMELINE SOCKET] Filtering out round selection comment for faculty/admin");
      return;
    }

    if (isStudent && currentStudentId) {
      if (
        !canStudentSeeTimelineEntry(
          entry,
          progressionOpportunity,
          currentStudentId,
          studentAttendance
        )
      ) {
        console.log("[TIMELINE SOCKET] Filtering entry - not visible to this student");
        return;
      }
    }

    setTimelineEntries((prev) => {
      // Check if entry already exists to prevent duplicates
      const alreadyExists = prev.some(e => e._id === entry._id);
      if (alreadyExists) {
        console.warn("[TIMELINE SOCKET DUPLICATE] Entry already in state, skipping", {
          entryId: entry._id,
          stage: entry.stage,
        });
        return prev;
      }

      console.log("[TIMELINE SOCKET] Adding entry to state", {
        entryId: entry._id,
        stage: entry.stage,
        previousCount: prev.length,
        newCount: prev.length + 1,
      });

      const merged = dedupeTimelineEntries(
        filterTimelineForRole(
          [...prev, entry],
          userRole,
          currentStudentId,
          progressionOpportunity,
          studentAttendance
        )
      );

      console.log("[TIMELINE SOCKET] Dedupe complete", {
        entryId: entry._id,
        finalCount: merged.length,
      });

      return merged;
    });

    if (Array.isArray(newActiveStages)) {
      const stagesForViewer =
        isStudent && currentStudentId
          ? filterActiveStagesForStudent(
              newActiveStages,
              progressionOpportunity,
              currentStudentId,
              studentAttendance
            )
          : newActiveStages;
      setLocalActiveStages(stagesForViewer);
    }
  };

  // Remove old listeners before adding new one
  socket.off("timeline:new_entry");

  socket.on("timeline:new_entry", handleTimelineEntry);

  return () => {
    socket.off("timeline:new_entry", handleTimelineEntry);
  };

}, [
  socket,
  userRole,
  currentStudentId,
  isFacultyOrAdmin,
  isStudent,
  progressionOpportunity,
  studentAttendance,
]);

  const handlePostUpdate = async () => {
    // FIX: Add submission guard to prevent double-submit
    if (isPosting) {
      console.warn("[TIMELINE] Submission already in progress, ignoring duplicate submit");
      return;
    }

    if (!newComment.trim() || !selectedStage) {
      setError("Please fill in all required fields");
      return;
    }

    setIsPosting(true);
    setError("");

    const submitStartTime = Date.now();

    try {
      // Build post body with stage and comment
      const postBody = {
        stage: selectedStage,
        comment: newComment,
        activateStage: activateStage && selectedStage !== "Result",
      };

      // For Result stage, automatically apply to all HR-selected students
      if (selectedStage === "Result" && hrSelectedStudents.length > 0) {
        postBody.studentIds = hrSelectedStudents;
      }

      console.log("[TIMELINE POST] Submitting timeline entry", {
        stage: selectedStage,
        opportunityId,
        studentIds: postBody.studentIds || [],
        timestamp: new Date().toISOString(),
      });

      const response = await api.post(`/timeline/${opportunityId}`, postBody);

      console.log("[TIMELINE POST] Success - entries created", {
        entryCount: Array.isArray(response.data?.data) ? response.data.data.length : 1,
        duration: Date.now() - submitStartTime,
        message: response.data?.message,
      });

      // Update active stages for visual feedback
      // For Result stage, always add it when posting (even without activateStage flag)
      // For other stages, only add if activateStage is true
      if (selectedStage === "Result" || activateStage) {
        setLocalActiveStages((prev) => {
          const updated = Array.isArray(prev) ? [...prev] : [];
          if (!updated.includes(selectedStage)) {
            updated.push(selectedStage);
          }
          return updated;
        });
      }

      // FIX: DO NOT refetch here - Socket.IO is the single source of truth
      // The socket listener will automatically update the timeline with new entries
      // Calling fetchTimeline here causes duplicate entries to be added
      console.log("[TIMELINE POST] Waiting for socket events to update timeline (no manual refetch)");

      setNewComment("");
      setSelectedStage("");
      setActivateStage(false);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || "Failed to post update";
      setError(errorMessage);
      console.error("[POST TIMELINE ERROR]", {
        error: err.message,
        status: err.response?.status,
        code: err.response?.data?.code,
        duration: Date.now() - submitStartTime,
      });
    } finally {
      setIsPosting(false);
    }
  };

  const getFilteredTimelineEntries = () =>
    dedupeTimelineEntries(
      filterTimelineForRole(
        timelineEntries,
        userRole,
        currentStudentId,
        progressionOpportunity,
        studentAttendance
      )
    );

  /**
   * ISSUE 2 FIX: Check if Result stage already has a comment/result
   * Result stage only allows ONE final comment per opportunity
   * Once a result is posted, no further comments are allowed
   */
  const hasResultStageComment = () => {
    if (!Array.isArray(timelineEntries)) return false;
    // Check if ANY Result stage entry exists for this opportunity
    return timelineEntries.some((entry) => entry.stage === "Result");
  };

  const resultStageCommentExists = hasResultStageComment();
  const isResultStageSelected = selectedStage === "Result";
  const canPostComment = !isResultStageSelected || !resultStageCommentExists;

  const filteredEntries = getFilteredTimelineEntries();

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle size={18} className="mt-0.5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Selection Process</h3>
        <div className="flex items-center gap-2">
          {stageOrder.map((stage, idx) => (
            <div key={stage} className="flex items-center flex-1">
              <div
                className={`h-3 flex-1 rounded-full transition-colors ${
                  localActiveStages.includes(stage) ? "bg-red-600" : "bg-slate-200"
                }`}
              />
              {idx < stageOrder.length - 1 && (
                <div className="w-1 h-1 bg-slate-300 mx-1" />
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-600">
          {stageOrder.map((stage) => (
            <div key={stage} className="text-center">
              {localActiveStages.includes(stage) ? (
                <CheckCircle size={14} className="text-indigo-600 mx-auto mb-1" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border border-slate-300 mx-auto mb-1" />
              )}
            </div>
          ))}
        </div>
      </div>

      {isFacultyOrAdmin && (
        <div className="rounded-lg border border-[#B70D23]/20 bg-gradient-to-br from-[#FFE5E5] to-[#FFE5E5]/50 p-5">
          <h3 className="text-sm font-semibold text-[#B70D23] mb-4">Post Update</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#B70D23] mb-1.5">
                Stage
              </label>
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className="w-full rounded-lg border border-[#B70D23] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B70D23]"
              >
                <option value="">Select a stage...</option>
                {[
                  "General Update",
                  "Aptitude Test",
                  "Group Discussion",
                  "Technical Interview",
                  "HR Interview",
                  "Result",
                ].map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </div>



            <div>
              <label className="block text-xs font-medium text-[#B70D23] mb-1.5">
                Comment
              </label>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add your update here..."
                rows="3"
                disabled={!canPostComment}
                className="w-full rounded-lg border border-[#B70D23] bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#B70D23] disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
              />
              {isResultStageSelected && resultStageCommentExists && (
                <p className="mt-2 text-xs text-amber-600 font-medium">
                  ⚠️ Result stage already has a final comment. Only one result comment is allowed per opportunity.
                </p>
              )}
            </div>

            {/* {selectedStage && selectedStage !== "Result" && ( */}
            {selectedStage &&
                    selectedStage !== "Result" &&
                       selectedStage !== "General Update" && (
              <div className="flex items-center gap-2 rounded-lg bg-white/50 p-3 border border-[#B70D23]/20">
                <input
                  type="checkbox"
                  id="activateStage"
                  checked={activateStage}
                  onChange={(e) => setActivateStage(e.target.checked)}
                  className="rounded border-[#B70D23] text-[#B70D23] focus:ring-[#B70D23]"
                />
                <label htmlFor="activateStage" className="text-xs font-medium text-[#B70D23] cursor-pointer">
                  Enable this stage in Attendance
                </label>
              </div>
            )}

            <button
              onClick={handlePostUpdate}
              disabled={isPosting || !canPostComment}
              className="w-full rounded-lg bg-[#B70D23] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#8B0A1A] disabled:bg-[#D9394A] disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPosting ? (
                <>
                  <Spinner size="sm" /> Posting...
                </>
              ) : !canPostComment ? (
                "Result comment already posted"
              ) : (
                "Post Update"
              )}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Activity Feed</h3>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : !Array.isArray(filteredEntries) || filteredEntries.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
            <MessageSquare size={20} className="mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-600">
              {Array.isArray(filteredEntries) ? 'No updates yet' : 'Invalid timeline data'}
            </p>
          </div>
        ) : (
          [...filteredEntries].reverse().map((entry) => {
            const badgeLabel = getTimelineEntryBadgeLabel(entry);
            return (
            <div key={entry._id} className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow">
              {entry.isStageActivation && (
                <div className="mb-3 flex items-center gap-2 rounded-lg bg-green-50 p-2 border border-green-200">
                  <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                  <span className="text-xs font-medium text-green-800">
                    ✅ {entry.stage} has been activated
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold border ${
                        stageColors[badgeLabel] || "bg-[#FFE5E5] text-[#B70D23] border-[#D9394A]"
                      }`}
                    >
                      {badgeLabel}
                    </span>
                    <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded">
                      {entry.role === "faculty" ? "Faculty" : "Admin"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <User size={12} />
                    <span className="font-medium">{entry.postedBy?.name}</span>
                    <Clock size={12} className="ml-1.5" />
                    {new Date(entry.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}, {new Date(entry.createdAt).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>

              <p className="text-sm text-slate-700 leading-relaxed">{entry.comment}</p>
            </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default OpportunityTimeline;
