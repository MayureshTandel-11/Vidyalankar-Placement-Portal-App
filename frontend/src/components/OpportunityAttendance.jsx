import { useState, useEffect, useCallback } from "react";
import api from "../api";
import { useOpportunities } from "../context/OpportunitiesContext";
import { getSocket } from "../utils/socket";
import { AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react";
import { Spinner, StatusMessage } from "./ui";

const STAGES = [
  "Aptitude Test",
  "Group Discussion",
  "Technical Interview",
  "HR Interview",
  "Result",
];

const OpportunityAttendance = ({ opportunityId, activeStages }) => {
  const { fetchAttendance: fetchAttendanceFromContext } = useOpportunities();
  const [selectedStage, setSelectedStage] = useState(null);
  const [attendanceList, setAttendanceList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [optimisticUpdates, setOptimisticUpdates] = useState({});
  const socket = getSocket();

  // Determine the current stage (most recently activated)
  const getCurrentStage = () => {
    if (!activeStages || activeStages.length === 0) return null;
    // Find the last stage in STAGES order that's in activeStages
    for (let i = STAGES.length - 1; i >= 0; i--) {
      if (activeStages.includes(STAGES[i])) {
        return STAGES[i];
      }
    }
    return null;
  };

  const currentStage = getCurrentStage();
  const isReadOnly = selectedStage && currentStage && selectedStage !== currentStage;

  useEffect(() => {
    if (!selectedStage) {
      setAttendanceList([]);
      return;
    }

    const isValidId = /^[0-9a-fA-F]{24}$/.test(opportunityId);
    console.log('[DEBUG] OpportunityAttendance fetch:', { opportunityId, isValidId, stage: selectedStage });
    if (!isValidId) {
      console.error('[DEBUG] Invalid opportunityId:', opportunityId);
      setError('Invalid opportunity - cannot load attendance');
      setAttendanceList([]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const fetchAttendanceData = async () => {
      try {
        setIsLoading(true);
        const data = await fetchAttendanceFromContext(opportunityId, selectedStage);
        setAttendanceList(data || []);
        setError("");
      } catch (err) {
        if (err.name === 'AbortError') return;
        setError(
          err.response?.data?.message || "Failed to fetch attendance"
        );
        setAttendanceList([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendanceData();
    return () => controller.abort();
  }, [opportunityId, selectedStage, fetchAttendanceFromContext]);

  useEffect(() => {
    console.log('[OpportunityAttendance] Auto-select check:', {
      selectedStage,
      activeStages,
      shouldAutoSelect: !selectedStage && activeStages && activeStages.length > 0
    });

    if (!selectedStage && activeStages && activeStages.length > 0) {
      console.log('[OpportunityAttendance] Auto-selecting first stage:', activeStages[0]);
      setSelectedStage(activeStages[0]);
    }
  }, [activeStages]);

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

    socket.on("attendance:update", handleAttendanceUpdate);

    return () => {
      socket.off("attendance:update", handleAttendanceUpdate);
    };
  }, [selectedStage, socket]);

  const handleMarkAttendance = useCallback(
    async (studentId, status) => {
      // Optimistic update
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
    [opportunityId, selectedStage]
  );

  const stats = {
    total: attendanceList.length,
    present: attendanceList.filter((a) => a.status === "present").length,
    absent: attendanceList.filter((a) => a.status === "absent").length,
    pending: attendanceList.filter((a) => a.status === "pending").length,
  };

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle size={18} className="mt-0.5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Select Stage</h3>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {STAGES.map((stage) => {
            const isActive = stage === selectedStage;
            const isEnabled = activeStages.includes(stage);
            const isCurrent = stage === currentStage;
            const isPrevious = isEnabled && !isCurrent;

            return (
              <div key={stage} className="relative">
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
                {isPrevious && (
                  <span className="absolute -top-2 -right-2 px-2 py-0.5 text-xs font-semibold bg-orange-500 text-white rounded-full">
                    Closed
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!selectedStage ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">Select a stage above to view attendance.</p>
        </div>
      ) : isReadOnly ? (
        <>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>Previous Stage:</strong> This stage is now closed for editing. View the final attendance records below.
            </p>
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          currentStatus === "present"
                            ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                        }`}
                      >
                        <CheckCircle size={14} className="inline mr-1" />
                        Present
                      </button>
                      <button
                        onClick={() =>
                          handleMarkAttendance(student.studentId, "absent")
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          currentStatus === "absent"
                            ? "bg-rose-100 text-rose-700 border border-rose-300"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                        }`}
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
      )}
    </div>
  );
};

export default OpportunityAttendance;
