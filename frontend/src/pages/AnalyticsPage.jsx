import { useState, useEffect } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import StudentAnalytics from "../components/StudentAnalytics";
import Layout from "../components/Layout";
import Footer from "../components/Footer";
import { Spinner } from "../components/ui";
import { extractApiError } from "../utils/apiClient";

/**
 * AnalyticsPage
 * Faculty/Admin only. Shows:
 *   1. Class-level analytics (total students, top performers)
 *   2. Per-student analytics when a student is selected from the list
 *
 * FIX: Replaces the broken route that passed studentId={null} to StudentAnalytics.
 */
const AnalyticsPage = () => {
  const { user } = useAuth();
  const [classAnalytics, setClassAnalytics] = useState(null);
  const [classLoading, setClassLoading] = useState(true);
  const [classError, setClassError] = useState("");
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const roleLabel = user?.role === "admin" ? "Admin" : "Faculty";

  // Fetch class-level analytics on mount
  useEffect(() => {
    const fetchClassAnalytics = async () => {
      setClassLoading(true);
      setClassError("");
      try {
        const res = await api.get("/student/analytics/class");
        setClassAnalytics(res.data?.data);
      } catch (err) {
        setClassError(extractApiError(err, "Failed to load class analytics"));
        console.error("[ANALYTICS PAGE] Class analytics error:", err);
      } finally {
        setClassLoading(false);
      }
    };
    fetchClassAnalytics();
  }, []);

  // Fetch student list for the picker
  useEffect(() => {
    const fetchStudents = async () => {
      setStudentsLoading(true);
      try {
        const res = await api.get("/student/management/list?limit=200");
        const data = res.data?.data?.students || res.data?.data || [];
        setStudents(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("[ANALYTICS PAGE] Failed to load student list:", err);
      } finally {
        setStudentsLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const filteredStudents = students.filter((s) =>
    !searchTerm ||
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.studentId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <Layout role={roleLabel}>
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
            <p className="text-sm text-slate-500 mt-1">
              {user?.role === "faculty"
                ? "Analytics for your department students"
                : "Analytics for all students"}
            </p>
          </div>

          {/* Class-level stats */}
          {classLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : classError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {classError}
            </div>
          ) : classAnalytics ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-panel p-5">
                <p className="text-xs text-slate-500 mb-1">Total Students</p>
                <p className="text-3xl font-bold text-slate-900">{classAnalytics.totalStudents}</p>
              </div>
              <div className="glass-panel p-5">
                <p className="text-xs text-slate-500 mb-1">Avg. Opportunities Applied</p>
                <p className="text-3xl font-bold text-slate-900">{classAnalytics.averageOpportunitiesApplied}</p>
              </div>
              <div className="glass-panel p-5">
                <p className="text-xs text-slate-500 mb-1">Avg. Max Stage Reached</p>
                <p className="text-3xl font-bold text-slate-900">
                  {classAnalytics.stageMapping?.[Math.round(classAnalytics.averageMaxStageReached)] || classAnalytics.averageMaxStageReached}
                </p>
              </div>
              <div className="glass-panel p-5">
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

          {/* Per-student analytics */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Student Analytics</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Search by name or PRN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {studentsLoading ? (
                <Spinner />
              ) : (
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full sm:w-72 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">-- Select a student --</option>
                  {filteredStudents.map((s) => (
                    <option key={s._id} value={s.studentId}>
                      {s.name} ({s.studentId})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedStudentId ? (
              <StudentAnalytics studentId={selectedStudentId} />
            ) : (
              <div className="py-12 text-center text-slate-500 text-sm border border-dashed border-slate-300 rounded-lg">
                Select a student above to view their individual analytics.
              </div>
            )}
          </div>
        </div>
      </Layout>
      <Footer />
    </>
  );
};

export default AnalyticsPage;
