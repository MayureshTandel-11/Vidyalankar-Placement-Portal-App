import { useState, useEffect, useMemo, useCallback } from "react";
import { Download } from "lucide-react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import StudentAnalytics from "../components/StudentAnalytics";
import OpportunityStateAnalytics from "../components/OpportunityStateAnalytics";
import Layout from "../components/Layout";
import Footer from "../components/Footer";
import { Spinner, EmptyState } from "../components/ui";
import { extractApiError } from "../utils/apiClient";
import { DEPARTMENTS, YEAR_OPTIONS } from "../constants/departments";

const ANALYTICS_VIEWS = [
  { id: "student-state", label: "Student State" },
  { id: "opportunity-state", label: "Opportunity State" },
];

/**
 * Analytics for faculty (department-scoped) and admin (filters + class metrics).
 * Student State preserves the original analytics view; Opportunity State shows per-opportunity metrics.
 */
const AnalyticsPage = () => {
  const { user } = useAuth();
  const [analyticsView, setAnalyticsView] = useState("student-state");
  const [classAnalytics, setClassAnalytics] = useState(null);
  const [classLoading, setClassLoading] = useState(true);
  const [classError, setClassError] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [adminDepartment, setAdminDepartment] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [csvDownloading, setCsvDownloading] = useState(false);
  const [csvError, setCsvError] = useState("");

  const roleLabel = user?.role === "admin" ? "Admin" : "Faculty";

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const loadClassAnalytics = useCallback(async () => {
    setClassLoading(true);
    setClassError("");
    try {
      const params = {};
      if (user?.role === "admin" && adminDepartment) {
        params.department = adminDepartment;
      }
      if (yearFilter) {
        params.year = yearFilter;
      }
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      const res = await api.get("/student/analytics/class", { params });
      setClassAnalytics(res.data?.data || null);
    } catch (err) {
      setClassError(extractApiError(err, "Failed to load class analytics"));
      console.error("[ANALYTICS PAGE] Class analytics error:", err);
    } finally {
      setClassLoading(false);
    }
  }, [user?.role, adminDepartment, yearFilter, debouncedSearch]);

  useEffect(() => {
    if (analyticsView === "student-state") {
      loadClassAnalytics();
    }
  }, [loadClassAnalytics, analyticsView]);

  const handleDownloadParticipationCSV = async () => {
    setCsvDownloading(true);
    setCsvError("");
    try {
      const params = {};
      if (user?.role === "admin" && adminDepartment) {
        params.department = adminDepartment;
      }
      if (yearFilter) {
        params.year = yearFilter;
      }
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      const response = await api.get("/student/analytics/participation/download", {
        params,
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const disposition = response.headers["content-disposition"];
      let filename = "student_participation.csv";
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
      }
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setCsvError(extractApiError(err, "Failed to download student participation CSV"));
    } finally {
      setCsvDownloading(false);
    }
  };

  const studentsSorted = useMemo(() => {
    const raw = classAnalytics?.students;
    if (!Array.isArray(raw)) return [];
    return [...raw].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", "en", { sensitivity: "base" })
    );
  }, [classAnalytics]);

  const filteredForSearch = useMemo(() => {
    if (!debouncedSearch) return studentsSorted;
    const q = debouncedSearch.toLowerCase();
    return studentsSorted.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.studentId?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
    );
  }, [studentsSorted, debouncedSearch]);

  return (
    <>
      <Layout role={roleLabel}>
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
            <p className="text-sm text-slate-500 mt-1">
              {user?.role === "faculty"
                ? `Analytics for ${user?.department || "your department"} — filter by year and search students.`
                : "Class metrics and per-student placement analytics."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-600 w-full py-1">Analytics View</span>
            {ANALYTICS_VIEWS.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => setAnalyticsView(view.id)}
                className={`rounded-full px-4 py-2 text-xs font-medium border transition ${
                  analyticsView === view.id
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300"
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>

          {user?.role === "admin" && (
            <div className="glass-panel p-4 space-y-2 rounded-xl">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Department</p>
              <select
                className="input-modern w-full max-w-md text-sm"
                value={adminDepartment}
                onChange={(e) => setAdminDepartment(e.target.value)}
              >
                <option value="">All departments</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          {user?.role === "faculty" && (
            <div className="glass-panel p-4 rounded-xl text-sm text-slate-700">
              Showing students in <span className="font-semibold text-indigo-700">{user?.department}</span> only.
            </div>
          )}

          {analyticsView === "student-state" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2 flex-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-600 w-full py-1">Year</span>
                  <button
                    type="button"
                    onClick={() => setYearFilter("")}
                    className={`rounded-full px-4 py-2 text-xs font-medium border transition ${
                      !yearFilter
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300"
                    }`}
                  >
                    All years
                  </button>
                  {YEAR_OPTIONS.map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => setYearFilter(yearFilter === y ? "" : y)}
                      className={`rounded-full px-4 py-2 text-xs font-medium border transition ${
                        yearFilter === y
                          ? "bg-red-600 text-white border-red-600"
                          : "bg-white text-slate-700 border-slate-200 hover:border-red-300"
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleDownloadParticipationCSV}
                  disabled={csvDownloading}
                  className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                >
                  <Download size={16} />
                  {csvDownloading ? "Downloading..." : "Download Student Participation CSV"}
                </button>
              </div>
              {csvError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{csvError}</div>
              )}

              {classLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner />
                </div>
              ) : classError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{classError}</div>
              ) : classAnalytics ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="glass-panel p-5 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">Total Students</p>
                    <p className="text-3xl font-bold text-slate-900">{classAnalytics.totalStudents}</p>
                  </div>
                  <div className="glass-panel p-5 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">Avg. Opportunities Applied</p>
                    <p className="text-3xl font-bold text-slate-900">{classAnalytics.averageOpportunitiesApplied}</p>
                  </div>
                  <div className="glass-panel p-5 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">Avg. Max Stage Reached</p>
                    <p className="text-3xl font-bold text-slate-900">
                      {classAnalytics.stageMapping?.[Math.round(Number(classAnalytics.averageMaxStageReached))] ||
                        classAnalytics.averageMaxStageReached}
                    </p>
                  </div>
                  <div className="glass-panel p-5 rounded-xl">
                    <p className="text-xs text-slate-500 mb-2">Top Performers</p>
                    <ul className="space-y-1">
                      {(classAnalytics.topPerformers || []).slice(0, 3).map((p) => (
                        <li key={p.studentId} className="text-xs text-slate-700 truncate">
                          {p.name} — {classAnalytics.stageMapping?.[p.maxStageReached] || "Applied"}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">Students</h2>
                <input
                  type="text"
                  placeholder="Search by student name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full max-w-lg px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white/90"
                />

                {!classLoading && filteredForSearch.length === 0 ? (
                  <EmptyState title="No students match" subtitle="Try another year, department, or search term." />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filteredForSearch.map((s) => (
                      <button
                        key={s.studentId}
                        type="button"
                        onClick={() => setSelectedStudentId(s.studentId)}
                        className={`text-left glass-panel p-4 rounded-xl border transition hover:border-red-300 hover:shadow-md ${
                          selectedStudentId === s.studentId ? "border-red-500 ring-2 ring-red-100" : "border-slate-200/80"
                        }`}
                      >
                        <p className="font-semibold text-slate-900">{s.name}</p>
                        <p className="text-xs text-slate-500 mt-1">{s.studentId}</p>
                        <p className="text-xs text-slate-500">{s.year}</p>
                        {user?.role === "admin" && s.department && (
                          <p className="text-xs text-indigo-600 mt-2">{s.department}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">Student detail</h2>
                {selectedStudentId ? (
                  <StudentAnalytics studentId={selectedStudentId} />
                ) : (
                  <div className="py-10 text-center text-slate-500 text-sm border border-dashed border-slate-300 rounded-xl">
                    Select a student card above to view individual analytics.
                  </div>
                )}
              </div>
            </>
          )}

          {analyticsView === "opportunity-state" && (
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Search opportunities by title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full max-w-lg px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white/90"
              />
              <OpportunityStateAnalytics
                user={user}
                adminDepartment={adminDepartment}
                searchTerm={debouncedSearch}
              />
            </div>
          )}
        </div>
      </Layout>
      <Footer />
    </>
  );
};

export default AnalyticsPage;
