import { useState, useEffect, useCallback } from "react";
import api from "../api";
import { useOpportunities } from "../context/OpportunitiesContext";
import { useAuth } from "../context/AuthContext";
import { getSocket } from "../utils/socket";
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Send,
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
  const { fetchAttendance: fetchAttendanceFromContext } = useOpportunities();
  const { user } = useAuth();
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

  // ======================================
  // HELPER: Check if stage is General Update
  // ======================================
  const isGeneralUpdate = selectedStage?.toLowerCase() === "general update";

  // ======================================
  // HELPER: Check if user can download attendance
  // ======================================
  const canDownloadAttendance =
    !isGeneralUpdate &&
    stageStatus?.isSubmitted === true &&
    ["admin", "faculty"].includes(user?.role);

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
        // Call API directly to get stage status
        const response = await api.get(`/attendance/${opportunityId}/${selectedStage}`);
        setAttendanceList(response.data?.data || []);
        setStageStatus(response.data?.stageStatus || {});
        setError("");
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

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleAttendanceUpdate = ({ studentId, stage, status, markedBy, markedAt }) => {
      if (stage === selectedStage) {
        setAttendanceList((prev) =>
          prev.map((item) =>
            String(item.studentId.studentId) === String(studentId)
              ? { ...item, status, markedBy: { name: markedBy }, markedAt }
              : item
          )
        );
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
      }
    };

    socket.on("attendance:update", handleAttendanceUpdate);
    socket.on("attendance:submitted", handleAttendanceSubmitted);

    return () => {
      socket.off("attendance:update", handleAttendanceUpdate);
      socket.off("attendance:submitted", handleAttendanceSubmitted);
    };
  }, [selectedStage, socket]);

  // Handle marking attendance
  const handleMarkAttendance = useCallback(
    async (studentId, status) => {
      if (isStageSubmitted) {
        setError("Cannot modify attendance - this stage has been submitted");
        return;
      }

      const key = `${studentId}:${selectedStage}`;
      setOptimisticUpdates((prev) => ({ ...prev, [key]: status }));
      setError("");

      try {
        await api.patch(`/attendance/${opportunityId}`, {
          studentId,
          stage: selectedStage,
          status,
        });
      } catch (err) {
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
      setStageStatus(response.data?.data);
      // Clear optimistic updates
      setOptimisticUpdates({});
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
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Select Stage</h3>
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

      {/* Fixed Footer with Action Buttons */}
      {selectedStage && !isReadOnly && !isGeneralUpdate && attendanceList.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg p-4 flex gap-3 justify-end">
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
