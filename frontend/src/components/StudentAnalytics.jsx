import { useState, useEffect } from "react";
import api from "../api";
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
      const message = err.response?.data?.message || "Failed to fetch analytics";
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
      setError("Failed to fetch opportunity details");
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
      {/* Student Info */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">{student.name}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium text-slate-600">Email</p>
            <p className="text-slate-900 font-medium">{student.email}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-600">PRN</p>
            <p className="text-slate-900 font-medium">{student.studentId}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-600">Department</p>
            <p className="text-slate-900 font-medium">{student.department}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-600">Year</p>
            <p className="text-slate-900 font-medium">{student.year || "N/A"}</p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3 mb-2">
            <Target size={20} className="text-blue-600" />
            <p className="text-xs font-medium text-slate-600">Opportunities Applied</p>
          </div>
          <p className="text-3xl font-bold text-slate-900">{statistics.totalApplied}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle size={20} className="text-green-600" />
            <p className="text-xs font-medium text-slate-600">Aptitude Cleared</p>
          </div>
          <p className="text-3xl font-bold text-slate-900">{statistics.totalClearedAptitude}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp size={20} className="text-indigo-600" />
            <p className="text-xs font-medium text-slate-600">Max Stage Reached</p>
          </div>
          <p className="text-3xl font-bold text-slate-900">{statistics.totalClearedHR > 0 ? "HR Interview" : statistics.totalClearedTechnical > 0 ? "Technical" : "Aptitude"}</p>
        </div>
      </div>

      {/* Stage Breakdown */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Stage Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <p className="text-xs text-slate-600 mb-2">Aptitude</p>
            <p className="text-2xl font-bold text-blue-600">{statistics.totalClearedAptitude}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-600 mb-2">Group Discussion</p>
            <p className="text-2xl font-bold text-indigo-600">{statistics.totalClearedGD}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-600 mb-2">Technical</p>
            <p className="text-2xl font-bold text-purple-600">{statistics.totalClearedTechnical}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-600 mb-2">HR</p>
            <p className="text-2xl font-bold text-emerald-600">{statistics.totalClearedHR}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-600 mb-2">Rejected</p>
            <p className="text-2xl font-bold text-red-600">{statistics.totalRejected}</p>
          </div>
        </div>
      </div>

      {/* Opportunities List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Applied Opportunities</h3>
        {opportunities.length === 0 ? (
          <p className="text-sm text-slate-600 py-8 text-center">No opportunities found</p>
        ) : (
          opportunities.map((opp) => (
            <div
              key={opp.opportunityId}
              className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-md transition cursor-pointer"
              onClick={() => {
                setSelectedOpportunity(opp);
                fetchOpportunityDetails(opp.opportunityId);
              }}
            >
              <div className="mb-3">
                <h4 className="font-semibold text-slate-900">{opp.title}</h4>
                <p className="text-xs text-slate-600">
                  {opp.type} • {opp.department} • Status: {opp.status}
                </p>
              </div>

              {/* Stages Progress */}
              <div className="flex flex-wrap gap-2">
                {["Aptitude Test", "Group Discussion", "Technical Interview", "HR Interview"].map(
                  (stage) => (
                    <div
                      key={stage}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border ${getStageColor(
                        opp.stageProgress[stage]
                      )}`}
                    >
                      {stage.split(" ").pop()}: {getStageStatusLabel(opp.stageProgress[stage])}
                    </div>
                  )
                )}
              </div>

              <p className="text-xs text-slate-600 mt-3">
                <strong>Highest Stage:</strong> {opp.highestStageCleared}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Opportunity Details Modal */}
      {showDetailsModal && opportunityDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                {opportunityDetails.opportunity.title}
              </h3>

              <div className="space-y-4 mb-6">
                {opportunityDetails.stageProgress.map((stage) => (
                  <div key={stage.stage}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-slate-900">{stage.stage}</p>
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded ${
                          stage.status === "present"
                            ? "bg-green-100 text-green-800"
                            : stage.status === "absent"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {getStageStatusLabel(stage.status)}
                      </span>
                    </div>
                    {stage.markedAt && (
                      <p className="text-xs text-slate-600">
                        {new Date(stage.markedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {opportunityDetails.rejectionRound && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 mb-6">
                  <p className="text-xs text-red-800">
                    <strong>Rejected in:</strong> {opportunityDetails.rejectionRound}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-4 border-t border-slate-200 justify-end">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentAnalytics;
