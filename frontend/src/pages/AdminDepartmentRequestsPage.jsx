import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api, { extractApiError } from "../api";
import Layout from "../components/Layout";
import Footer from "../components/Footer";
import { PrimaryButton, SectionTitle, StatusMessage } from "../components/ui";
import { CheckCircle, XCircle, Clock } from "lucide-react";

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
        <div className="flex items-center justify-center py-12">
          <div className="text-indigo-600">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Layout role="Admin">
        <SectionTitle
          title="Department Change Requests"
          subtitle="Review and manage student department change requests"
        />

        <StatusMessage message={message} />
        <StatusMessage type="error" message={error} />

        {/* Filter Tabs */}
        <div className="glass-panel p-4 mb-6">
          <div className="flex gap-2 flex-wrap">
            {["all", "pending", "approved", "rejected"].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filterStatus === status
                    ? "bg-indigo-600 text-white"
                    : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                {status === "all"
                  ? ` (${requests.length})`
                  : ` (${requests.filter(r => r.status === status).length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="glass-panel overflow-hidden">
          {filteredRequests.length === 0 ? (
            <div className="p-8 text-center text-indigo-600">
              No requests found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-indigo-50 border-b border-indigo-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-indigo-900">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-indigo-900">
                      Current Dept
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-indigo-900">
                      Requested Dept
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-indigo-900">
                      Reason
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-indigo-900">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-indigo-900">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-indigo-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((req, index) => (
                    <tr
                      key={req._id}
                      className={`border-b border-indigo-100 hover:bg-indigo-50 transition ${
                        index % 2 === 0 ? "bg-white" : "bg-indigo-50/50"
                      }`}
                    >
                      <td className="px-6 py-4 text-sm">
                        <div>
                          <p className="font-medium text-indigo-900">
                            {req.studentId?.name || "N/A"}
                          </p>
                          <p className="text-xs text-indigo-600">
                            {req.studentId?.email || "N/A"}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-indigo-900">
                        {req.currentDepartment}
                      </td>
                      <td className="px-6 py-4 text-sm text-indigo-900">
                        {req.requestedDepartment}
                      </td>
                      <td className="px-6 py-4 text-sm text-indigo-600">
                        <span className="line-clamp-2">
                          {req.reason || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(req.status)}
                          <span className={`px-3 py-1 rounded text-xs font-medium ${getStatusBadgeClass(req.status)}`}>
                            {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-indigo-600">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {req.status === "pending" ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(req._id)}
                              disabled={processing[req._id]}
                              className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 transition text-xs font-medium"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(req._id)}
                              disabled={processing[req._id]}
                              className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 transition text-xs font-medium"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-indigo-600">
                            {req.adminRemark && "Remark added"}
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
      </Layout>

      {/* Remark Modal */}
      {showRemarkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-indigo-900 mb-4">
              {remarkData.action === "approve" ? "Approve Request" : "Reject Request"}
            </h3>

            <textarea
              rows="4"
              className="input-modern mb-4"
              placeholder="Add an optional remark..."
              value={remarkData.remark}
              onChange={(e) =>
                setRemarkData({ ...remarkData, remark: e.target.value })
              }
              maxLength={500}
            />

            <p className="text-xs text-indigo-600 mb-4">
              {remarkData.remark.length}/500 characters
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRemarkModal(false)}
                className="flex-1 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={submitAction}
                className={`flex-1 px-4 py-2 text-white rounded-lg font-medium transition ${
                  remarkData.action === "approve"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {remarkData.action === "approve" ? "Approve" : "Reject"}
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
