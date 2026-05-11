import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";


import { motion as Motion } from "framer-motion";
import { Building2, CalendarClock, ExternalLink, GraduationCap, Pencil, Sparkles, Trash2, Badge, FileText, User, Clock, Code, Calendar, Mail, AlertTriangle, X } from "lucide-react";
import { Modal, PrimaryButton, EmptyState, Spinner, StatusMessage } from "./ui";
import { DEPARTMENTS, OPPORTUNITY_BROADCAST_ALL } from "../constants/departments";
import { useAuth } from "../context/AuthContext";
import { useOpportunities } from "../context/OpportunitiesContext";
import { getSocket } from "../utils/socket";
import OpportunityTimeline from "./OpportunityTimeline";
import OpportunityAttendance from "./OpportunityAttendance";
import { getApplicantsCount, getApplicants } from "../services/opportunitiesService";

const toLabel = (value) => {
  if (!value) return "Not specified";
  if (value === OPPORTUNITY_BROADCAST_ALL) return "All Departments";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const getDepartmentList = (department) => {
  if (department === OPPORTUNITY_BROADCAST_ALL) return DEPARTMENTS;
  if (Array.isArray(department)) return department;
  if (typeof department === "string") {
    return department.split(",").map((d) => d.trim()).filter(Boolean);
  }
  return [];
};

const isExpired = (value) => {
  try {
    const lastMidnight = new Date(value);
    lastMidnight.setHours(0, 0, 0, 0); // Normalize to start of day

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0); // Today at midnight

    return todayMidnight > lastMidnight;
  } catch {
    return false;
  }
};

const OpportunityCard = ({
  opportunity,
  className = "",
  canManage = false,
  hasApplied = false,
  onApply = () => {},
  onEdit,
  onDelete,
  editDisabled = false,
  editLoading = false,
  deleteLoading = false,
  applicantCount = null,
}) => {
  const { user } = useAuth();
  const socket = getSocket();
  const { fetchTimeline, invalidateTimelineCache } = useOpportunities();
  const [isOpen, setIsOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [localApplied, setLocalApplied] = useState(hasApplied);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("details");
  const [activeStages, setActiveStages] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [applicantsLoading, setApplicantsLoading] = useState(false);
  const [applicantsError, setApplicantsError] = useState("");
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);
  const [attendanceRefreshKey, setAttendanceRefreshKey] = useState(0);
  const [applicantsRefreshKey, setApplicantsRefreshKey] = useState(0);
  const effectiveApplied = localApplied || hasApplied;

  const userRole = user?.role || "student";
  const userId = user?._id;

  const canEditDelete =
    userRole === "admin" ||
    (userRole === "faculty" && String(opportunity.createdBy) === String(userId));

  const isFacultyOwner =
    userRole === "faculty" && String(opportunity.createdBy) === String(userId);

  const archived = opportunity.status === "archived" || isExpired(opportunity.lastDate);
  const isDisabled = archived || effectiveApplied;
  const isStudent = userRole === "student";

  // Define shouldShowApplicants before using it
  const shouldShowApplicants =
    (user?.role === "admin") ||
    (user?.role === "faculty" && String(opportunity.createdBy) === String(user?._id));

  // Function to refresh active stages
  const refreshActiveStages = useCallback(async () => {
    if (!opportunity?._id) return;
    try {
      const result = await fetchTimeline(opportunity._id);
      const activeStagesFromFetch = Array.isArray(result?.activeStages) ? result.activeStages : [];
      console.log('[OpportunityCard] Refreshed activeStages:', activeStagesFromFetch);
      if (activeStagesFromFetch.length >= 0) {
        setActiveStages(activeStagesFromFetch);
        // Increment refresh keys to trigger re-renders in child components
        setTimelineRefreshKey(prev => prev + 1);
        setAttendanceRefreshKey(prev => prev + 1);
      }
    } catch (err) {
      console.error('[OpportunityCard] Failed to refresh timeline:', err);
    }
  }, [opportunity?._id, fetchTimeline]);

  // Function to refresh applicants
  const refreshApplicants = useCallback(async () => {
    if (!opportunity?._id || !shouldShowApplicants) return;
    setApplicantsLoading(true);
    setApplicantsError("");
    try {
      const data = await getApplicants(opportunity._id);
      setApplicants(Array.isArray(data) ? data : []);
      setApplicantsRefreshKey(prev => prev + 1);
    } catch (err) {
      setApplicantsError(err.message || "Unable to load applicants. Please try again.");
    } finally {
      setApplicantsLoading(false);
    }
  }, [opportunity?._id, shouldShowApplicants]);

  useEffect(() => {
    if (!isOpen || !opportunity?._id || !socket) return;

    socket.emit("join:opportunity", { opportunityId: opportunity._id });

    return () => {
      if (socket) {
        socket.emit("leave:opportunity", { opportunityId: opportunity._id });
      }
    };
  }, [isOpen, opportunity?._id, socket]);

  useEffect(() => {
    if (!socket) return;

    const handleTimelineEntry = ({ activeStages: newActiveStages }) => {
      console.log('[OpportunityCard Socket] timeline:new_entry received with activeStages:', newActiveStages);
      if (opportunity?._id) {
        invalidateTimelineCache(opportunity._id);
        refreshActiveStages();
      }
    };

    socket.on("timeline:new_entry", handleTimelineEntry);

    return () => {
      socket.off("timeline:new_entry", handleTimelineEntry);
    };
  }, [socket, opportunity?._id, refreshActiveStages, invalidateTimelineCache]);

  useEffect(() => {
    if (!isOpen || !opportunity?._id) return;
    refreshActiveStages();
  }, [isOpen, opportunity?._id, refreshActiveStages]);

  useEffect(() => {
    if (!isOpen || !opportunity?._id || !shouldShowApplicants) return;
    refreshApplicants();
  }, [isOpen, opportunity?._id, shouldShowApplicants, refreshApplicants]);

  const handleApply = async () => {
    if (applying || effectiveApplied) return;
    setApplying(true);
    setError("");
    try {
      await onApply(opportunity._id);
      setLocalApplied(true);
      setError("");
    } catch (error) {
      console.error("Apply failed:", error);
      setError(error.message || "Failed to apply. Please try again.");
    } finally {
      setApplying(false);
    }
  };

  const getTabs = () => {
    const tabs = ["details", "status-timeline"];
    if (user?.role === "faculty" || user?.role === "admin") {
      tabs.push("attendance");
    }
    if (shouldShowApplicants) {
      tabs.push("applicants");
    }
    return tabs;
  };

  const tabs = getTabs();

  return (
    <>
      <Motion.article
        whileHover={isDisabled ? {} : { y: -4 }}
        onClick={isDisabled ? undefined : () => setIsOpen(true)}
        onKeyDown={isDisabled ? undefined : (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        tabIndex={isDisabled ? undefined : 0}
        role={isDisabled ? undefined : "button"}
        aria-disabled={isDisabled}
        className={`group relative cursor-pointer overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white/65 shadow-[0_16px_36px_-22px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-all duration-200 hover:shadow-[0_22px_44px_-16px_rgba(99,102,641,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${className}`}
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-sky-500 to-cyan-400" />
        <div className="space-y-3 sm:space-y-4 p-3.5 sm:p-5">
          <div className="flex flex-col xs:flex-row items-start gap-2 xs:gap-3 xs:justify-between">
            <h3 className="clamp-2 text-base sm:text-lg font-semibold leading-6 text-slate-800">{opportunity.announcementHeading}</h3>
            <div className="flex flex-wrap items-center gap-1.5 xs:gap-2 flex-shrink-0">
              <span className="rounded-full border border-indigo-200/80 bg-indigo-50 px-2 xs:px-2.5 py-0.5 xs:py-1 text-xs font-medium text-indigo-700 whitespace-nowrap">
                {opportunity.type}
              </span>
              <span
                className={`rounded-full border px-2 xs:px-2.5 py-0.5 xs:py-1 text-xs font-medium whitespace-nowrap ${
                  archived
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : effectiveApplied
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {archived ? "Archived" : effectiveApplied ? "Applied" : "Active"}
              </span>
            </div>
          </div>

          <p className="clamp-2 text-xs sm:text-sm leading-5 sm:leading-6 text-slate-600">{opportunity.description}</p>

          <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-slate-600">
            <p className="flex items-start gap-2">
              <GraduationCap size={14} className="mt-0.5 shrink-0 text-indigo-600 sm:size-4" aria-hidden="true" />
              <span className="min-w-0">
                <span className="font-semibold text-slate-700">Eligibility:</span> <span className="break-words">{toLabel(opportunity.eligibilityCriteria)}</span>
              </span>
            </p>
            <p className="flex items-start gap-2">
              <CalendarClock size={14} className="mt-0.5 shrink-0 text-sky-600 sm:size-4" aria-hidden="true" />
              <span className="min-w-0">
                <span className="font-semibold text-slate-700">Last Date:</span>{" "}
                <span className="break-words">{new Date(opportunity.lastDate).toLocaleDateString()}</span>
              </span>
            </p>
            <p className="flex items-start gap-2">
              <Building2 size={14} className="mt-0.5 shrink-0 text-cyan-600 sm:size-4" aria-hidden="true" />
              <span className="min-w-0">
                <span className="font-semibold text-slate-700">Departments:</span> <span className="break-words">{opportunity.department === OPPORTUNITY_BROADCAST_ALL ? "All Departments" : toLabel(opportunity.department)}</span>
              </span>
            </p>
            {opportunity.technicalSkills && opportunity.technicalSkills.length > 0 && (
              <p className="flex items-start gap-2">
                <Code size={14} className="mt-0.5 shrink-0 text-purple-600 sm:size-4" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="font-semibold text-slate-700">Skills:</span> <span className="break-words">{opportunity.technicalSkills.slice(0, 3).join(", ")}{opportunity.technicalSkills.length > 3 ? ` +${opportunity.technicalSkills.length - 3}` : ""}</span>
                </span>
              </p>
            )}
          </div>

          {!isStudent && applicantCount !== null && (
            <div className="flex items-center gap-2 rounded-lg bg-indigo-50/60 px-2.5 sm:px-3 py-1.5 sm:py-2 border border-indigo-200/60">
              <User size={13} className="text-indigo-600 flex-shrink-0 sm:size-4" />
              <span className="text-xs sm:text-sm font-medium text-indigo-700">{applicantCount} Applicant{applicantCount !== 1 ? 's' : ''}</span>
            </div>
          )}

          <PrimaryButton className="w-full text-xs sm:text-sm" onClick={() => setIsOpen(true)}>
            View Details
          </PrimaryButton>
        </div>
        {canManage && canEditDelete ? (
          <div className="pointer-events-none absolute right-2 sm:right-3 top-2 sm:top-3 flex gap-1.5 xs:gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <button
              type="button"
              disabled={archived || editDisabled || editLoading || deleteLoading}
              onClick={(event) => {
                event.stopPropagation();
                if (archived || editDisabled || editLoading || deleteLoading) return;
                onEdit?.(opportunity);
              }}
              className={`pointer-events-auto rounded-lg border bg-white/85 p-1.5 xs:p-2 transition text-xs sm:text-sm ${
                archived || editDisabled || editLoading || deleteLoading
                  ? "cursor-not-allowed border-slate-200 text-slate-300"
                  : "border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
              }`}
              aria-label="Edit opportunity"
              title={archived ? "Cannot edit archived opportunities" : "Edit opportunity"}
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              disabled={archived || editLoading || deleteLoading}
              onClick={(event) => {
                event.stopPropagation();
                if (archived || editLoading || deleteLoading) return;
                onDelete?.(opportunity);
              }}
              className={`pointer-events-auto rounded-lg border bg-white/85 p-2 transition ${
                archived || editLoading || deleteLoading
                  ? "cursor-not-allowed border-slate-200 text-slate-300"
                  : "border-slate-200 text-slate-600 hover:border-rose-200 hover:text-rose-600"
              }`}
              aria-label="Delete opportunity"
              title={archived ? "Cannot delete archived opportunities" : "Delete opportunity"}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ) : null}
      </Motion.article>
      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={opportunity.announcementHeading}
        subtitle=""
      >
        {/* Responsive Tabs */}
        <div className="mb-6 border-b border-slate-200 -mx-4 sm:-mx-6 px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            {tabs.map((tab) => {
              const tabLabel = {
                "details": "Details",
                "status-timeline": "Timeline",
                "attendance": "Attendance",
                "applicants": "Applicants",
              }[tab];

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tabLabel}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6 min-h-96">
          {/* Details Tab */}
          {activeTab === "details" && (
            <div className="space-y-4 sm:space-y-6 text-slate-700">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold ${
                  opportunity.type === "Internship"
                    ? "bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 border border-blue-200"
                    : "bg-gradient-to-r from-emerald-100 to-emerald-50 text-emerald-700 border border-emerald-200"
                }`}>
                  <Badge size={14} className="sm:size-4" />
                  {opportunity.type}
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold ${
                  archived
                    ? "bg-rose-100 text-rose-700 border border-rose-200"
                    : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                }`}>
                  <span className={`inline-block h-2 w-2 rounded-full ${archived ? "bg-rose-500" : "bg-emerald-500"}`}></span>
                  {archived ? "Archived" : "Active"}
                </span>
              </div>

              {/* Description Card */}
              <div className="rounded-lg sm:rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50/80 to-slate-100/80 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex items-start gap-3">
                  <FileText size={18} className="shrink-0 text-slate-600 mt-1 sm:size-5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-800 mb-2 text-sm sm:text-base">Description</h4>
                    <p className="leading-6 sm:leading-7 text-slate-700 text-sm">{opportunity.description || "No description provided."}</p>
                  </div>
                </div>
              </div>

              {/* Info Grid - Responsive */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Eligibility */}
                <div className="group rounded-lg sm:rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/60 to-indigo-100/40 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all duration-200">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="rounded-lg bg-indigo-100 p-2 flex-shrink-0">
                      <GraduationCap size={16} className="text-indigo-600 sm:size-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-indigo-900 text-sm sm:text-base">Eligibility</p>
                      <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-indigo-800 leading-5 sm:leading-6 break-words">{toLabel(opportunity.eligibilityCriteria)}</p>
                    </div>
                  </div>
                </div>

                {/* Deadline */}
                <div className="group rounded-lg sm:rounded-2xl border border-orange-200/60 bg-gradient-to-br from-orange-50/60 to-orange-100/40 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-orange-300 transition-all duration-200">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="rounded-lg bg-orange-100 p-2 flex-shrink-0">
                      <CalendarClock size={16} className="text-orange-600 sm:size-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-orange-900 text-sm sm:text-base">Deadline</p>
                      <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-orange-800 font-medium">{new Date(opportunity.lastDate).toLocaleDateString("en-US", {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                      })}</p>
                      <p className="text-xs text-orange-700 mt-0.5 sm:mt-1">
                        {Math.ceil((new Date(opportunity.lastDate) - new Date()) / (1000 * 60 * 60 * 24))} days left
                      </p>
                    </div>
                  </div>
                </div>

                {/* Departments - Full Width */}
                <div className="sm:col-span-2 group rounded-lg sm:rounded-2xl border border-cyan-200/60 bg-gradient-to-br from-cyan-50/60 to-cyan-100/40 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-cyan-300 transition-all duration-200">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="rounded-lg bg-cyan-100 p-2 flex-shrink-0">
                      <Building2 size={16} className="text-cyan-600 sm:size-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-cyan-900 text-sm sm:text-base">Departments</p>
                      <div className="mt-2 sm:mt-3 flex flex-wrap gap-1.5 sm:gap-2">
                        {getDepartmentList(opportunity.department).map((dept, idx) => (
                          <span key={idx} className="rounded-full px-2 sm:px-3 py-1 sm:py-1.5 bg-cyan-200/60 text-cyan-800 text-xs font-medium border border-cyan-300/50 whitespace-nowrap">
                            {dept}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Technical Skills */}
                {opportunity.technicalSkills && opportunity.technicalSkills.length > 0 ? (
                  <div className="sm:col-span-2 group rounded-lg sm:rounded-2xl border border-purple-200/60 bg-gradient-to-br from-purple-50/60 to-purple-100/40 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-purple-300 transition-all duration-200">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="rounded-lg bg-purple-100 p-2 flex-shrink-0">
                        <Code size={16} className="text-purple-600 sm:size-4.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-purple-900 text-sm sm:text-base">Required Skills</p>
                        <div className="mt-2 sm:mt-3 flex flex-wrap gap-1.5 sm:gap-2">
                          {opportunity.technicalSkills.map((skill, idx) => (
                            <span key={idx} className="rounded-full px-2 sm:px-3 py-1 sm:py-1.5 bg-purple-200/60 text-purple-800 text-xs font-medium border border-purple-300/50 whitespace-nowrap">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Last Updated */}
                <div className="group rounded-lg sm:rounded-2xl border border-slate-200/60 bg-gradient-to-br from-slate-50/60 to-slate-100/40 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="rounded-lg bg-slate-100 p-2 flex-shrink-0">
                      <Clock size={16} className="text-slate-600 sm:size-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm sm:text-base">Updated</p>
                      <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-slate-700 break-words">{opportunity.updatedAt ? new Date(opportunity.updatedAt).toLocaleString() : "Not available"}</p>
                    </div>
                  </div>
                </div>

                {/* Posted By */}
                <div className="group rounded-lg sm:rounded-2xl border border-purple-200/60 bg-gradient-to-br from-purple-50/60 to-purple-100/40 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-purple-300 transition-all duration-200">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="rounded-lg bg-purple-100 p-2 flex-shrink-0">
                      <User size={16} className="text-purple-600 sm:size-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-purple-900 text-sm sm:text-base">Posted By</p>
                      <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-purple-800 truncate">{opportunity.createdName || "Not available"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs sm:text-sm text-red-800">
                  <AlertTriangle size={16} className="flex-shrink-0" />
                  <span className="flex-1">{error}</span>
                  <button onClick={() => setError("")} className="text-red-600 hover:text-red-700 flex-shrink-0">
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Apply Button */}
              {isStudent && (
                <>
                  {effectiveApplied ? (
                    <PrimaryButton disabled className="w-full bg-emerald-200 text-emerald-700 shadow-none hover:translate-y-0 hover:shadow-none text-sm sm:text-base">
                      <span className="flex items-center gap-2 justify-center">
                        ✓ Applied
                      </span>
                    </PrimaryButton>
                  ) : archived ? (
                    <PrimaryButton disabled className="w-full bg-slate-200 text-slate-500 shadow-none hover:translate-y-0 hover:shadow-none text-sm sm:text-base">
                      Archived
                    </PrimaryButton>
                  ) : (
                    <PrimaryButton
                      className="w-full text-sm sm:text-base"
                      onClick={handleApply}
                      disabled={applying}
                      loading={applying}
                    >
                      <span className="flex items-center gap-2 justify-center">
                        {applying ? "Applying..." : "Apply Now"}
                        {!applying && <Sparkles size={16} />}
                      </span>
                    </PrimaryButton>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "status-timeline" && (
            <OpportunityTimeline
              key={timelineRefreshKey}
              opportunityId={opportunity._id}
              userRole={userRole}
              activeStages={activeStages}
              onStageUpdate={refreshActiveStages}
            />
          )}

          {/* Attendance Tab */}
          {activeTab === "attendance" && (
            <OpportunityAttendance
              key={attendanceRefreshKey}
              opportunityId={opportunity._id}
              activeStages={activeStages}
              onAttendanceUpdate={refreshActiveStages}
            />
          )}

          {/* Applicants Tab */}
          {activeTab === "applicants" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-slate-800 mb-1">
                    Applicants ({applicants.length})
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600">
                    Total applications for this opportunity
                  </p>
                </div>
                <button
                  onClick={refreshApplicants}
                  className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                  disabled={applicantsLoading}
                >
                  {applicantsLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              {applicantsLoading ? (
                <div className="py-8 flex justify-center">
                  <Spinner />
                </div>
              ) : applicantsError ? (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 sm:p-4 text-xs sm:text-sm text-red-800">
                  <AlertTriangle size={16} className="flex-shrink-0" />
                  <span>{applicantsError}</span>
                </div>
              ) : applicants.length === 0 ? (
                <EmptyState title="No applicants yet" subtitle="Check back later for applications" />
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {applicants.map((applicant) => (
                    <div key={applicant._id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 sm:p-4 hover:bg-slate-100/50 transition">
                      <div className="space-y-1.5 sm:space-y-2">
                        <div className="flex items-start justify-between gap-2 min-w-0">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800 text-sm truncate">{applicant.student.name}</p>
                            <p className="text-xs sm:text-sm text-slate-600 truncate">{applicant.student.email}</p>
                            {applicant.student.department && (
                              <p className="text-xs text-slate-500 mt-0.5">
                                <span className="font-medium">Dept:</span> {applicant.student.department}
                              </p>
                            )}
                          </div>
                          <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-1 rounded flex-shrink-0 whitespace-nowrap">
                            {applicant.student.studentId}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Applied {new Date(applicant.appliedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <StatusMessage type="error" message={error} />
      </Modal>
    </>
  );
};

export default OpportunityCard;
