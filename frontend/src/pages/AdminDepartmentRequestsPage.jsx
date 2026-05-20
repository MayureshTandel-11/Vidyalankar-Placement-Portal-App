import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api, { extractApiError } from "../api";
import Layout from "../components/Layout";
import Footer from "../components/Footer";
import { PrimaryButton, SectionTitle, StatusMessage } from "../components/ui";
import { CheckCircle, XCircle, Clock, AlertCircle, CheckIcon, XIcon } from "lucide-react";

const AdminDepartmentRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [remarkData, setRemarkData] = useState({ requestId: null, remark: "", action: null });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await api.get("/department-change-request/admin/all");
      if (response.data?.data) {
        setRequests(response.data.data);
      }
    } catch (err) {
      const errorMsg = extractApiError(err, "Failed to load requests");
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (requestId) => {
    setRemarkData({ requestId, remark: "", action: "approve" });
    setShowRemarkModal(true);
  };

  const handleReject = (requestId) => {
    setRemarkData({ requestId, remark: "", action: "reject" });
    setShowRemarkModal(true);
  };

  const submitAction = async () => {
    const { requestId, remark, action } = remarkData;

    setProcessing({ ...processing, [requestId]: true });
    setError("");
    setMessage("");

    try {
      const endpoint =
        action === "approve"
          ? `/department-change-request/${requestId}/approve`
          : `/department-change-request/${requestId}/reject`;

      const response = await api.patch(endpoint, { adminRemark: remark });

      if (response.data?.data) {
        setRequests(
          requests.map(req =>
            req._id === requestId ? response.data.data : req
          )
        );
        setMessage(
          `Request ${action === "approve" ? "approved" : "rejected"} successfully!`
        );
        toast.success(
          `Request ${action === "approve" ? "approved" : "rejected"}`
        );
      }

      setShowRemarkModal(false);
      setRemarkData({ requestId: null, remark: "", action: null });
    } catch (err) {
      const errorMsg = extractApiError(err, "Action failed");
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setProcessing({ ...processing, [requestId]: false });
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "approved":
        return <CheckCircle size={18} className="text-green-600" />;
      case "rejected":
        return <XCircle size={18} className="text-red-600" />;
      case "pending":
        return <Clock size={18} className="text-yellow-600" />;
      default:
        return null;
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

  const filteredRequests =
    filterStatus === "all"
      ? requests
      : requests.filter(req => req.status === filterStatus);

  if (loading) {
    return (
      <Layout role="Admin">
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="space-y-3">
            <div className="h-8 bg-gradient-to-r from-slate-200 to-slate-100 rounded-lg w-1/3 animate-pulse"></div>
            <div className="h-4 bg-slate-100 rounded w-2/3 animate-pulse"></div>
          </div>

          {/* Filters Skeleton */}
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-lg w-20 animate-pulse"></div>
            ))}
          </div>

          {/* Table Skeleton */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="h-12 bg-slate-50 border-b border-slate-200 animate-pulse"></div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 border-b border-slate-100 bg-white animate-pulse"></div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Layout role="Admin">
        <div className="space-y-6">
          {/* Enhanced Header */}
          <div className="space-y-2">
            <SectionTitle
              title="Department Change Requests"
              subtitle="Review and manage student department change requests"
            />
            <div className="flex items-center gap-2 text-sm text-slate-600 pt-2">
              <AlertCircle size={16} />
              <span>{filteredRequests.length} request(s) displayed</span>
            </div>
          </div>

          {/* Status Messages */}
          <div className="space-y-2">
            <StatusMessage message={message} />
            <StatusMessage type="error" message={error} />
          </div>

          {/* Enhanced Filter Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-wrap gap-3">
              {["all", "pending", "approved", "rejected"].map(status => {
                const count = status === "all" ? requests.length : requests.filter(r => r.status === status).length;
                const isActive = filterStatus === status;

                return (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-4 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 text-sm ${
                      isActive
                        ? "bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md hover:shadow-lg"
                        : "bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                    <span className={`inline-flex items-center justify-center rounded-full w-6 h-6 text-xs font-semibold ${
                      isActive ? "bg-white/30" : "bg-slate-200"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Enhanced Table Container */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {filteredRequests.length === 0 ? (
              <div className="p-12 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-100 rounded-full mb-4">
                  <AlertCircle size={24} className="text-slate-400" />
                </div>
                <p className="text-slate-600 font-medium">No requests found</p>
                <p className="text-slate-500 text-sm mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">Student</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">Current</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">Requested</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">Reason</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">Date</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredRequests.map((req, index) => (
                      <tr
                        key={req._id}
                        className="hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-25 transition duration-150 group"
                      >
                        <td className="px-6 py-4 text-sm">
                          <div>
                            <p className="font-semibold text-slate-900 group-hover:text-red-600 transition">
                              {req.studentId?.name || "N/A"}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {req.studentId?.email || "N/A"}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700 font-medium">
                          {req.currentDepartment}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700 font-medium">
                          {req.requestedDepartment}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          <span className="line-clamp-2">
                            {req.reason || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(req.status)}
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 ${getStatusBadgeClass(req.status)}`}>
                              {req.status === "approved" && <CheckIcon size={12} />}
                              {req.status === "rejected" && <XIcon size={12} />}
                              {req.status === "pending" && <Clock size={12} />}
                              {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {new Date(req.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric"
                          })}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {req.status === "pending" ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApprove(req._id)}
                                disabled={processing[req._id]}
                                className="px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200 rounded-lg hover:border-green-400 hover:from-green-100 hover:to-emerald-100 disabled:opacity-50 transition duration-200 text-xs font-semibold flex items-center gap-1"
                              >
                                <CheckIcon size={14} />
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(req._id)}
                                disabled={processing[req._id]}
                                className="px-3 py-1.5 bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border border-red-200 rounded-lg hover:border-red-400 hover:from-red-100 hover:to-rose-100 disabled:opacity-50 transition duration-200 text-xs font-semibold flex items-center gap-1"
                              >
                                <XIcon size={14} />
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500 font-medium">
                              {req.adminRemark ? "✓ Processed" : "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Layout>

      {/* Enhanced Modal */}
      {showRemarkModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-6 border border-slate-200 animate-in fade-in scale-95 transition-all duration-200">
            {/* Modal Header */}
            <div className="space-y-2">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-red-50 to-rose-50 border border-red-200">
                {remarkData.action === "approve" ? (
                  <CheckIcon size={20} className="text-green-600" />
                ) : (
                  <XIcon size={20} className="text-red-600" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                {remarkData.action === "approve" ? "Approve Request" : "Reject Request"}
              </h3>
              <p className="text-sm text-slate-600">
                {remarkData.action === "approve"
                  ? "Add an optional note explaining the approval."
                  : "Add a note explaining the rejection."}
              </p>
            </div>

            {/* Textarea */}
            <textarea
              rows="4"
              className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              placeholder={`Add ${remarkData.action === "approve" ? "approval" : "rejection"} note...`}
              value={remarkData.remark}
              onChange={(e) =>
                setRemarkData({ ...remarkData, remark: e.target.value })
              }
              maxLength={500}
            />

            <p className="text-xs text-slate-500 flex items-center justify-between">
              <span>Character count:</span>
              <span className="font-semibold">{remarkData.remark.length}/500</span>
            </p>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowRemarkModal(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition duration-200 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={submitAction}
                className={`flex-1 px-4 py-2.5 text-white rounded-lg font-semibold transition duration-200 text-sm flex items-center justify-center gap-2 ${
                  remarkData.action === "approve"
                    ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    : "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700"
                }`}
              >
                {remarkData.action === "approve" ? (
                  <>
                    <CheckIcon size={16} />
                    Approve
                  </>
                ) : (
                  <>
                    <XIcon size={16} />
                    Reject
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
};

export default AdminDepartmentRequestsPage;
