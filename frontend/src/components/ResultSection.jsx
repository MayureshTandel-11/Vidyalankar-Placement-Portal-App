import { useState, useEffect, useCallback } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { Spinner, EmptyState } from "./ui";
import ResultTable from "./ResultTable";
import { getResultStudents } from "../services/opportunitiesService";

const ResultSection = ({ opportunityId, onRefreshRequired }) => {
  const [resultStudents, setResultStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchResultStudents = useCallback(async () => {
    if (!opportunityId) {
      setError("No opportunity selected");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await getResultStudents(opportunityId);
      setResultStudents(data.resultStudents || []);
    } catch (err) {
      setError(err.message || "Failed to fetch result students");
      console.error("[RESULT SECTION ERROR]", err);
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  // Fetch on mount and when opportunityId changes
  useEffect(() => {
    fetchResultStudents();
  }, [opportunityId, fetchResultStudents, refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleUploadSuccess = () => {
    // Refresh the result students list after successful upload
    handleRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-slate-800 mb-1">
            Result Section
          </h3>
          <p className="text-xs sm:text-sm text-slate-600">
            Manage offer letters for selected students ({resultStudents.length})
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 hover:text-indigo-800 text-xs sm:text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh result students list"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          <span className="hidden sm:inline">
            {loading ? "Refreshing..." : "Refresh"}
          </span>
          <span className="sm:hidden">
            {loading ? "..." : "↻"}
          </span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <Spinner />
        </div>
      ) : error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle size={20} className="flex-shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-800 text-sm sm:text-base">
              Error Loading Result Section
            </p>
            <p className="text-xs sm:text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex-shrink-0 text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-100 transition text-sm font-medium"
          >
            Retry
          </button>
        </div>
      ) : (
        <ResultTable
          resultStudents={resultStudents}
          opportunityId={opportunityId}
          onUploadSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
};

export default ResultSection;
