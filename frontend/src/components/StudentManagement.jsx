import { useState, useEffect, useCallback, useMemo } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { Search, Filter, Download, Eye, BarChart3 } from "lucide-react";
import { Spinner } from "./ui";
import { generateStudentProfilePDF } from "../utils/pdfGenerator";

/**
 * StudentManagement Component
 * Faculty: View students from their department
 * Admin: View all students with department filter
 */
const StudentManagement = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [departments, setDepartments] = useState([]);
  const [years, setYears] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isDownloadingResume, setIsDownloadingResume] = useState(false);

  const ITEMS_PER_PAGE = 20;

  // Fetch years and departments on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setError("");
        const [yearsRes, deptRes] = await Promise.all([
          api.get("/student/management/years"),
          api.get("/metadata/departments"),
        ]);

        // Defensive: validate responses
        const yearsData = yearsRes?.data?.data;
        const deptsData = deptRes?.data?.data;

        if (Array.isArray(yearsData)) {
          setYears(yearsData);
        } else {
          console.warn("[STUDENT MGMT] Invalid years response:", yearsData);
          setYears([]);
        }

        if (Array.isArray(deptsData)) {
          setDepartments(deptsData);
        } else {
          console.warn("[STUDENT MGMT] Invalid departments response:", deptsData);
          setDepartments([]);
        }
      } catch (err) {
        console.error("[STUDENT MGMT] Failed to fetch metadata:", {
          message: err.message,
          status: err.response?.status
        });
        setError("Failed to load filters. Please refresh.");
        // Set empty arrays as fallback
        setYears([]);
        setDepartments([]);
      }
    };

    fetchInitialData();
  }, []);

  // Fetch students based on filters and pagination
  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const params = {
        page,
        limit: ITEMS_PER_PAGE,
      };

      if (searchTerm) {
        params.search = searchTerm;
      }

      if (selectedDepartment && user?.role === "admin") {
        params.department = selectedDepartment;
      }

      if (selectedYear) {
        params.year = selectedYear;
      }

      const response = await api.get("/student/management/list", { params });

      // Defensive: validate response structure
      const studentsData = response?.data?.data;
      const paginationData = response?.data?.pagination;

      if (!Array.isArray(studentsData)) {
        console.warn("[STUDENT MGMT] Invalid students response format", studentsData);
        setStudents([]);
        setTotalPages(1);
      } else {
        setStudents(studentsData);
        setTotalPages(paginationData?.totalPages || 1);
      }
    } catch (err) {
      const message = err.response?.data?.message || err.message || "Failed to fetch students";
      setError(message);
      console.error("[STUDENT MGMT] Fetch error:", {
        message,
        status: err.response?.status,
        url: err.config?.url
      });
      // Set empty list on error but don't lose previous data
      setStudents([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchTerm, selectedDepartment, selectedYear, user?.role]);

  // Fetch students when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedDepartment, selectedYear]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Download resume
  const handleDownloadResume = async (studentId, studentName) => {
    // Defensive: validate all inputs BEFORE API call
    if (!studentId || studentId === "null" || String(studentId).trim() === "") {
      setError("Invalid student ID for resume download");
      console.warn("[STUDENT MGMT] Invalid studentId for resume:", { studentId, studentName });
      return;
    }

    if (!studentName || String(studentName).trim() === "") {
      studentName = "resume";
    }

    setIsDownloadingResume(true);
    setError("");

    try {
      if (process.env.NODE_ENV === "development") {
        console.log("[STUDENT MGMT] Downloading resume for:", { studentId, studentName });
      }

      const response = await api.get(`/student/profile/resume/download/${studentId}`, {
        responseType: "blob",
      });

      // Defensive: validate response is a valid blob
      if (!response?.data) {
        throw new Error("Empty response from server");
      }

      const blob = response.data;

      // Validate blob size
      if (blob.size === 0) {
        throw new Error("Resume file is empty");
      }

      // Create and trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${studentName.replace(/\s+/g, "_")}_${studentId}.pdf`;

      // Append to body (required in some browsers)
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup object URL
      URL.revokeObjectURL(url);

      if (process.env.NODE_ENV === "development") {
        console.log("[STUDENT MGMT] Resume download successful:", { studentId, studentName });
      }
    } catch (err) {
      const message = err.response?.data?.message ||
                     err.message ||
                     "Failed to download resume";
      setError(message);
      console.error("[STUDENT MGMT] Resume download error:", {
        studentId,
        studentName,
        message,
        status: err.response?.status,
        url: err.config?.url
      });
    } finally {
      setIsDownloadingResume(false);
    }
  };

  // Generate and download PDF profile
  const handleDownloadPDF = async (student) => {
    setIsGeneratingPDF(true);
    try {
      generateStudentProfilePDF(student, student.studentId);
    } catch (err) {
      setError(err.message || "Failed to generate PDF");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // View student analytics
  const handleViewAnalytics = async (student) => {
    // Defensive: extensive null checks BEFORE any API call
    if (!student) {
      console.warn("[STUDENT MGMT] No student provided");
      setError("Invalid student selected. Please try again.");
      return;
    }

    const studentId = student?.studentId || student?._id;

    // Validate studentId exists and is not null/undefined/"null" string
    if (!studentId || studentId === "null" || String(studentId).trim() === "") {
      console.warn("[STUDENT MGMT] Invalid/missing studentId:", { student, studentId });
      setError("Student ID is missing or invalid. Unable to load analytics.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      if (process.env.NODE_ENV === "development") {
        console.log("[STUDENT MGMT] Fetching analytics for:", studentId);
      }

      const response = await api.get(`/student/analytics/${studentId}`);

      // Defensive: validate response
      const analyticsData = response?.data?.data;
      if (!analyticsData) {
        console.warn("[STUDENT MGMT] Empty analytics response for:", studentId);
        setError("No analytics data available for this student.");
        return;
      }

      setSelectedStudent({
        ...student,
        analytics: analyticsData,
      });
      setShowAnalyticsModal(true);
    } catch (err) {
      const message = err.response?.data?.message ||
                     err.message ||
                     "Failed to fetch student analytics";
      setError(message);
      console.error("[STUDENT MGMT] Analytics fetch error:", {
        studentId,
        message,
        status: err.response?.status,
        url: err.config?.url
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Pagination helpers
  const goToPage = (pageNum) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setPage(pageNum);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Student Management</h1>
        <p className="text-slate-600 mt-1">
          {user?.role === "admin"
            ? "View and manage all students"
            : "View students from your department"}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex items-center gap-2 text-slate-700">
          <Filter size={18} />
          <h3 className="text-sm font-semibold">Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-2">
              Search by Name, Email, or PRN
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Department Filter - only for admin */}
          {user?.role === "admin" && (
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-2">
                Department
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Year Filter */}
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-2">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Years</option>
              {years.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Students List */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner /> <span className="ml-2 text-slate-600">Loading students...</span>
          </div>
        ) : students.length === 0 ? (
          <div className="py-12 text-center text-slate-600">
            <p>No students found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">PRN</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">Year</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">CGPA</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student._id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{student.fullName || student.name}</td>
                    <td className="px-4 py-3 text-slate-600">{student.email}</td>
                    <td className="px-4 py-3 text-slate-600">{student.studentId}</td>
                    <td className="px-4 py-3 text-slate-600">{student.year || "N/A"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {student.academicInfo?.cgpa || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleViewAnalytics(student)}
                          className="p-1.5 hover:bg-purple-100 rounded transition text-purple-600 title='View Analytics'"
                          title="View Analytics"
                        >
                          <BarChart3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDownloadPDF(student)}
                          disabled={isGeneratingPDF}
                          className="p-1.5 hover:bg-green-100 rounded transition text-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Download PDF"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          onClick={() => handleDownloadResume(student.studentId, student.fullName || student.name)}
                          disabled={isDownloadingResume}
                          className="p-1.5 hover:bg-blue-100 rounded transition text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Download Resume"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => goToPage(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {/* Student Analytics Modal */}
      {showAnalyticsModal && selectedStudent && selectedStudent.analytics && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Student Analytics - {selectedStudent.name}
              </h3>

              {/* Student Info */}
              <div className="grid grid-cols-2 gap-4 text-sm mb-6 pb-4 border-b border-slate-200">
                <div>
                  <p className="text-xs font-medium text-slate-600">Email</p>
                  <p className="text-slate-900">{selectedStudent.email}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-600">PRN</p>
                  <p className="text-slate-900">{selectedStudent.studentId}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-600">Department</p>
                  <p className="text-slate-900">{selectedStudent.department}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-600">Year</p>
                  <p className="text-slate-900">{selectedStudent.year || "N/A"}</p>
                </div>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="rounded-lg bg-blue-50 p-3 text-center">
                  <p className="text-xs text-blue-600 font-medium">Total Applied</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {selectedStudent.analytics?.statistics?.totalApplied || 0}
                  </p>
                </div>
                <div className="rounded-lg bg-green-50 p-3 text-center">
                  <p className="text-xs text-green-600 font-medium">Cleared Aptitude</p>
                  <p className="text-2xl font-bold text-green-700">
                    {selectedStudent.analytics?.statistics?.totalClearedAptitude || 0}
                  </p>
                </div>
                <div className="rounded-lg bg-purple-50 p-3 text-center">
                  <p className="text-xs text-purple-600 font-medium">Rejected</p>
                  <p className="text-2xl font-bold text-purple-700">
                    {selectedStudent.analytics?.statistics?.totalRejected || 0}
                  </p>
                </div>
              </div>

              {/* Applied Opportunities */}
              {selectedStudent.analytics?.opportunities?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">
                    Applied Opportunities ({selectedStudent.analytics.opportunities.length})
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedStudent.analytics.opportunities.map((opp) => (
                      <div key={opp.opportunityId} className="text-xs p-2 bg-slate-50 rounded border border-slate-200">
                        <p className="font-medium text-slate-900">{opp.title}</p>
                        <p className="text-slate-600">{opp.type} • {opp.status}</p>
                        <p className="text-slate-500 mt-1">
                          Highest Stage: <span className="font-medium">{opp.highestStageCleared}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-4 border-t border-slate-200 justify-end">
              <button
                onClick={() => setShowAnalyticsModal(false)}
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

export default StudentManagement;
