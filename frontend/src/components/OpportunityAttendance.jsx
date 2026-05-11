import { useState, useEffect, useCallback } from "react";
import api from "../api";
import { getSocket } from "../utils/socket";
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Send,
  Users,
} from "lucide-react";
import { Spinner, StatusMessage } from "./ui";
import SearchableStudentSelect from "./SearchableStudentSelect";

const RECRUITMENT_STAGES = [
  "Aptitude Test",
  "Group Discussion",
  "Technical Interview",
  "HR Interview",
  "Result",
];

const OpportunityAttendance = ({ opportunityId, activeStages }) => {
  const [selectedStage, setSelectedStage] = useState(null);
  const [attendanceList, setAttendanceList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [optimisticUpdates, setOptimisticUpdates] = useState({});
  const socket = getSocket();

  // New state for submission and download features
  const [stageStatus, setStageStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // New state for next round selection
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [isSelectingNextRound, setIsSelectingNextRound] = useState(false);
  const [showSelectionConfirm, setShowSelectionConfirm] = useState(false);

  // Manual Selection Mode states
  const [viewMode, setViewMode] = useState("attendance"); // "attendance" or "manual-select"
  const [manualSelectedIds, setManualSelectedIds] = useState([]);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualSelectionsLoaded, setManualSelectionsLoaded] = useState(false);

  // ======================================
  // HELPER: Check if stage is General Update
  // ======================================
  const isGeneralUpdate = selectedStage?.toLowerCase() === "general update";

  // Determine the current stage (most recently activated)
  const getCurrentStage = () => {
    if (!activeStages || activeStages.length === 0) return null;
    // Find the last stage in RECRUITMENT_STAGES order that's in activeStages
    // Skip "General Update" as it's not a recruitment stage
    for (let i = RECRUITMENT_STAGES.length - 1; i >= 0; i--) {
      if (activeStages.includes(RECRUITMENT_STAGES[i])) {
        return RECRUITMENT_STAGES[i];
      }
    }
    // If no recruitment stages found, General Update might be active
    if (activeStages.includes("General Update")) {
      return "General Update";
    }
    return null;
  };

  const currentStage = getCurrentStage();
  const isReadOnly = selectedStage && currentStage && selectedStage !== currentStage;
  const isStageSubmitted = stageStatus?.isSubmitted || false;
  const canEditAttendance = !isReadOnly && !isStageSubmitted;

  // ======================================
  // Load manual selections for a stage
  // ======================================
  const fetchManualSelections = useCallback(async (stage) => {
    try {
      const response = await api.get(
        `/attendance/manual-selections/${opportunityId}/${stage}`
      );
      const selections = response.data?.data?.selectedStudentIds || [];
      setManualSelectedIds(selections);
      setManualSelectionsLoaded(true);
    } catch (err) {
      console.error("[FETCH MANUAL SELECTIONS ERROR]", err);
      setManualSelectionsLoaded(true);
    }
  }, [opportunityId]);

  // Fetch attendance data including stage status
  useEffect(() => {
    if (!selectedStage) {
      setAttendanceList([]);
      setStageStatus(null);
      return;
    }

    // Skip attendance API calls for General Update stage
    if (isGeneralUpdate) {
      setAttendanceList([]);
      setStageStatus(null);
      return;
    }

    const isValidId = /^[0-9a-fA-F]{24}$/.test(opportunityId);
    if (!isValidId) {
      console.error("[DEBUG] Invalid opportunityId:", opportunityId);
      setError("Invalid opportunity - cannot load attendance");
      setAttendanceList([]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const fetchAttendanceData = async () => {
      try {
        setIsLoading(true);
        setError("");
        // Call API directly to get stage status
        const response = await api.get(`/attendance/${opportunityId}/${selectedStage}`);
        const newAttendanceList = response.data?.data || [];
        const newStageStatus = response.data?.stageStatus || {};

        setAttendanceList(newAttendanceList);
        setStageStatus(newStageStatus);

        // Load manual selections if stage is submitted
        if (newStageStatus?.isSubmitted) {
          fetchManualSelections(selectedStage);
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        setError(err.response?.data?.message || "Failed to fetch attendance");
        setAttendanceList([]);
        setStageStatus(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendanceData();
    return () => controller.abort();
  }, [opportunityId, selectedStage, isGeneralUpdate]);

  useEffect(() => {
    console.log('[OpportunityAttendance] Auto-select check:', {
      selectedStage,
      activeStages,
      shouldAutoSelect: !selectedStage && activeStages && activeStages.length > 0
    });

    if (!selectedStage && activeStages && activeStages.length > 0) {
      // Find first recruitment stage (exclude General Update)
      const stageToSelect = RECRUITMENT_STAGES.find(s => activeStages.includes(s));
      if (stageToSelect) {
        console.log('[OpportunityAttendance] Auto-selecting first recruitment stage:', stageToSelect);
        setSelectedStage(stageToSelect);
      }
    }
  }, [activeStages]);

  // Refetch attendance data when a new stage is enabled
  useEffect(() => {
    if (selectedStage && activeStages && activeStages.includes(selectedStage)) {
      // Stage exists in activeStages, data should load properly
      console.log('[OpportunityAttendance] Stage is now active:', selectedStage);
    }
  }, [activeStages, selectedStage]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleAttendanceUpdate = ({ studentId, stage, status, markedBy, markedAt }) => {
      if (stage === selectedStage) {
        // Update local attendance list
        setAttendanceList((prev) =>
          prev.map((item) =>
            String(item.studentId.studentId) === String(studentId) || String(item.studentId._id) === String(studentId)
              ? {
                  ...item,
                  status,
                  markedBy: markedBy ? { name: markedBy } : item.markedBy,
                  markedAt: markedAt || item.markedAt,
                }
              : item
          )
        );
        // Clear optimistic update for this student
        setOptimisticUpdates((prev) => ({
          ...prev,
          [`${studentId}:${stage}`]: null,
        }));
      }
    };

    const handleAttendanceSubmitted = ({ stage, submittedBy, submittedAt, totalRecords, presentCount, absentCount }) => {
      if (stage === selectedStage) {
        setStageStatus({
          stage,
          isSubmitted: true,
          submittedAt,
          submittedBy,
          totalRecords,
          presentCount,
          absentCount,
        });
        // Load manual selections for this stage
        setTimeout(() => fetchManualSelections(stage), 500);
      }
    };

    const handleManualSelectionUpdate = ({ stage, selectedCount, selectedBy }) => {
      if (stage === selectedStage) {
        // Reload manual selections when updated
        fetchManualSelections(stage);
      }
    };

    socket.on("attendance:update", handleAttendanceUpdate);
    socket.on("attendance:submitted", handleAttendanceSubmitted);
    socket.on("manual:selection:updated", handleManualSelectionUpdate);

    return () => {
      socket.off("attendance:update", handleAttendanceUpdate);
      socket.off("attendance:submitted", handleAttendanceSubmitted);
      socket.off("manual:selection:updated", handleManualSelectionUpdate);
    };
  }, [selectedStage, socket]);

  // Save manual selections
  const handleSaveManualSelections = async () => {
    // Validate selections exist
    if (!manualSelectedIds || manualSelectedIds.length === 0) {
      setError("Please select at least one student");
      return;
    }

    // Validate stage is selected
    if (!selectedStage || selectedStage === "null") {
      setError("Invalid stage selected");
      return;
    }

    setIsSavingManual(true);
    setError("");

    try {
      if (process.env.NODE_ENV === "development") {
        console.log("[OPPORTUNITY ATTENDANCE] Saving manual selections:", {
          opportunityId,
          stage: selectedStage,
          selectedCount: manualSelectedIds.length
        });
      }

      const response = await api.post(
        `/attendance/manual-select/${opportunityId}/${selectedStage}`,
        { selectedStudentIds: manualSelectedIds }
      );

      // Defensive: validate response
      if (!response?.data) {
        throw new Error("Empty response from server");
      }

      if (process.env.NODE_ENV === "development") {
        console.log("[OPPORTUNITY ATTENDANCE ✓] Manual selections saved successfully");
      }

      // Show success message
      const successMsg = `✓ Successfully saved ${manualSelectedIds.length} selected student(s) for next round`;
      console.log(successMsg);
      setError(""); // Clear any previous errors

      // Emit socket event for real-time updates
      const socket = getSocket();
      if (socket) {
        socket.emit("manual:selection:saved", {
          opportunityId,
          stage: selectedStage,
          selectedCount: manualSelectedIds.length,
        });
      }
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Failed to save manual selections. Please try again.";

      setError(errorMessage);
      console.error("[OPPORTUNITY ATTENDANCE] Manual selection save error:", {
        opportunityId,
        stage: selectedStage,
        selectedCount: manualSelectedIds.length,
        errorMessage,
        status: err.response?.status,
        url: err.config?.url
      });
    } finally {
      setIsSavingManual(false);
    }
  };

  // Handle marking attendance
  const handleMarkAttendance = useCallback(
    async (studentId, status) => {
      if (isStageSubmitted) {
        setError("Cannot modify attendance - this stage has been submitted");
        return;
      }

      const key = `${studentId}:${selectedStage}`;

      // Immediately update local state (optimistic update)
      setAttendanceList((prev) =>
        prev.map((item) =>
          String(item.studentId.studentId) === String(studentId)
            ? { ...item, status }
            : item
        )
      );

      setOptimisticUpdates((prev) => ({ ...prev, [key]: status }));
      setError("");

      try {
        await api.patch(`/attendance/${opportunityId}`, {
          studentId,
          stage: selectedStage,
          status,
        });

        // Success - keep the update
        setOptimisticUpdates((prev) => ({ ...prev, [key]: null }));
      } catch (err) {
        // Revert on error
        setAttendanceList((prev) =>
          prev.map((item) =>
            String(item.studentId.studentId) === String(studentId)
              ? { ...item, status: item.status } // Keep original
              : item
          )
        );
        setOptimisticUpdates((prev) => ({ ...prev, [key]: null }));

        const errorMessage = err.response?.data?.message || err.message || "Failed to mark attendance";
        setError(errorMessage);
        console.error("[MARK ATTENDANCE ERROR]", err);
      }
    },
    [opportunityId, selectedStage, isStageSubmitted]
  );

  // Handle attendance submission
  const handleSubmitAttendance = async () => {
    setShowConfirmModal(false);
    setIsSubmitting(true);
    setError("");

    try {
      const response = await api.post(`/attendance/submit/${opportunityId}/${selectedStage}`);
      const newStageStatus = response.data?.data;

      setStageStatus(newStageStatus);
      setOptimisticUpdates({});

      // Success message
      console.log(`[ATTENDANCE] Successfully submitted ${selectedStage}`);

      // Load manual selections after submission
      setTimeout(() => {
        fetchManualSelections(selectedStage);
      }, 500);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || "Failed to submit attendance";
      setError(errorMessage);
      console.error("[SUBMIT ATTENDANCE ERROR]", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle attendance download
  const handleDownloadAttendance = async () => {
    setIsDownloading(true);
    setError("");

    try {
      const response = await api.get(`/attendance/download/${opportunityId}/${selectedStage}`, {
        responseType: "blob",
      });

      // Create blob and download
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      // Generate filename from response headers or default
      const contentDisposition = response.headers["content-disposition"];
      let filename = "attendance.csv";
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) filename = filenameMatch[1];
      }

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Failed to download attendance";
      setError(errorMessage);
      console.error("[DOWNLOAD ATTENDANCE ERROR]", err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle next round student selection
  const handleSelectNextRound = async () => {
    if (selectedStudentIds.length === 0) {
      setError("Please select at least one student");
      return;
    }

    setShowSelectionConfirm(false);
    setIsSelectingNextRound(true);
    setError("");

    try {
      const response = await api.post(`/attendance/select-next-round/${opportunityId}/${selectedStage}`, {
        selectedStudentIds,
      });

      // Show success message
      setError(`✓ Successfully selected ${selectedStudentIds.length} students for next round`);
      setSelectedStudentIds([]);

      // Emit Socket.IO event
      const io = getSocket();
      if (io) {
        io.emit("selection:completed", {
          opportunityId,
          stage: selectedStage,
          count: selectedStudentIds.length,
        });
      }

      // Reset after 3 seconds
      setTimeout(() => setError(""), 3000);
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Failed to select students";
      setError(errorMessage);
      console.error("[SELECT NEXT ROUND ERROR]", err);
    } finally {
      setIsSelectingNextRound(false);
    }
  };

  const stats = {
    total: attendanceList.length,
    present: attendanceList.filter((a) => a.status === "present").length,
    absent: attendanceList.filter((a) => a.status === "absent").length,
    pending: attendanceList.filter((a) => a.status === "pending").length,
  };

  return (
    <div className="space-y-6 pb-32">
      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle size={18} className="mt-0.5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">Select Stage</h3>
          {/* View Mode Toggle - Only show after attendance submission */}
          {isStageSubmitted && !isGeneralUpdate && (
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("attendance")}
                className={`px-3 py-1 text-xs font-medium rounded transition ${
                  viewMode === "attendance"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Attendance
              </button>
              <button
                onClick={() => {
                  setViewMode("manual-select");
                  if (!manualSelectionsLoaded) {
                    fetchManualSelections(selectedStage);
                  }
                }}
                className={`px-3 py-1 text-xs font-medium rounded transition flex items-center gap-1 ${
                  viewMode === "manual-select"
                    ? "bg-purple-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Users size={14} />
                Manual Selection
              </button>
            </div>
          )}
        </div>
        {/* Stage selector with padding to accommodate badges */}
        <div className="flex gap-2 overflow-x-auto pb-2 pt-3 px-1 -mx-1">
          {/* Recruitment stages */}
          {RECRUITMENT_STAGES.map((stage) => {
            const isActive = stage === selectedStage;
            const isEnabled = activeStages.includes(stage);
            const isCurrent = stage === currentStage;
            const isPrevious = isEnabled && !isCurrent;

            return (
              <div
                key={stage}
                className="relative flex-shrink-0"
              >
                <button
                  onClick={() => isEnabled && setSelectedStage(stage)}
                  disabled={!isEnabled}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md"
                      : isEnabled
                      ? "bg-slate-100 text-slate-800 hover:bg-slate-200"
                      : "bg-slate-50 text-slate-400 cursor-not-allowed opacity-50"
                  }`}
                >
                  {stage}
                </button>
                {/* Badge positioned at top-right, fully visible above button */}
                {isPrevious && (
                  <span className="absolute -top-3 -right-3 px-2.5 py-0.5 text-xs font-bold bg-orange-500 text-white rounded-full shadow-md border border-orange-600 z-10">
                    Closed
                  </span>
                )}
              </div>
            );
          })}

          {/* General Update stage (if active) */}
          {activeStages?.includes("General Update") && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setSelectedStage("General Update")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                  selectedStage === "General Update"
                    ? "bg-slate-600 text-white shadow-md"
                    : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                }`}
              >
                General Update
              </button>
              <span className="absolute -top-3 -right-3 px-2 py-0.5 text-xs font-bold bg-slate-500 text-white rounded-full shadow-md border border-slate-600 z-10">
                Info
              </span>
            </div>
          )}
        </div>
      </div>

      {!selectedStage ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">Select a stage above to view attendance.</p>
        </div>
      ) : isGeneralUpdate ? (
        // General Update stage - no attendance tracking
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-300 mb-3">
            <AlertCircle size={24} className="text-slate-700" />
          </div>
          <p className="text-base font-medium text-slate-800 mb-2">General Update</p>
          <p className="text-sm text-slate-600">
            This stage does not support attendance tracking.
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Attendance features are only available for recruitment stages.
          </p>
        </div>
      ) : isReadOnly ? (
        <>
          {/* Read-only message for previous stages */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-amber-800">
                <strong>Previous Stage:</strong> This stage is now closed for editing. View the final attendance records below.
              </p>
              {isStageSubmitted && (
                <p className="text-xs text-amber-700 mt-1">
                  ✓ Attendance submitted on {new Date(stageStatus?.submittedAt).toLocaleDateString()} by {stageStatus?.submittedBy?.name || "Admin"}
                </p>
              )}
            </div>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : attendanceList.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-sm text-slate-600">No applicants found for this stage.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <p className="text-slate-600">Total</p>
                    <p className="text-lg font-semibold text-slate-900">{stats.total}</p>
                  </div>
                  <div>
                    <p className="text-emerald-600">Present</p>
                    <p className="text-lg font-semibold text-emerald-700">{stats.present}</p>
                  </div>
                  <div>
                    <p className="text-rose-600">Absent</p>
                    <p className="text-lg font-semibold text-rose-700">{stats.absent}</p>
                  </div>
                  <div>
                    <p className="text-amber-600">Pending</p>
                    <p className="text-lg font-semibold text-amber-700">{stats.pending}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {attendanceList.map((record) => {
                  const student = record.studentId;
                  const currentStatus = record.status;

                  const statusDisplay = {
                    present: { label: "Present", color: "bg-emerald-50 border-emerald-200" },
                    absent: { label: "Absent", color: "bg-rose-50 border-rose-200" },
                    pending: { label: "Pending", color: "bg-amber-50 border-amber-200" },
                  }[currentStatus] || { label: "Unknown", color: "bg-slate-50 border-slate-200" };

                  return (
                    <div
                      key={record._id}
                      className={`rounded-lg border ${statusDisplay.color} bg-white p-4`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm">
                          {student.name?.charAt(0)?.toUpperCase()}
                        </div>

                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-slate-900">
                            {student.name}
                          </h4>
                          <p className="text-xs text-slate-600">
                            {student.studentId} • {student.department}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {currentStatus === "present" && (
                            <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-medium border border-emerald-300">
                              <CheckCircle size={14} />
                              {statusDisplay.label}
                            </div>
                          )}
                          {currentStatus === "absent" && (
                            <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700 text-xs font-medium border border-rose-300">
                              <XCircle size={14} />
                              {statusDisplay.label}
                            </div>
                          )}
                          {currentStatus === "pending" && (
                            <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-xs font-medium border border-amber-300">
                              <Clock size={14} />
                              {statusDisplay.label}
                            </div>
                          )}
                          {record.markedAt && (
                            <p className="text-xs text-slate-500">
                              {new Date(record.markedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : attendanceList.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">No applicants found for this stage.</p>
        </div>
      ) : (
        <>
          {/* Submission status message */}
          {isStageSubmitted && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-start gap-3">
              <CheckCircle size={18} className="mt-0.5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm text-green-800">
                  <strong>✓ Attendance Submitted:</strong> Attendance for this stage has been finalized and locked.
                </p>
                <p className="text-xs text-green-700 mt-1">
                  This stage has {stats.total} records ({stats.present} Present, {stats.absent} Absent)
                </p>
              </div>
            </div>
          )}
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div>
                <p className="text-slate-600">Total</p>
                <p className="text-lg font-semibold text-slate-900">{stats.total}</p>
              </div>
              <div>
                <p className="text-emerald-600">Present</p>
                <p className="text-lg font-semibold text-emerald-700">{stats.present}</p>
              </div>
              <div>
                <p className="text-rose-600">Absent</p>
                <p className="text-lg font-semibold text-rose-700">{stats.absent}</p>
              </div>
              <div>
                <p className="text-amber-600">Pending</p>
                <p className="text-lg font-semibold text-amber-700">{stats.pending}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {attendanceList.map((record) => {
              const student = record.studentId;
              const key = `${student.studentId}:${selectedStage}`;
              const optimisticStatus = optimisticUpdates[key];
              const currentStatus = optimisticStatus || record.status;

              return (
                <div
                  key={record._id}
                  className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm">
                      {student.name?.charAt(0)?.toUpperCase()}
                    </div>

                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-slate-900">
                        {student.name}
                      </h4>
                      <p className="text-xs text-slate-600">
                        {student.studentId} • {student.department}
                      </p>
                    </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            handleMarkAttendance(student.studentId, "present")
                          }
                          disabled={!canEditAttendance}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                            currentStatus === "present"
                              ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                          } ${!canEditAttendance ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <CheckCircle size={14} className="inline mr-1" />
                          Present
                        </button>
                        <button
                          onClick={() =>
                            handleMarkAttendance(student.studentId, "absent")
                          }
                          disabled={!canEditAttendance}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                            currentStatus === "absent"
                              ? "bg-rose-100 text-rose-700 border border-rose-300"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                          } ${!canEditAttendance ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <XCircle size={14} className="inline mr-1" />
                          Absent
                        </button>
                      </div>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </>
      )}

      {/* Next Round Selection Section */}
      {selectedStage && !isReadOnly && !isGeneralUpdate && attendanceList.length > 0 && !isStageSubmitted && (
        <SearchableStudentSelect
          students={attendanceList}
          selectedIds={selectedStudentIds}
          onSelectionChange={setSelectedStudentIds}
        />
      )}

      {/* Manual Selection Section - Only show after attendance submission */}
      {selectedStage &&
        isStageSubmitted &&
        !isGeneralUpdate &&
        viewMode === "manual-select" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 flex items-start gap-3">
              <Users size={18} className="mt-0.5 text-purple-600 flex-shrink-0" />
              <div>
                <p className="text-sm text-purple-800">
                  <strong>Manual Selection Mode</strong>
                </p>
                <p className="text-xs text-purple-700 mt-1">
                  Select students who have cleared this stage. Only students marked as present are selectable.
                </p>
              </div>
            </div>

            {/* Filter to show only present students for manual selection */}
            <SearchableStudentSelect
              students={attendanceList.filter((a) => a.status === "present")}
              selectedIds={manualSelectedIds}
              onSelectionChange={setManualSelectedIds}
              placeholder="Search present students..."
            />

            {/* Summary of selected students */}
            {manualSelectedIds.length > 0 && (
              <div className="rounded-lg border border-purple-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900 mb-3">
                  Selected Students ({manualSelectedIds.length})
                </p>
                <div className="space-y-2">
                  {attendanceList
                    .filter((a) => manualSelectedIds.includes(a.studentId.studentId))
                    .map((record) => (
                      <div
                        key={record._id}
                        className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {record.studentId.name}
                          </p>
                          <p className="text-xs text-slate-600">
                            {record.studentId.studentId}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            setManualSelectedIds(
                              manualSelectedIds.filter(
                                (id) => id !== record.studentId.studentId
                              )
                            )
                          }
                          className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded transition"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

      {/* Fixed Footer with Action Buttons */}
      {selectedStage && !isReadOnly && !isGeneralUpdate && attendanceList.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg p-4 flex gap-3 justify-end">
          {/* Manual Selection Save Button */}
          {isStageSubmitted && viewMode === "manual-select" && (
            <button
              onClick={handleSaveManualSelections}
              disabled={isSavingManual || manualSelectedIds.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingManual ? (
                <>
                  <Spinner />
                  Saving...
                </>
              ) : (
                <>
                  <Users size={16} />
                  Save Selections ({manualSelectedIds.length})
                </>
              )}
            </button>
          )}

          {/* Select Next Round Button - appears before submit */}
          {!isStageSubmitted && selectedStudentIds.length > 0 && (
            <button
              onClick={() => setShowSelectionConfirm(true)}
              disabled={isSelectingNextRound}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSelectingNextRound ? (
                <>
                  <Spinner />
                  Selecting...
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  Select {selectedStudentIds.length} for Next Round
                </>
              )}
            </button>
          )}

          <button
            onClick={handleDownloadAttendance}
            disabled={isDownloading || !isStageSubmitted}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? (
              <>
                <Spinner />
                Downloading...
              </>
            ) : (
              <>
                <Download size={16} />
                Download
              </>
            )}
          </button>

          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={isSubmitting || isStageSubmitted}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Spinner />
                Submitting...
              </>
            ) : (
              <>
                <Send size={16} />
                {isStageSubmitted ? "Submitted" : "Submit Attendance"}
              </>
            )}
          </button>
        </div>
      )}

      {/* Selection Confirmation Modal */}
      {showSelectionConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Confirm Student Selection
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                You are about to select <strong>{selectedStudentIds.length} student(s)</strong> for the next round. They will receive notifications.
              </p>
              <div className="rounded-lg bg-slate-50 p-3 mb-4 text-xs text-slate-700">
                <p>
                  <strong>Next Round:</strong> This will move to the next stage in the recruitment process.
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t border-slate-200 justify-end">
              <button
                onClick={() => setShowSelectionConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSelectNextRound}
                disabled={isSelectingNextRound}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSelectingNextRound ? (
                  <>
                    <Spinner />
                    Selecting...
                  </>
                ) : (
                  "Confirm Selection"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Confirm Attendance Submission
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Are you sure you want to submit attendance for <strong>{selectedStage}</strong>? Once submitted, attendance cannot be edited unless reopened by an admin.
              </p>
              <div className="rounded-lg bg-slate-50 p-3 mb-4 text-xs text-slate-700">
                <p>
                  <strong>Summary:</strong> {stats.total} records ({stats.present} Present, {stats.absent} Absent, {stats.pending} Pending)
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t border-slate-200 justify-end">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitAttendance}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Spinner />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Submit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpportunityAttendance;
