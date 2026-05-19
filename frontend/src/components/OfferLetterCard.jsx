import { Download, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../api";

const OfferLetterCard = ({ opportunityId, opportunityTitle }) => {
  const [canDownload, setCanDownload] = useState(false);
  const [hasOfferLetter, setHasOfferLetter] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Check offer letter availability and eligibility
  useEffect(() => {
    checkOfferLetterEligibility();
  }, [opportunityId]);

  const checkOfferLetterEligibility = async () => {
    if (!opportunityId) return;

    setIsChecking(true);
    try {
      const response = await api.get(`/offerLetters/check/${opportunityId}`);
      const data = response.data?.data || {};
      setCanDownload(data.canDownload || false);
      setHasOfferLetter(data.hasOfferLetter || false);
    } catch (err) {
      setCanDownload(false);
      setHasOfferLetter(false);
      console.error("[CHECK OFFER LETTER ERROR]", err);
    } finally {
      setIsChecking(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);

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
      toast.error(errorMessage);
      console.error("[DOWNLOAD OFFER LETTER ERROR]", err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Only render if conditions are met:
  // 1. Student is eligible (canDownload)
  // 2. Offer letter exists
  if (!canDownload || !hasOfferLetter || isChecking) {
    return null;
  }

  return (
    <div className="group rounded-lg sm:rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/60 to-emerald-100/40 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all duration-200">
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Left: Icon and Content */}
        <div className="rounded-lg bg-emerald-100 p-2 flex-shrink-0">
          <FileText size={20} className="text-emerald-600 sm:size-5" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-emerald-900 text-sm sm:text-base mb-1">
            Offer Letter
          </h3>
          <p className="text-xs sm:text-sm text-emerald-800 leading-5 sm:leading-6">
            Your placement offer letter is available for download.
          </p>
        </div>

        {/* Right: Download Button */}
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-semibold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0 whitespace-nowrap shadow-sm hover:shadow-md"
          title="Download your offer letter"
        >
          {isDownloading ? (
            <>
              <div className="animate-spin">
                <Download size={16} className="sm:size-4" />
              </div>
              <span className="hidden sm:inline">Downloading...</span>
            </>
          ) : (
            <>
              <Download size={16} className="sm:size-4" />
              <span className="hidden sm:inline">Download</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default OfferLetterCard;
