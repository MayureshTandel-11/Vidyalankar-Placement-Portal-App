import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api, { extractApiError } from "../api";
import Layout from "../components/Layout";
import Footer from "../components/Footer";
import { PrimaryButton, SectionTitle, StatusMessage } from "../components/ui";
import { DEPARTMENTS } from "../constants/departments";
import { ArrowRight, Clock, CheckCircle, XCircle, AlertCircle, Send, FileText, Calendar } from "lucide-react";

const StudentDepartmentChangeRequestPage = () => {
  const [currentDepartment, setCurrentDepartment] = useState("");
  const [requestedDepartment, setRequestedDepartment] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [requests, setRequests] = useState([]);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  // Fetch current department and existing requests on mount
  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setFetchLoading(true);
      const response = await api.get("/student/profile");
      if (response.data?.data) {
        setCurrentDepartment(response.data.data.department || "");
      }

      // Fetch existing requests
      const requestsResponse = await api.get("/department-change-request/my");
      if (requestsResponse.data?.data) {
        setRequests(requestsResponse.data.data);
        const pending = requestsResponse.data.data.some(req => req.status === "pending");
        setHasPendingRequest(pending);
      }
    } catch (err) {
      const errorMsg = extractApiError(err, "Failed to load data");
      setError(errorMsg);
      console.error("Error fetching user data:", err);
    } finally {
      setFetchLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!requestedDepartment) {
      setError("Please select a new department");
      return;
    }

    if (currentDepartment === requestedDepartment) {
      setError("Please select a different department");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await api.post("/department-change-request", {
        requestedDepartment,
        reason: reason.trim(),
      });

      setReason("");
      setRequestedDepartment("");
      setMessage("Department change request submitted successfully!");
      setRequests([response.data.data, ...requests]);
      setHasPendingRequest(true);
      toast.success("Request submitted successfully");
    } catch (err) {
      const errorMsg = extractApiError(err, "Could not submit request");
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (fetchLoading) {
    return (
      <Layout role="Student">
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="space-y-3">
            <div className="h-8 bg-gradient-to-r from-slate-200 to-slate-100 rounded-lg w-1/3 animate-pulse"></div>
            <div className="h-4 bg-slate-100 rounded w-2/3 animate-pulse"></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Skeleton */}
            <div className="lg:col-span-2 space-y-4 bg-white rounded-xl border border-slate-200 p-6">
              <div className="h-6 bg-slate-200 rounded w-1/3 animate-pulse"></div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/4 animate-pulse"></div>
                  <div className="h-10 bg-slate-100 rounded animate-pulse"></div>
                </div>
              ))}
              <div className="h-12 bg-slate-200 rounded-lg w-full animate-pulse"></div>
            </div>

            {/* Sidebar Skeleton */}
            <div className="lg:col-span-1 space-y-3 bg-white rounded-xl border border-slate-200 p-6">
              <div className="h-6 bg-slate-200 rounded w-1/2 animate-pulse"></div>
              {[1, 2].map((i) => (
                <div key={i} className="h-24 bg-slate-100 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Layout role="Student">
        <div className="space-y-6">
          {/* Enhanced Header */}
          <div className="space-y-2">
            <SectionTitle
              title="Department Change Request"
              subtitle="Submit a request to change your department. Only one pending request is allowed at a time."
            />
          </div>

          {/* Status Messages */}
          <div className="space-y-2">
            <StatusMessage message={message} />
            <StatusMessage type="error" message={error} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Section */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
                {/* Form Header */}
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-br from-red-100 to-red-50 rounded-lg">
                    <FileText size={20} className="text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">Submit New Request</h3>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Current Department (Read-only) */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-900">
                      Current Department
                    </label>
                    <input
                      type="text"
                      value={currentDepartment}
                      disabled
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 font-medium cursor-not-allowed focus:outline-none"
                    />
                    <p className="text-xs text-slate-500">Your current department (read-only)</p>
                  </div>

                  {/* Transition Indicator */}
                  <div className="flex items-center justify-center py-2">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent to-slate-200"></div>
                    <ArrowRight size={20} className="mx-3 text-slate-400" />
                    <div className="flex-1 h-px bg-gradient-to-l from-transparent to-slate-200"></div>
                  </div>

                  {/* Requested Department */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-900">
                      New Department <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={requestedDepartment}
                      onChange={(e) => setRequestedDepartment(e.target.value)}
                      disabled={hasPendingRequest || loading}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all appearance-none bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Select a department</option>
                      {DEPARTMENTS.filter(d => d !== currentDepartment).map(dept => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500">Choose the department you want to transfer to</p>
                  </div>

                  {/* Reason */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-900">
                      Reason <span className="text-slate-400">(Optional)</span>
                    </label>
                    <textarea
                      rows="4"
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Explain why you want to change your department... (optional)"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      disabled={hasPendingRequest || loading}
                      maxLength={500}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500">Provide context to help the admin make a decision</p>
                      <span className="text-xs font-medium text-slate-600 bg-slate-50 px-2 py-1 rounded">
                        {reason.length}/500
                      </span>
                    </div>
                  </div>

                  {/* Pending Request Warning */}
                  {hasPendingRequest && (
                    <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                      <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-yellow-900">Pending Request Exists</p>
                        <p className="text-sm text-yellow-800 mt-1">You have a pending request. Please wait for admin approval or rejection before submitting a new one.</p>
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    onClick={handleSubmit}
                    disabled={loading || hasPendingRequest || !requestedDepartment}
                    className={`w-full py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all duration-200 ${
                      loading || hasPendingRequest || !requestedDepartment
                        ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 shadow-md hover:shadow-lg"
                    }`}
                  >
                    <Send size={18} />
                    {hasPendingRequest ? "Pending Request Exists" : loading ? "Submitting..." : "Submit Request"}
                  </button>
                </form>
              </div>
            </div>

            {/* Requests History Section */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 sticky top-24">
                {/* Header */}
                <div className="flex items-center gap-2 mb-5">
                  <div className="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-br from-slate-100 to-slate-50 rounded-lg">
                    <Clock size={18} className="text-slate-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">Request History</h3>
                </div>

                {/* Requests List */}
                {requests.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-100 rounded-full mb-3">
                      <FileText size={24} className="text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-600 font-medium">No requests yet</p>
                    <p className="text-xs text-slate-500 mt-1">Submit your first department change request</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {requests.map((req, index) => {
                      const isApproved = req.status === "approved";
                      const isRejected = req.status === "rejected";
                      const isPending = req.status === "pending";

                      return (
                        <div
                          key={req._id}
                          className={`rounded-lg border p-4 transition-all duration-200 hover:shadow-md ${
                            isPending
                              ? "bg-gradient-to-br from-yellow-50 to-yellow-25 border-yellow-200"
                              : isApproved
                              ? "bg-gradient-to-br from-green-50 to-green-25 border-green-200"
                              : "bg-gradient-to-br from-red-50 to-red-25 border-red-200"
                          }`}
                        >
                          {/* Status Badge and Date */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {isApproved && <CheckCircle size={16} className="text-green-600" />}
                              {isRejected && <XCircle size={16} className="text-red-600" />}
                              {isPending && <Clock size={16} className="text-yellow-600" />}
                              <span
                                className={`text-xs font-bold uppercase tracking-wide ${
                                  isPending
                                    ? "text-yellow-700"
                                    : isApproved
                                    ? "text-green-700"
                                    : "text-red-700"
                                }`}
                              >
                                {req.status}
                              </span>
                            </div>
                            <span className="text-xs text-slate-600 font-medium flex items-center gap-1">
                              <Calendar size={12} />
                              {new Date(req.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric"
                              })}
                            </span>
                          </div>

                          {/* Department Transition */}
                          <div className="space-y-2 mb-3">
                            <div className="text-xs font-semibold text-slate-700">
                              {req.currentDepartment}
                            </div>
                            <div className="flex items-center justify-center text-slate-400">
                              <ArrowRight size={14} />
                            </div>
                            <div className="text-xs font-semibold text-slate-700">
                              {req.requestedDepartment}
                            </div>
                          </div>

                          {/* Admin Remark */}
                          {req.adminRemark && (
                            <div className={`text-xs p-2.5 rounded border mt-3 ${
                              isPending
                                ? "bg-white border-yellow-200 text-yellow-900"
                                : isApproved
                                ? "bg-white border-green-200 text-green-900"
                                : "bg-white border-red-200 text-red-900"
                            }`}>
                              <strong className="block mb-1">Admin Note:</strong>
                              <p className="line-clamp-3">{req.adminRemark}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Layout>
      <Footer />
    </>
  );
};

export default StudentDepartmentChangeRequestPage;
