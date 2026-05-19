import { useState, useCallback } from "react";
import { Download, Upload, Loader, AlertCircle, CheckCircle2 } from "lucide-react";
import { PrimaryButton } from "./ui";
import OfferLetterUpload from "./OfferLetterUpload";

const ResultTable = ({ resultStudents, opportunityId, onUploadSuccess }) => {
  const [openUploadModal, setOpenUploadModal] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadError, setDownloadError] = useState("");

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case "Placed":
        return "bg-green-100 text-green-800 border-green-300";
      case "HR Cleared":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "Selected":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      default:
        return "bg-slate-100 text-slate-800 border-slate-300";
    }
  };

  if (!resultStudents || resultStudents.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
        <AlertCircle size={40} className="mx-auto mb-3 text-slate-400" />
        <p className="text-sm text-slate-600">
          No students in result section yet. Students will appear here once they are selected for HR interviews.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left font-semibold text-slate-700">
                Student Name
              </th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">
                Department
              </th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">
                Email
              </th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">
                Status
              </th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {resultStudents.map((student) => (
              <tr
                key={student.studentId}
                className="border-b border-slate-100 hover:bg-slate-50 transition"
              >
                <td className="px-4 py-3 font-medium text-slate-900">
                  {student.studentName}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {student.studentDepartment}
                </td>
                <td className="px-4 py-3 text-slate-600 truncate">
                  {student.studentEmail}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${getStatusBadgeColor(
                      student.status
                    )}`}
                  >
                    {student.status === "Placed" && (
                      <CheckCircle2 size={14} />
                    )}
                    {student.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    {/* Upload Button */}
                    <button
                      onClick={() => setOpenUploadModal(student.studentId)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 hover:text-indigo-800 text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Upload offer letter"
                    >
                      <Upload size={14} />
                      <span className="hidden sm:inline">Upload</span>
                    </button>

                    {/* Download Button */}
                    {student.offerLetterId ? (
                      <button
                        onClick={async () => {
                          setDownloadingId(student.studentId);
                          setDownloadError("");
                          try {
                            const { downloadOfferLetter } = await import(
                              "../services/opportunitiesService"
                            );
                            await downloadOfferLetter(student.offerLetterId);
                          } catch (err) {
                            setDownloadError(
                              err.message || "Failed to download offer letter"
                            );
                          } finally {
                            setDownloadingId(null);
                          }
                        }}
                        disabled={downloadingId === student.studentId}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 hover:text-green-800 text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Download offer letter"
                      >
                        {downloadingId === student.studentId ? (
                          <>
                            <Loader size={14} className="animate-spin" />
                            <span className="hidden sm:inline">...</span>
                          </>
                        ) : (
                          <>
                            <Download size={14} />
                            <span className="hidden sm:inline">Download</span>
                          </>
                        )}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {downloadError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs sm:text-sm text-red-800">
          <AlertCircle size={16} />
          <span>{downloadError}</span>
        </div>
      )}

      {/* Upload Modal */}
      {openUploadModal && (
        <OfferLetterUpload
          opportunityId={opportunityId}
          studentId={openUploadModal}
          studentName={
            resultStudents.find((s) => s.studentId === openUploadModal)
              ?.studentName
          }
          onClose={() => setOpenUploadModal(null)}
          onSuccess={() => {
            setOpenUploadModal(null);
            onUploadSuccess?.();
          }}
        />
      )}
    </div>
  );
};

export default ResultTable;
