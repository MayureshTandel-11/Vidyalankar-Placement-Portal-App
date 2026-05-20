import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api, { extractApiError } from "../api";
import Layout from "../components/Layout";
import Footer from "../components/Footer";
import { PrimaryButton, SectionTitle, StatusMessage } from "../components/ui";
import { DEPARTMENTS } from "../constants/departments";

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
        <div className="flex items-center justify-center py-12">
          <div className="text-indigo-600">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Layout role="Student">
        <SectionTitle
          title="Department Change Request"
          subtitle="Request a change to your department. Only one pending request is allowed at a time."
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Section */}
          <div className="lg:col-span-2">
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-lg font-semibold text-indigo-900">Submit New Request</h3>

              <StatusMessage message={message} />
              <StatusMessage type="error" message={error} />

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Current Department (Read-only) */}
                <div>
                  <label className="block text-sm font-medium text-indigo-900 mb-2">
                    Current Department
                  </label>
                  <input
                    type="text"
                    value={currentDepartment}
                    disabled
                    className="input-modern bg-indigo-50 cursor-not-allowed"
                  />
                </div>

                {/* Requested Department */}
                <div>
                  <label className="block text-sm font-medium text-indigo-900 mb-2">
                    New Department <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={requestedDepartment}
                    onChange={(e) => setRequestedDepartment(e.target.value)}
                    disabled={hasPendingRequest || loading}
                    className="input-modern"
                  >
                    <option value="">Select a department</option>
                    {DEPARTMENTS.filter(d => d !== currentDepartment).map(dept => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-indigo-900 mb-2">
                    Reason (Optional)
                  </label>
                  <textarea
                    rows="4"
                    className="input-modern"
                    placeholder="Explain why you want to change your department..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={hasPendingRequest || loading}
                    maxLength={500}
                  />
                  <p className="text-xs text-indigo-600 mt-1">
                    {reason.length}/500 characters
                  </p>
                </div>

                {/* Submit Button */}
                <PrimaryButton
                  type="submit"
                  onClick={handleSubmit}
                  loading={loading}
                  disabled={loading || hasPendingRequest || !requestedDepartment}
                >
                  {hasPendingRequest ? "Pending Request Exists" : "Submit Request"}
                </PrimaryButton>

                {hasPendingRequest && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                    You have a pending request. Please wait for admin approval or rejection before submitting a new one.
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Status Section */}
          <div className="lg:col-span-1">
            <div className="glass-panel p-6">
              <h3 className="text-lg font-semibold text-indigo-900 mb-4">Your Requests</h3>

              {requests.length === 0 ? (
                <p className="text-sm text-indigo-600">No requests yet</p>
              ) : (
                <div className="space-y-3">
                  {requests.map((req) => (
                    <div key={req._id} className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-indigo-900">
                          {req.currentDepartment} → {req.requestedDepartment}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadgeClass(req.status)}`}>
                          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-xs text-indigo-600">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </p>
                      {req.adminRemark && (
                        <p className="text-xs text-indigo-700 mt-2 bg-white p-2 rounded border border-indigo-200">
                          <strong>Remark:</strong> {req.adminRemark}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Layout>
      <Footer />
    </>
  );
};

export default StudentDepartmentChangeRequestPage;
