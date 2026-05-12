import { useState, useEffect, useRef, Component } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { AlertTriangle, CheckCircle2, FileDown } from "lucide-react";
import api, { extractApiData, extractApiError, getAccessToken } from "../api";
import Layout from "../components/Layout";
import Footer from "../components/Footer";
import StudentProfileForm from "../components/StudentProfileForm";
import { PrimaryButton, StatusMessage } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { generateStudentProfilePDF } from "../utils/pdfGenerator";

// Error Boundary Component
class ProfileErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Profile Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-4xl py-8">
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-red-50 p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-red-600" />
            <div>
              <h2 className="text-xl font-bold text-red-900">Something went wrong</h2>
              <p className="mt-2 text-sm text-red-700">
                {this.state.error?.message || "Unable to load your profile. Please try again."}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-red-600 px-6 py-2 text-white hover:bg-red-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Loading Skeleton Component
const ProfileLoadingSkeleton = () => (
  <div className="space-y-6">
    <div className="space-y-2">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-4 w-72 animate-pulse rounded-lg bg-slate-200" />
    </div>

    <div className="space-y-3">
      <div className="h-64 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-40 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-32 animate-pulse rounded-lg bg-slate-200" />
    </div>
  </div>
);

// Progress Indicator Component
const ProfileProgressIndicator = ({ profile }) => {
  const calculateProgress = () => {
    let completed = 0;
    const weights = {
      academicInfo: 25,
      technicalSkills: 25,
      professionalLinks: 20,
      resume: 15,
      certifications: 7.5,
      projects: 7.5,
    };

    // Academic Info - Required
    if (
      profile?.academicInfo?.year &&
      profile?.academicInfo?.sscPercentage &&
      profile?.academicInfo?.hscPercentage &&
      profile?.academicInfo?.cgpa
    ) {
      completed += weights.academicInfo;
    }

    // Technical Skills - Required
    if (profile?.technicalSkills && profile.technicalSkills.length > 0) {
      completed += weights.technicalSkills;
    }

    // Professional Links - Optional but recommended
    if (
      profile?.professionalLinks?.linkedinProfile ||
      profile?.professionalLinks?.githubProfile ||
      profile?.professionalLinks?.almaShineProfile
    ) {
      completed += weights.professionalLinks;
    }

    // Resume - Optional but recommended
    if (profile?.resume?.resumeUrl) {
      completed += weights.resume;
    }

    // Certifications - Optional
    if (profile?.certifications && profile.certifications.length > 0) {
      completed += weights.certifications;
    }

    // Projects - Optional
    if (profile?.projects && profile.projects.length > 0) {
      completed += weights.projects;
    }

    return Math.min(Math.round(completed), 100);
  };

  const progress = calculateProgress();
  const isComplete = progress >= 75;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Profile Completion</h3>
        <div className={`text-2xl font-bold ${isComplete ? "text-emerald-600" : "text-amber-600"}`}>
          {progress}%
        </div>
      </div>

      <div className="mb-4 h-3 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full transition-all duration-300 ${isComplete ? "bg-emerald-500" : "bg-amber-500"}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${profile?.academicInfo?.year && profile?.academicInfo?.sscPercentage && profile?.academicInfo?.hscPercentage && profile?.academicInfo?.cgpa ? "bg-emerald-500" : "bg-slate-300"}`} />
          <span className="text-slate-700">Academic Information (Required) - 25%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${profile?.technicalSkills?.length > 0 ? "bg-emerald-500" : "bg-slate-300"}`} />
          <span className="text-slate-700">Technical Skills (Required) - 25%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${profile?.professionalLinks?.linkedinProfile || profile?.professionalLinks?.githubProfile ? "bg-emerald-500" : "bg-slate-300"}`} />
          <span className="text-slate-700">Professional Links (Recommended) - 20%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${profile?.resume?.resumeUrl ? "bg-emerald-500" : "bg-slate-300"}`} />
          <span className="text-slate-700">Resume (Recommended) - 15%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${profile?.certifications?.length > 0 || profile?.projects?.length > 0 ? "bg-emerald-500" : "bg-slate-300"}`} />
          <span className="text-slate-700">Certifications & Projects (Optional) - 15%</span>
        </div>
      </div>

      {!isComplete && (
        <div className="mt-4 flex items-gap-2 gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle size={18} className="flex-shrink-0" />
          <p>
            <span className="font-semibold">Profile incomplete.</span> Complete at least 75% of your profile to maximize placement opportunities.
          </p>
        </div>
      )}

      {isComplete && (
        <div className="mt-4 flex items-gap-2 gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 size={18} className="flex-shrink-0" />
          <p>
            <span className="font-semibold">Great!</span> Your profile is complete. Keep it updated for better opportunities.
          </p>
        </div>
      )}
    </div>
  );
};

// Breadcrumb Navigation Component
const BreadcrumbNav = () => (
  <nav className="flex items-center gap-2 text-sm">
    <a href="/" className="text-red-600 hover:text-red-700">
      Home
    </a>
    <span className="text-slate-400">/</span>
    <span className="text-slate-600">My Profile</span>
  </nav>
);

// Main Page Component
const StudentProfilePage = () => {
  const navigate = useNavigate();
  const { isHydrated, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveAllLoading, setSaveAllLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const formRef = useRef(null);

  // Load profile data after auth is hydrated and token is available
  useEffect(() => {
    if (!isHydrated) return;
    if (!token && !getAccessToken()) {
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        const response = await api.get("/student/profile");
        const data = extractApiData(response);
        setProfile(data?.profile);
      } catch (err) {
        setError(extractApiError(err, "Failed to load profile"));
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [isHydrated, token]);

  // Handle unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle keyboard shortcuts (Ctrl+S or Cmd+S)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        // Trigger save all sections
        // This would need to be coordinated with the form component
        handleSaveAll();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSaveAll = async () => {
    if (!formRef.current?.saveAll) return;
    setSaveAllLoading(true);
    try {
      const success = await formRef.current.saveAll();
      if (success) {
        try {
          const response = await api.get("/student/profile");
          const data = extractApiData(response);
          setProfile(data?.profile);
          setHasUnsavedChanges(false);
          toast.success("Profile saved successfully");
        } catch (err) {
          console.error("Error reloading profile:", err);
          toast.error("Saved, but failed to refresh profile data");
        }
      }
    } finally {
      setSaveAllLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!profile) {
      toast.error("Profile not loaded yet");
      return;
    }
    setPdfLoading(true);
    try {
      const response = await api.get("/student/profile");
      const data = extractApiData(response);
      const latest = data?.profile || profile;
      generateStudentProfilePDF(latest, latest.studentId);
      toast.success("Profile PDF downloaded");
    } catch (e) {
      try {
        generateStudentProfilePDF(profile, profile.studentId);
        toast.success("Profile PDF downloaded");
      } catch (e2) {
        toast.error(e2?.message || "Could not generate PDF");
      }
    } finally {
      setPdfLoading(false);
    }
  };

  // Handle form changes and refresh profile
  const handleFormChange = async () => {
    setHasUnsavedChanges(true);
    // Reload profile data to update progress indicator
    try {
      const response = await api.get("/student/profile");
      const data = extractApiData(response);
      setProfile(data?.profile);
    } catch (err) {
      console.error("Error reloading profile:", err);
    }
  };

  const handleNavigation = (destination) => {
    if (hasUnsavedChanges) {
      if (window.confirm("You have unsaved changes. Are you sure you want to leave?")) {
        navigate(destination);
      }
    } else {
      navigate(destination);
    }
  };

  if (loading) {
    return (
      <Layout role="Student">
        <ProfileLoadingSkeleton />
      </Layout>
    );
  }

  return (
    <ProfileErrorBoundary>
      <>
        <Layout role="Student">
        <section className="space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900">My Profile</h1>
            <p className="text-slate-600">
              Build your professional profile to attract more placement opportunities
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
              <AlertTriangle size={20} className="flex-shrink-0" />
              <p>{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="ml-auto text-sm font-medium text-red-600 hover:text-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {/* Progress Indicator */}
          {profile && <ProfileProgressIndicator profile={profile} />}

          {/* Form */}
          {profile && (
            <StudentProfileForm ref={formRef} department={profile?.department} onFormChange={handleFormChange} />
          )}

          {/* Bottom Actions */}
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-slate-200 bg-white p-6 sm:flex-row sm:justify-between">
            <div className="text-center text-sm text-slate-600 sm:text-left">
              <p>Use <span className="inline-block rounded bg-slate-100 px-2 py-1 font-mono text-xs">Ctrl+S</span> (Windows) or <span className="inline-block rounded bg-slate-100 px-2 py-1 font-mono text-xs">Cmd+S</span> (Mac) to save</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => handleNavigation("/dashboard")}
                className="rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-50"
              >
                Back to Dashboard
              </button>
              <PrimaryButton
                type="button"
                onClick={handleDownloadPdf}
                disabled={pdfLoading || !profile}
                className="rounded-lg px-6 py-3 inline-flex items-center justify-center gap-2"
              >
                <FileDown size={18} />
                {pdfLoading ? "Preparing PDF…" : "Download profile PDF"}
              </PrimaryButton>
              <PrimaryButton
                type="button"
                onClick={handleSaveAll}
                disabled={saveAllLoading}
                className="rounded-lg px-6 py-3"
              >
                {saveAllLoading ? "Saving…" : "Save & Continue"}
              </PrimaryButton>
            </div>
          </div>

          {/* Info Footer */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
            <p>Your profile information is securely stored and only shared with authorized recruiters and your institute.</p>
          </div>
        </section>
        </Layout>
        <Footer />
      </>
    </ProfileErrorBoundary>
  );
};

export default StudentProfilePage;
