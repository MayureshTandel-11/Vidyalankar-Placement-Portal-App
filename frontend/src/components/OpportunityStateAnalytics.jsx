import { useState, useEffect, useCallback } from "react";
import { Download } from "lucide-react";
import api from "../api";
import { extractApiError } from "../utils/apiClient";
import { Spinner, EmptyState } from "./ui";

/**
 * Opportunity State analytics — per-opportunity recruitment metrics.
 */
const OpportunityStateAnalytics = ({ user, adminDepartment, searchTerm, onDownload, downloading }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (user?.role === "admin" && adminDepartment) {
        params.department = adminDepartment;
      }
      if (searchTerm) {
        params.search = searchTerm;
      }
      const res = await api.get("/student/analytics/opportunity-state", { params });
      setData(res.data?.data || null);
    } catch (err) {
      setError(extractApiError(err, "Failed to load opportunity state analytics"));
    } finally {
      setLoading(false);
    }
  }, [user?.role, adminDepartment, searchTerm]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
    );
  }

  const opportunities = data?.opportunities || [];

  if (opportunities.length === 0) {
    return (
      <EmptyState
        title="No opportunities found"
        subtitle={
          user?.role === "faculty"
            ? "No opportunities in your department match the current filters."
            : "Try adjusting department or search filters."
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Showing {opportunities.length} opportunit{opportunities.length === 1 ? "y" : "ies"}
        {user?.role === "faculty" ? ` in ${user?.department}` : ""}.
      </p>
      <div className="grid grid-cols-1 gap-4">
        {opportunities.map((opp) => (
          <div key={opp.opportunityId} className="glass-panel p-5 rounded-xl border border-slate-200/80">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{opp.title}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  <span className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded mr-2">{opp.type}</span>
                  <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{opp.department}</span>
                  <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded ml-2 capitalize">{opp.status}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDownload?.(opp.opportunityId)}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
              >
                <Download size={16} />
                {downloading ? "Downloading..." : "Download CSV"}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <Metric label="Total Applications" value={opp.totalApplications} />
              <Metric label="Eligible Students" value={opp.totalEligibleStudents} />
              <Metric label="Applied Students" value={opp.totalAppliedStudents} />
              <Metric label="Aptitude Cleared" value={opp.totalClearedAptitude} />
              <Metric label="GD Cleared" value={opp.totalClearedGD} />
              <Metric label="Technical Cleared" value={opp.totalClearedTechnical} />
              <Metric label="HR Cleared" value={opp.totalClearedHR} />
              <Metric label="Selected Students" value={opp.totalSelectedStudents} highlight />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Metric = ({ label, value, highlight = false }) => (
  <div className={`rounded-lg p-3 ${highlight ? "bg-emerald-50 border border-emerald-200" : "bg-slate-50 border border-slate-200"}`}>
    <p className="text-xs text-slate-500 mb-1">{label}</p>
    <p className={`text-xl font-bold ${highlight ? "text-emerald-700" : "text-slate-900"}`}>{value ?? 0}</p>
  </div>
);

export default OpportunityStateAnalytics;
