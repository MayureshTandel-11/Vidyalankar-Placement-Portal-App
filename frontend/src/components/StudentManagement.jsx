import { useState, useEffect, useCallback, useMemo } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { Search, Filter, Download, Eye } from "lucide-react";
import { Spinner } from "./ui";

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
  const [showDetailModal, setShowDetailModal] = useState(false);

  const ITEMS_PER_PAGE = 20;

  // Fetch years and departments on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [yearsRes, deptRes] = await Promise.all([
          api.get("/student/management/years"),
          api.get("/metadata/departments"),
        ]);
        setYears(yearsRes.data?.data || []);
        setDepartments(deptRes.data?.data || []);
      } catch (err) {
        console.error("[FETCH INITIAL DATA ERROR]", err);
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
      setStudents(response.data?.data || []);
      setTotalPages(response.data?.pagination?.totalPages || 1);
    } catch (err) {
      const message = err.response?.data?.message || "Failed to fetch students";
      setError(message);
      console.error("[FETCH STUDENTS ERROR]", err);
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
    try {
      const response = await api.get(`/student/profile/resume/download/${studentId}`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.href = url;
      link.download = `${studentName}_resume.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to download resume");
    }
  };

  // View student details
  const handleViewDetails = async (student) => {
    try {
      const response = await api.get(`/student/management/${student.studentId}`);
      setSelectedStudent(response.data?.data);
      setShowDetailModal(true);
    } catch (err) {
      setError("Failed to fetch student details");
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
                          onClick={() => handleViewDetails(student)}
                          className="p-1.5 hover:bg-indigo-100 rounded transition text-indigo-600"
                          title="View Profile"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleDownloadResume(student.studentId, student.fullName || student.name)}
                          className="p-1.5 hover:bg-blue-100 rounded transition text-blue-600"
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

      {/* Student Detail Modal */}
      {showDetailModal && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                {selectedStudent.name}
              </h3>

              <div className="grid grid-cols-2 gap-4 text-sm mb-6">
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
                <div>
                  <p className="text-xs font-medium text-slate-600">CGPA</p>
                  <p className="text-slate-900">{selectedStudent.academicInfo?.cgpa || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-600">Phone</p>
                  <p className="text-slate-900">{selectedStudent.phone || "N/A"}</p>
                </div>
              </div>

              {/* Applied Opportunities */}
              {selectedStudent.opportunities?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">Applied Opportunities</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedStudent.opportunities.map((opp) => (
                      <div key={opp._id} className="text-xs p-2 bg-slate-50 rounded">
                        <p className="font-medium text-slate-900">{opp.announcementHeading}</p>
                        <p className="text-slate-600">{opp.type} • {opp.status}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-4 border-t border-slate-200 justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
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
