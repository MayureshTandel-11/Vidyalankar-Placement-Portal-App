import { useState, useEffect } from "react";
import api from "../api";
import { extractApiError } from "../utils/apiClient";
import { useAuth } from "../context/AuthContext";
import { TrendingUp, Target, CheckCircle, AlertCircle } from "lucide-react";
import { Spinner } from "./ui";

/**
 * StudentAnalytics Component
 * Shows student's placement progress and analytics
 * Faculty can view analytics for students in their department
 * Admin can view analytics for all students
 */
const StudentAnalytics = ({ studentId }) => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [opportunityDetails, setOpportunityDetails] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    // Guard: only fetch if studentId is valid
    if (!studentId || studentId === "null" || studentId === "undefined") {
      console.warn("[ANALYTICS] Invalid studentId:", studentId);
      setError("Invalid student selected. Please select a valid student.");
      setIsLoading(false);
      return;
    }

    fetchAnalytics();
  }, [studentId]);

  const fetchAnalytics = async () => {
    // Guard: validate studentId before API call
    if (!studentId || studentId === "null" || studentId === "undefined") {
      console.warn("[ANALYTICS] fetchAnalytics called with invalid studentId:", studentId);
      setError("Invalid student ID");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await api.get(`/student/analytics/${studentId}`);
      setAnalytics(response.data?.data);
    } catch (err) {
      const message = extractApiError(err, "Failed to fetch analytics");
      setError(message);
      console.error("[FETCH ANALYTICS ERROR]", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOpportunityDetails = async (opportunityId) => {
    // Guard: validate IDs before API call
    if (!opportunityId || opportunityId === "null") {
      console.warn("[ANALYTICS] Invalid opportunityId:", opportunityId);
      setError("Invalid opportunity selected");
      return;
    }

    if (!studentId || studentId === "null") {
      console.warn("[ANALYTICS] Invalid studentId in fetchOpportunityDetails:", studentId);
      setError("Invalid student ID");
      return;
    }

    try {
      const response = await api.get(`/student/analytics/opportunity/${opportunityId}/${studentId}`);
      setOpportunityDetails(response.data?.data);
      setShowDetailsModal(true);
    } catch (err) {
      setError(extractApiError(err, "Failed to fetch opportunity details"));
      console.error("[FETCH OPPORTUNITY DETAILS ERROR]", err);
    }
  };

  const getStageColor = (status) => {
    switch (status) {
      case "present":
        return "bg-green-100 text-green-800 border-green-300";
      case "absent":
        return "bg-red-100 text-red-800 border-red-300";
      case "not-attended":
        return "bg-gray-100 text-gray-800 border-gray-300";
      case "not-eligible":
        return "bg-orange-100 text-orange-800 border-orange-300";
      default:
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
    }
  };

  const getStageStatusLabel = (status) => {
    switch (status) {
      case "present":
        return "✓ Cleared";
      case "absent":
        return "✗ Rejected";
      case "not-attended":
        return "Not Attempted";
      case "not-eligible":
        return "Not Selected";
      default:
        return "Pending";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner /> <span className="ml-2 text-slate-600">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (!analytics) {
    return <div className="text-center text-slate-600 py-8">No analytics data available</div>;
  }

  const { student, statistics, opportunities } = analytics;

  return (
    <div className="space-y-6">
      {/* Student Info Card */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 p-6 shadow-sm hover:shadow-md transition">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">{student.name}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Email</p>
            <p className="text-slate-900 font-medium break-words">{student.email}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">PRN</p>
            <p className="text-slate-900 font-medium">{student.studentId}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Department</p>
            <p className="text-slate-900 font-medium">{student.department}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Year</p>
            <p className="text-slate-900 font-medium">{student.year || "N/A"}</p>
          </div>
        </div>
      </div>

      {/* Key Statistics Cards */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full"></span>
          Key Statistics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 p-6 hover:shadow-lg transition transform hover:scale-105">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-blue-200 rounded-lg">
                <Target size={20} className="text-blue-700" />
              </div>
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Opportunities Applied</p>
            </div>
            <p className="text-3xl font-bold text-blue-900">{statistics.totalApplied}</p>
            <p className="text-xs text-blue-700 mt-2 font-medium">Active placements</p>
          </div>

          <div className="rounded-xl bg-gradient-to-br from-green-50 to-green-100 border border-green-200 p-6 hover:shadow-lg transition transform hover:scale-105">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-green-200 rounded-lg">
                <CheckCircle size={20} className="text-green-700" />
              </div>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Aptitude Cleared</p>
            </div>
            <p className="text-3xl font-bold text-green-900">{statistics.totalClearedAptitude}</p>
            <p className="text-xs text-green-700 mt-2 font-medium">Tests passed</p>
          </div>

          <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 p-6 hover:shadow-lg transition transform hover:scale-105">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-indigo-200 rounded-lg">
                <TrendingUp size={20} className="text-indigo-700" />
              </div>
              <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Max Stage Reached</p>
            </div>
            <p className="text-3xl font-bold text-indigo-900">{statistics.totalClearedHR > 0 ? "HR Interview" : statistics.totalClearedTechnical > 0 ? "Technical" : "Aptitude"}</p>
            <p className="text-xs text-indigo-700 mt-2 font-medium">Highest achievement</p>
          </div>
        </div>
      </div>

      {/* Stage Breakdown */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full"></span>
          Stage-wise Breakdown
        </h3>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 rounded-lg bg-gradient-to-b from-blue-50 to-white border border-blue-200 hover:shadow-md transition">
              <p className="text-xs text-slate-700 font-semibold uppercase tracking-wide mb-2">Aptitude</p>
              <p className="text-3xl font-bold text-blue-600">{statistics.totalClearedAptitude}</p>
              <div className="mt-2 w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{width: `${Math.min(100, (statistics.totalClearedAptitude / Math.max(1, statistics.totalApplied)) * 100)}%`}}></div>
              </div>
            </div>
            <div className="text-center p-4 rounded-lg bg-gradient-to-b from-purple-50 to-white border border-purple-200 hover:shadow-md transition">
              <p className="text-xs text-slate-700 font-semibold uppercase tracking-wide mb-2">Group Discussion</p>
              <p className="text-3xl font-bold text-purple-600">{statistics.totalClearedGD}</p>
              <div className="mt-2 w-full h-1.5 bg-purple-100 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500" style={{width: `${Math.min(100, (statistics.totalClearedGD / Math.max(1, statistics.totalApplied)) * 100)}%`}}></div>
              </div>
            </div>
            <div className="text-center p-4 rounded-lg bg-gradient-to-b from-cyan-50 to-white border border-cyan-200 hover:shadow-md transition">
              <p className="text-xs text-slate-700 font-semibold uppercase tracking-wide mb-2">Technical</p>
              <p className="text-3xl font-bold text-cyan-600">{statistics.totalClearedTechnical}</p>
              <div className="mt-2 w-full h-1.5 bg-cyan-100 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500" style={{width: `${Math.min(100, (statistics.totalClearedTechnical / Math.max(1, statistics.totalApplied)) * 100)}%`}}></div>
              </div>
            </div>
            <div className="text-center p-4 rounded-lg bg-gradient-to-b from-emerald-50 to-white border border-emerald-200 hover:shadow-md transition">
              <p className="text-xs text-slate-700 font-semibold uppercase tracking-wide mb-2">HR</p>
              <p className="text-3xl font-bold text-emerald-600">{statistics.totalClearedHR}</p>
              <div className="mt-2 w-full h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{width: `${Math.min(100, (statistics.totalClearedHR / Math.max(1, statistics.totalApplied)) * 100)}%`}}></div>
              </div>
            </div>
            <div className="text-center p-4 rounded-lg bg-gradient-to-b from-red-50 to-white border border-red-200 hover:shadow-md transition">
              <p className="text-xs text-slate-700 font-semibold uppercase tracking-wide mb-2">Rejected</p>
              <p className="text-3xl font-bold text-red-600">{statistics.totalRejected}</p>
              <div className="mt-2 w-full h-1.5 bg-red-100 rounded-full overflow-hidden">
                <div className="h-full bg-red-500" style={{width: `${Math.min(100, (statistics.totalRejected / Math.max(1, statistics.totalApplied)) * 100)}%`}}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Opportunities List */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-full"></span>
          Applied Opportunities <span className="ml-auto text-xs font-normal bg-slate-100 text-slate-700 px-3 py-1 rounded-full">{opportunities.length} total</span>
        </h3>
        {opportunities.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="text-slate-600 font-medium">No opportunities found yet</p>
            <p className="text-slate-500 text-sm mt-1">Start applying to placement opportunities</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {opportunities.map((opp, idx) => (
              <div
                key={opp.opportunityId}
                className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-lg transition cursor-pointer hover:border-slate-300 group"
                onClick={() => {
                  setSelectedOpportunity(opp);
                  fetchOpportunityDetails(opp.opportunityId);
                }}
              >
                <div className="mb-3 flex items-start gap-3">
                  <div className="mt-0.5 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition">
                    <span className="text-xs font-bold text-slate-600 group-hover:text-blue-600">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-900 group-hover:text-blue-600 transition">{opp.title}</h4>
                    <p className="text-xs text-slate-600 mt-1">
                      <span className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded mr-2 font-medium">{opp.type}</span>
                      <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">{opp.department}</span>
                      <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded ml-2 font-medium capitalize">{opp.status}</span>
                    </p>
                  </div>
                </div>

                {/* Stages Progress */}
                <div className="flex flex-wrap gap-2">
                  {["Aptitude Test", "Group Discussion", "Technical Interview", "HR Interview"].map(
                    (stage) => (
                      <div
                        key={stage}
                        className={`px-2.5 py-1.5 rounded-full text-xs font-semibold border transition ${getStageColor(
                          opp.stageProgress[stage]
                        )}`}
                      >
                        {stage.split(" ").pop()}: {getStageStatusLabel(opp.stageProgress[stage])}
                      </div>
                    )
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-900">Highest Stage:</span> <span className="text-blue-600 font-medium">{opp.highestStageCleared}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentAnalytics;
