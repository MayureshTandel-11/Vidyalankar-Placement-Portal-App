import { useState, useRef, useCallback } from "react";
import { Paperclip, Send, X, FileText, Archive, Loader2 } from "lucide-react";
import api from "../api";
import {
  EMAIL_REGEX,
  parseEmailList,
  validateEmailList,
  getApplicantsCsvFilename,
  getResumesZipFilename,
} from "../utils/applicantFiles";

const formatFileSize = (bytes) => {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const ApplicantEmailCompose = ({ opportunityId, announcementHeading }) => {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [errors, setErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("error");
  const [attachingCsv, setAttachingCsv] = useState(false);
  const [attachingZip, setAttachingZip] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef(null);

  const csvFilename = getApplicantsCsvFilename(announcementHeading);
  const zipFilename = getResumesZipFilename(announcementHeading);

  const hasAttachment = (name) => attachments.some((a) => a.name === name);

  const addAttachment = useCallback((file) => {
    if (!file) return;
    setAttachments((prev) => {
      const filtered = prev.filter((a) => a.name !== file.name);
      return [...filtered, file];
    });
    setErrors((prev) => ({ ...prev, attachments: undefined }));
  }, []);

  const removeAttachment = (name) => {
    setAttachments((prev) => prev.filter((a) => a.name !== name));
  };

  const handleAttachCsv = async () => {
    if (!opportunityId || attachingCsv) return;
    setAttachingCsv(true);
    setStatusMessage("");
    try {
      const response = await api.get(`/opportunities/${opportunityId}/applicants/download`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      addAttachment(new File([blob], csvFilename, { type: "text/csv" }));
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || "Failed to generate CSV attachment";
      setStatusType("error");
      setStatusMessage(msg);
    } finally {
      setAttachingCsv(false);
    }
  };

  const handleAttachZip = async () => {
    if (!opportunityId || attachingZip) return;
    setAttachingZip(true);
    setStatusMessage("");
    try {
      const response = await api.get(`/opportunities/${opportunityId}/applicants/resumes/download`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/zip" });
      addAttachment(new File([blob], zipFilename, { type: "application/zip" }));
    } catch (err) {
      let msg = "Failed to generate resume ZIP attachment";
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          msg = parsed.message || msg;
        } catch {
          /* use default */
        }
      } else {
        msg = err.response?.data?.message || err.message || msg;
      }
      setStatusType("error");
      setStatusMessage(msg);
    } finally {
      setAttachingZip(false);
    }
  };

  const handleChooseFiles = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => addAttachment(file));
    e.target.value = "";
  };

  const validateForm = () => {
    const nextErrors = {};
    const trimmedTo = to.trim();

    if (!trimmedTo) {
      nextErrors.to = "Receiver email is required";
    } else if (!EMAIL_REGEX.test(trimmedTo)) {
      nextErrors.to = "Receiver email is invalid";
    }

    const ccList = parseEmailList(cc);
    const ccError = validateEmailList(ccList, "CC");
    if (ccError) nextErrors.cc = ccError;

    if (!subject.trim()) {
      nextErrors.subject = "Subject is required";
    }
    if (!message.trim()) {
      nextErrors.message = "Message is required";
    }
    if (attachments.length === 0) {
      nextErrors.attachments = "At least one attachment is required";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSend = async () => {
    if (sending) return;
    setStatusMessage("");
    if (!validateForm()) return;

    setSending(true);
    try {
      const formData = new FormData();
      formData.append("to", to.trim());
      if (cc.trim()) formData.append("cc", cc.trim());
      formData.append("subject", subject.trim());
      formData.append("message", message.trim());
      attachments.forEach((file) => {
        formData.append("attachments", file, file.name);
      });

      await api.post(`/opportunities/${opportunityId}/applicants/email`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setStatusType("success");
      setStatusMessage("Email sent successfully");
      setTo("");
      setCc("");
      setSubject("");
      setMessage("");
      setAttachments([]);
      setErrors({});
    } catch (err) {
      setStatusType("error");
      setStatusMessage(err.response?.data?.message || err.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const isBusy = attachingCsv || attachingZip || sending;

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-slate-800">Send Email</h3>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          Compose and send applicant data to external recipients
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">To:</label>
          <input
            type="email"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setErrors((prev) => ({ ...prev, to: undefined }));
            }}
            disabled={isBusy}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50"
            placeholder="recipient@example.com"
          />
          {errors.to && <p className="mt-1 text-xs text-red-600">{errors.to}</p>}
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Cc:</label>
          <input
            type="text"
            value={cc}
            onChange={(e) => {
              setCc(e.target.value);
              setErrors((prev) => ({ ...prev, cc: undefined }));
            }}
            disabled={isBusy}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50"
            placeholder="cc1@example.com, cc2@example.com"
          />
          {errors.cc && <p className="mt-1 text-xs text-red-600">{errors.cc}</p>}
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Subject:</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setErrors((prev) => ({ ...prev, subject: undefined }));
            }}
            disabled={isBusy}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50"
            placeholder="Email subject"
          />
          {errors.subject && <p className="mt-1 text-xs text-red-600">{errors.subject}</p>}
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Message:</label>
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setErrors((prev) => ({ ...prev, message: undefined }));
            }}
            disabled={isBusy}
            rows={5}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50 resize-y"
            placeholder="Write your message here..."
          />
          {errors.message && <p className="mt-1 text-xs text-red-600">{errors.message}</p>}
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-2">Attachments:</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAttachCsv}
              disabled={isBusy || hasAttachment(csvFilename)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {attachingCsv ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              {attachingCsv ? "Generating CSV..." : "[CSV]"}
            </button>
            <button
              type="button"
              onClick={handleAttachZip}
              disabled={isBusy || hasAttachment(zipFilename)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {attachingZip ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
              {attachingZip ? "Generating ZIP..." : "[ZIP]"}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Paperclip size={14} />
              Choose Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleChooseFiles}
              disabled={isBusy}
            />
          </div>
          {errors.attachments && <p className="mt-1 text-xs text-red-600">{errors.attachments}</p>}

          {attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {attachments.map((file) => (
                <div
                  key={file.name}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs sm:text-sm text-slate-700"
                >
                  <Paperclip size={12} className="text-slate-500 shrink-0" />
                  <span className="truncate max-w-[180px]" title={file.name}>
                    {file.name}
                  </span>
                  <span className="text-slate-400 text-xs">({formatFileSize(file.size)})</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(file.name)}
                    disabled={isBusy}
                    className="text-slate-400 hover:text-red-600 disabled:opacity-50"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`rounded-lg border px-3 py-2 text-xs sm:text-sm ${
            statusType === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {statusMessage}
        </div>
      )}

      <button
        type="button"
        onClick={handleSend}
        disabled={isBusy}
        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {sending ? "Sending..." : "Send"}
      </button>
    </div>
  );
};

export default ApplicantEmailCompose;
