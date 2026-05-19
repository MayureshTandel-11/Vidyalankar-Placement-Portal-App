import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api from "../api";
import { Download, Loader, Lock } from "lucide-react";

const OfferLetterDownloadButton = ({ opportunityId, opportunityTitle }) => {
  const [hasOfferLetter, setHasOfferLetter] = useState(false);
  const [canDownload, setCanDownload] = useState(false);
  const [studentStatus, setStudentStatus] = useState("Not Eligible");
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState("");

  // Check if offer letter exists and if student is eligible when component mounts or opportunityId changes
  useEffect(() => {
    checkOfferLetter();
  }, [opportunityId]);

  const checkOfferLetter = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await api.get(
        `/offerLetters/check/${opportunityId}`
      );
      const data = response.data?.data || {};
      setHasOfferLetter(data.hasOfferLetter || false);
      setCanDownload(data.canDownload || false);
      setStudentStatus(data.studentStatus || "Not Eligible");
    } catch (err) {
      // Silently fail if offer letter doesn't exist
      setHasOfferLetter(false);
      setCanDownload(false);
      setStudentStatus("Not Eligible");
      if (err.response?.status !== 404) {
        console.error("[CHECK OFFER LETTER ERROR]", err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setError("");

    try {
      const response = await api.get(
        `/offerLetters/download/${opportunityId}`,
        {
          responseType: "blob",
        }
      );

      // Create blob and download
      const blob = new Blob([response.data], {
        type: "application/pdf",
      });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      // Generate filename
      const fileName = `${opportunityTitle}_Offer_Letter.pdf`;

      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Offer letter downloaded successfully");
    } catch (err) {
      const errorMessage =
        err.response?.data?.message || "Failed to download offer letter";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("[DOWNLOAD OFFER LETTER ERROR]", err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return null;
  }

  // Only show button if:
  // 1. Student is eligible (canDownload = true)
  // 2. Offer letter exists
  if (!canDownload || !hasOfferLetter) {
    return null;
  }

  return (
    <button
      onClick={handleDownload}
      disabled={isDownloading}
      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
      title={`Download your offer letter (Status: ${studentStatus})`}
    >
      {isDownloading ? (
        <>
          <Loader size={16} className="animate-spin" />
          Downloading...
        </>
      ) : (
        <>
          <Download size={16} />
          Download Offer Letter
        </>
      )}
    </button>
  );
};

export default OfferLetterDownloadButton;
