import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api from "../api";
import { Download, Upload, X, Trash2, AlertCircle, CheckCircle, Loader } from "lucide-react";
import { Spinner } from "./ui";

const ResultSectionOfferLetters = ({ opportunityId }) => {
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadingStudentId, setUploadingStudentId] = useState(null);
  const [deletingStudentId, setDeletingStudentId] = useState(null);

  // Fetch selected students on component mount
  useEffect(() => {
    fetchSelectedStudents();
  }, [opportunityId]);

  const fetchSelectedStudents = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await api.get(
        `/offerLetters/selected-students/${opportunityId}`
      );
      setSelectedStudents(response.data?.data || []);
    } catch (err) {
      const errorMessage =
        err.response?.data?.message || "Failed to fetch selected students";
      setError(errorMessage);
      console.error("[FETCH SELECTED STUDENTS ERROR]", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (studentId, file) => {
    if (!file) return;

    // Validate file
    if (!file.type || file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must not exceed 5MB");
      return;
    }

    setUploadingStudentId(studentId);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await api.post(
        `/offerLetters/upload/${opportunityId}/${studentId}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      toast.success("Offer letter uploaded successfully");
      // Update student list to reflect the upload
      fetchSelectedStudents();
    } catch (err) {
      const errorMessage =
        err.response?.data?.message || "Failed to upload offer letter";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("[UPLOAD OFFER LETTER ERROR]", err);
    } finally {
      setUploadingStudentId(null);
    }
  };

  const handleDeleteOfferLetter = async (studentId) => {
    if (!window.confirm("Are you sure you want to delete this offer letter?")) {
      return;
    }

    setDeletingStudentId(studentId);
    setError("");

    try {
      await api.delete(
        `/offerLetters/${opportunityId}/${studentId}`
      );
      toast.success("Offer letter deleted successfully");
      fetchSelectedStudents();
    } catch (err) {
      const errorMessage =
        err.response?.data?.message || "Failed to delete offer letter";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("[DELETE OFFER LETTER ERROR]", err);
    } finally {
      setDeletingStudentId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (selectedStudents.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
        <p className="text-sm text-slate-600">
          No students have been selected for this opportunity yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle size={18} className="mt-0.5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        {selectedStudents.map((student) => (
          <div
            key={student.studentId}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center justify-between gap-4">
              {/* Student Info */}
              <div className="flex items-center gap-4 flex-1">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm">
                  {student.name?.charAt(0)?.toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-slate-900">
                    {student.name}
                  </h4>
                  <p className="text-xs text-slate-600">
                    {student.studentId} • {student.email}
                  </p>
                  {student.phone && student.phone !== "N/A" && (
                    <p className="text-xs text-slate-600">{student.phone}</p>
                  )}
                </div>
              </div>

              {/* Offer Letter Status & Actions */}
              <div className="flex items-center gap-3">
                {student.hasOfferLetter ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-medium border border-emerald-300">
                      <CheckCircle size={14} />
                      Uploaded
                    </div>
                    {student.offerLetterInfo && (
                      <button
                        onClick={() =>
                          handleDeleteOfferLetter(student.studentId)
                        }
                        disabled={deletingStudentId === student.studentId}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 hover:text-red-700 transition disabled:opacity-50"
                        title="Delete offer letter"
                      >
                        {deletingStudentId === student.studentId ? (
                          <Loader size={18} className="animate-spin" />
                        ) : (
                          <Trash2 size={18} />
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-medium border border-slate-300 transition">
                      {uploadingStudentId === student.studentId ? (
                        <>
                          <Loader size={14} className="animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload size={14} />
                          Upload PDF
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload(student.studentId, file);
                        }
                        // Reset input so same file can be selected again
                        e.target.value = "";
                      }}
                      disabled={uploadingStudentId === student.studentId}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Upload timestamp */}
            {student.hasOfferLetter && student.offerLetterInfo && (
              <p className="text-xs text-slate-500 mt-2 ml-14">
                Uploaded on{" "}
                {new Date(
                  student.offerLetterInfo.uploadedAt
                ).toLocaleDateString()}{" "}
                • {student.offerLetterInfo.fileName}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResultSectionOfferLetters;
