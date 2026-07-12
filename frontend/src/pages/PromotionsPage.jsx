import { useState, useEffect, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import Footer from "../components/Footer";
import api, { extractApiError } from "../api";
import { Spinner, EmptyState } from "../components/ui";
import { Search, Filter, CheckSquare, Square, TrendingUp, AlertCircle } from "lucide-react";
import { DEPARTMENTS, YEAR_OPTIONS } from "../constants/departments";

/**
 * PromotionsPage Component
 * Manage student promotions: FY -> SY, SY -> TY
 * Admin: can promote students from all departments
 * Faculty: can only promote students from their department
 */
const PromotionsPage = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [isSelectAllChecked, setIsSelectAllChecked] = useState(false);

  const ITEMS_PER_PAGE = 20;
  const roleLabel = user?.role === "admin" ? "Admin" : "Faculty";

  /**
   * Fetch eligible students with filters
   */
  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const params = {
        page,
        limit: ITEMS_PER_PAGE,
      };

      // Add filters
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      if (selectedYear) {
        params.year = selectedYear;
      }

      // Admin only: department filter
      if (user?.role === "admin" && selectedDepartment) {
        params.department = selectedDepartment;
      }

      const response = await api.get("/promotions/students", { params });
      const data = response.data?.data;

      if (data) {
        setStudents(data.students || []);
        setTotalPages(data.pagination?.pages || 1);
      } else {
        setStudents([]);
      }
    } catch (err) {
      setError(extractApiError(err, "Failed to load eligible students"));
      console.error("[PROMOTIONS PAGE] Fetch error:", err);
      setStudents([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchTerm, selectedYear, selectedDepartment, user?.role]);

  // Fetch students on mount and when filters change
  useEffect(() => {
    setPage(1);
    setSelectedStudents(new Set());
    setIsSelectAllChecked(false);
  }, [searchTerm, selectedYear, selectedDepartment]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  /**
   * Handle individual checkbox toggle
   */
  const toggleStudentSelection = (studentId) => {
    const newSelection = new Set(selectedStudents);
    if (newSelection.has(studentId)) {
      newSelection.delete(studentId);
    } else {
      newSelection.add(studentId);
    }
    setSelectedStudents(newSelection);

    // Update select all checkbox state
    if (newSelection.size === students.length && students.length > 0) {
      setIsSelectAllChecked(true);
    } else {
      setIsSelectAllChecked(false);
    }
  };

  /**
   * Handle select all checkbox
   */
  const toggleSelectAll = () => {
    if (isSelectAllChecked) {
      // Deselect all
      setSelectedStudents(new Set());
      setIsSelectAllChecked(false);
    } else {
      // Select all visible students
      const allIds = new Set(students.map((s) => s._id));
      setSelectedStudents(allIds);
      setIsSelectAllChecked(true);
    }
  };

  /**
   * Handle promotion of selected students
   */
  const handlePromote = async () => {
    if (selectedStudents.size === 0) {
      toast.error("Please select at least one student");
      return;
    }

    // Confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to promote ${selectedStudents.size} student(s)?`
    );
    if (!confirmed) return;

    setIsPromoting(true);
    try {
      const studentIds = Array.from(selectedStudents);
      const response = await api.patch("/promotions/promote", {
        studentIds,
      });

      const data = response.data?.data;
      if (data) {
        const { promotedCount, totalSelected, invalidStudents } = data;

        // Show success message
        if (promotedCount > 0) {
          toast.success(`Successfully promoted ${promotedCount} student(s)`);
        }

        // Show errors for invalid students if any
        if (invalidStudents && invalidStudents.length > 0) {
          const errorMsg = invalidStudents
            .map((s) => `${s.name}: ${s.reason}`)
            .join("\n");
          toast.error(`Failed to promote some students:\n${errorMsg}`);
        }

        // Refresh the list
        setSelectedStudents(new Set());
        setIsSelectAllChecked(false);
        await fetchStudents();
      }
    } catch (err) {
      const errorMsg = extractApiError(err, "Failed to promote students");
      toast.error(errorMsg);
      console.error("[PROMOTIONS PAGE] Promotion error:", err);
    } finally {
      setIsPromoting(false);
    }
  };

  /**
   * Get promotion target year display
   */
  const getTargetYearDisplay = (student) => {
    if (student.targetYear) {
      return student.targetYear;
    }
    return "Not eligible";
  };

  /**
   * Table data with memoization
   */
  const tableData = useMemo(() => {
    return students.map((student) => ({
      ...student,
      isSelected: selectedStudents.has(student._id),
      targetYearDisplay: getTargetYearDisplay(student),
    }));
  }, [students, selectedStudents]);

  return (
    <>
      <Layout role={roleLabel}>
        <div className="space-y-8">
          {/* Page Header */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp size={28} className="text-indigo-600" />
                  Student Promotions
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  {user?.role === "faculty"
                    ? `Promote eligible students from ${user?.department || "your department"}`
                    : "Promote eligible students across departments"}
                </p>
              </div>
            </div>
          </div>

          {/* Filters Section */}
          <div className="glass-panel p-6 rounded-xl space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-600 mb-3">
                Filters
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Department Filter - Admin Only */}
                {user?.role === "admin" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      Department
                    </label>
                    <select
                      className="input-modern w-full text-sm"
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                    >
                      <option value="">All Departments</option>
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Year Filter */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Current Year
                  </label>
                  <select
                    className="input-modern w-full text-sm"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                  >
                    <option value="">All Eligible Years</option>
                    <option value="First Year">First Year</option>
                    <option value="Second Year">Second Year</option>
                  </select>
                </div>

                {/* Search */}
                <div className={user?.role === "admin" ? "" : "sm:col-span-2"}>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Search
                  </label>
                  <div className="relative">
                    <Search
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Name, Roll No, Email..."
                      className="input-modern w-full pl-10 text-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Selection Counter and Promote Button */}
          {selectedStudents.size > 0 && (
            <div className="glass-panel p-4 rounded-xl flex items-center justify-between bg-indigo-50 border border-indigo-200">
              <p className="text-sm font-medium text-indigo-900">
                {selectedStudents.size} student{selectedStudents.size !== 1 ? "s" : ""} selected
              </p>
              <button
                onClick={handlePromote}
                disabled={isPromoting}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition"
              >
                {isPromoting ? (
                  <>
                    <Spinner size="sm" />
                    Promoting...
                  </>
                ) : (
                  <>
                    <TrendingUp size={16} />
                    Promote Selected Students
                  </>
                )}
              </button>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <AlertCircle size={20} className="flex-shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-800 text-sm sm:text-base">
                  Error Loading Students
                </p>
                <p className="text-xs sm:text-sm text-red-700 mt-1">{error}</p>
              </div>
              <button
                onClick={() => fetchStudents()}
                className="flex-shrink-0 text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-100 transition text-sm font-medium"
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading ? (
            <div className="py-12 flex justify-center">
              <Spinner />
            </div>
          ) : students.length === 0 ? (
            <EmptyState
              title="No Eligible Students"
              subtitle={
                selectedYear || searchTerm || selectedDepartment
                  ? "No students found matching the filters. Try adjusting your search criteria."
                  : "No students are eligible for promotion at the moment. Eligible students must be in First Year or Second Year."
              }
            />
          ) : (
            <>
              {/* Students Table */}
              <div className="glass-panel rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-4 py-3 text-left">
                          <button
                            onClick={toggleSelectAll}
                            className="flex items-center justify-center w-6 h-6 rounded border border-slate-300 hover:bg-slate-100 transition"
                            title={
                              isSelectAllChecked
                                ? "Deselect all"
                                : "Select all on this page"
                            }
                          >
                            {isSelectAllChecked ? (
                              <CheckSquare size={16} className="text-indigo-600" />
                            ) : (
                              <Square size={16} className="text-slate-400" />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Name
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Roll Number
                        </th>
                        {user?.role === "admin" && (
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">
                            Department
                          </th>
                        )}
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Current Year
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Promotion Target
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((student, index) => (
                        <tr
                          key={student._id}
                          className={`border-b border-slate-100 transition ${
                            index % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                          } hover:bg-indigo-50`}
                        >
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleStudentSelection(student._id)}
                              className="flex items-center justify-center w-6 h-6 rounded border border-slate-300 hover:bg-slate-100 transition"
                            >
                              {student.isSelected ? (
                                <CheckSquare size={16} className="text-indigo-600" />
                              ) : (
                                <Square size={16} className="text-slate-400" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">
                              {student.name}
                            </p>
                            {student.email && (
                              <p className="text-xs text-slate-500">
                                {student.email}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {student.studentId || "N/A"}
                          </td>
                          {user?.role === "admin" && (
                            <td className="px-4 py-3 text-slate-700">
                              {student.department}
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <span className="inline-block px-2.5 py-1 bg-indigo-100 text-indigo-800 text-xs font-semibold rounded-full">
                              {student.currentYear}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {student.isEligible ? (
                              <span className="inline-block px-2.5 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                                {student.targetYearDisplay}
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
                                Not eligible
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() =>
                        setPage(Math.min(totalPages, page + 1))
                      }
                      disabled={page === totalPages}
                      className="px-3 py-1.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Layout>
      <Footer />
    </>
  );
};

export default PromotionsPage;
