import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { BookOpen, Code, Award, Briefcase, Link as LinkIcon, FileText, X, Plus, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Loader } from "lucide-react";
import api, { extractApiData, extractApiError, getAccessToken, getApiUrl } from "../api";
import { PrimaryButton, StatusMessage } from "./ui";
import SKILLS_BY_DEPARTMENT from "../constants/skillsByDepartment";
import { useAuth } from "../context/AuthContext";

const StudentProfileForm = forwardRef(({ department, onFormChange }, ref) => {
  const { isHydrated, token } = useAuth();
  const [activeTab, setActiveTab] = useState(1);
  const [loading, setLoading] = useState(false);
  const [savingSection, setSavingSection] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedSections, setExpandedSections] = useState({});

  const [formData, setFormData] = useState({
    studentId: "",
    year: "",
    academiInfo: {
      year: "",
      sscPercentage: "",
      hscPercentage: "",
      cgpa: "",
    },
    phone: "",
    technicalSkills: [],
    customSkill: "",
    certifications: [],
    newCertification: {
      title: "",
      issuer: "",
      issueDate: "",
    },
    projects: [],
    newProject: {
      title: "",
      description: "",
      technologies: [],
      link: "",
    },
    newProjectTech: "",
    professionalLinks: {
      linkedinProfile: "",
      githubProfile: "",
      almaShineProfile: "",
    },
    resume: {
      resumeUrl: "",
      uploadedAt: "",
    },
    resumeFile: null,
  });

  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    if (!isHydrated) return;
    if (!token && !getAccessToken()) return;

    const loadProfile = async () => {
      try {
        const response = await api.get("/student/profile");
        const data = extractApiData(response);
        if (data?.profile) {
          const profile = data.profile;
          setFormData((prev) => ({
            ...prev,
            studentId: profile.studentId || "",
            year: profile.year || "",
            academiInfo: {
              year: profile.academicInfo?.year || "",
              sscPercentage: profile.academicInfo?.sscPercentage ?? "",
              hscPercentage: profile.academicInfo?.hscPercentage ?? "",
              cgpa: profile.academicInfo?.cgpa ?? "",
            },
            phone: profile.phone || "",
            technicalSkills: Array.isArray(profile.technicalSkills) ? profile.technicalSkills : [],
            certifications: Array.isArray(profile.certifications) ? profile.certifications : [],
            projects: Array.isArray(profile.projects) ? profile.projects : [],
            professionalLinks: {
              linkedinProfile: profile.professionalLinks?.linkedinProfile || "",
              githubProfile: profile.professionalLinks?.githubProfile || "",
              almaShineProfile: profile.professionalLinks?.almaShineProfile || "",
            },
            resume: {
              resumeUrl: profile.resume?.resumeUrl || "",
              uploadedAt: profile.resume?.uploadedAt || "",
            },
          }));
        }
      } catch (error) {
        console.error("[Profile] Error loading profile:", error?.response?.status, error?.response?.data || error.message);
        setErrorMsg("Failed to load your profile. Please refresh the page.");
      }
    };
    loadProfile();
  }, [isHydrated, token]);

  // Expose saveAll method to parent via ref
  useImperativeHandle(ref, () => ({
    async saveAll() {
      setLoading(true);
      setErrorMsg("");
      setSuccessMsg("");
      const failures = [];

      try {
        if (formData.studentId?.trim()) {
          try {
            await api.post("/student/student-id", { studentId: formData.studentId.trim() });
          } catch (e) {
            failures.push(extractApiError(e, "Student ID"));
          }
        }

        const academicErrors = validateAcademicInfo();
        if (formData.year) {
          if (Object.keys(academicErrors).length === 0) {
            try {
              await api.post("/student/academic-info", {
                ...formData.academiInfo,
                year: formData.year,
                phone: formData.phone,
              });
            } catch (e) {
              failures.push(extractApiError(e, "Academic info"));
            }
          } else {
            failures.push("Fix academic section validation before continuing");
          }
        } else if (formData.phone?.trim()?.length === 10) {
          try {
            await api.post("/student/academic-info", { phone: formData.phone.trim() });
          } catch (e) {
            failures.push(extractApiError(e, "Phone / academic info"));
          }
        }

        try {
          await api.post("/student/technical-skills", {
            skills: Array.isArray(formData.technicalSkills) ? formData.technicalSkills : [],
          });
        } catch (e) {
          failures.push(extractApiError(e, "Technical skills"));
        }

        const linksErrors = validateProfessionalLinks();
        if (Object.keys(linksErrors).length === 0) {
          try {
            await api.post("/student/professional-links", formData.professionalLinks);
          } catch (e) {
            failures.push(extractApiError(e, "Professional links"));
          }
        } else {
          failures.push("Fix professional link URLs");
        }

        if (failures.length) {
          setErrorMsg(failures.join(" · "));
          return false;
        }

        setSuccessMsg("All sections saved successfully");
        onFormChange && onFormChange();
        return true;
      } catch (error) {
        setErrorMsg(extractApiError(error, "Error saving profile"));
        return false;
      } finally {
        setLoading(false);
      }
    },
  }));

  // Validation functions
  const validateAcademicInfo = () => {
    const errors = {};
    if (!formData.year) errors.year = "Class year is required";
    if (formData.academiInfo.year && (formData.academiInfo.year < 1 || formData.academiInfo.year > 4)) {
      errors.year = "Academic year must be between 1 and 4";
    }
    if (formData.academiInfo.sscPercentage && (formData.academiInfo.sscPercentage < 0 || formData.academiInfo.sscPercentage > 100)) {
      errors.sscPercentage = "SSC percentage must be between 0 and 100";
    }
    if (formData.academiInfo.hscPercentage && (formData.academiInfo.hscPercentage < 0 || formData.academiInfo.hscPercentage > 100)) {
      errors.hscPercentage = "HSC percentage must be between 0 and 100";
    }
    if (formData.academiInfo.cgpa && (formData.academiInfo.cgpa < 0 || formData.academiInfo.cgpa > 10)) {
      errors.cgpa = "CGPA must be between 0 and 10";
    }
    return errors;
  };

  const validateTechnicalSkills = () => {
    const errors = {};
    if (formData.technicalSkills.length === 0) {
      errors.technicalSkills = "Select at least one technical skill";
    }
    return errors;
  };

  const validateURL = (url) => {
    if (!url) return true;
    const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
    return urlRegex.test(url);
  };

  const validateProfessionalLinks = () => {
    const errors = {};
    if (formData.professionalLinks.linkedinProfile && !validateURL(formData.professionalLinks.linkedinProfile)) {
      errors.linkedinProfile = "Invalid LinkedIn URL";
    }
    if (formData.professionalLinks.githubProfile && !validateURL(formData.professionalLinks.githubProfile)) {
      errors.githubProfile = "Invalid GitHub URL";
    }
    if (formData.professionalLinks.almaShineProfile && !validateURL(formData.professionalLinks.almaShineProfile)) {
      errors.almaShineProfile = "Invalid AlmaShine URL";
    }
    return errors;
  };

  // Save functions
  const saveStudentId = async () => {
    if (!formData.studentId.trim()) {
      setErrorMsg("Student ID is required");
      return;
    }

    setSavingSection(0);
    try {
      await api.post("/student/student-id", {
        studentId: formData.studentId,
      });
      setSuccessMsg("Student ID saved successfully");
      setErrorMsg("");
    } catch (error) {
      setErrorMsg(extractApiError(error, "Failed to save student ID"));
    } finally {
      setSavingSection(null);
    }
  };

  const saveAcademicInfo = async () => {
    const errors = validateAcademicInfo();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setErrorMsg("Please fix validation errors");
      return;
    }

    setSavingSection(1);
    try {
      await api.post("/student/academic-info", {
        ...formData.academiInfo,
        year: formData.year,
        phone: formData.phone,
      });
      setSuccessMsg("Academic information saved successfully");
      setValidationErrors({});
      onFormChange && onFormChange();
    } catch (error) {
      setErrorMsg(extractApiError(error, "Failed to save academic info"));
    } finally {
      setSavingSection(null);
    }
  };

  const saveTechnicalSkills = async () => {
    const errors = validateTechnicalSkills();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setErrorMsg("Please select at least one skill");
      return;
    }

    setSavingSection(2);
    try {
      await api.post("/student/technical-skills", {
        skills: formData.technicalSkills,
      });
      setSuccessMsg("Technical skills saved successfully");
      setValidationErrors({});
      onFormChange && onFormChange();
    } catch (error) {
      setErrorMsg(extractApiError(error, "Failed to save skills"));
    } finally {
      setSavingSection(null);
    }
  };

  const addCertification = async () => {
    if (!formData.newCertification.title || !formData.newCertification.issuer) {
      setErrorMsg("Title and issuer are required for certification");
      return;
    }

    setSavingSection(3);
    try {
      const response = await api.post("/student/certification", formData.newCertification);
      const data = extractApiData(response);
      setFormData((prev) => ({
        ...prev,
        certifications: data.certifications || [],
        newCertification: { title: "", issuer: "", issueDate: "" },
      }));
      setSuccessMsg("Certification added successfully");
      onFormChange && onFormChange();
    } catch (error) {
      setErrorMsg(extractApiError(error, "Failed to add certification"));
    } finally {
      setSavingSection(null);
    }
  };

  const deleteCertification = async (certId) => {
    setSavingSection(3);
    try {
      const response = await api.delete(`/student/certification/${certId}`);
      const data = extractApiData(response);
      setFormData((prev) => ({
        ...prev,
        certifications: data.certifications || [],
      }));
      setSuccessMsg("Certification deleted successfully");
      onFormChange && onFormChange();
    } catch (error) {
      setErrorMsg(extractApiError(error, "Failed to delete certification"));
    } finally {
      setSavingSection(null);
    }
  };

  const addProject = async () => {
    if (!formData.newProject.title || !formData.newProject.description) {
      setErrorMsg("Title and description are required for project");
      return;
    }

    setSavingSection(4);
    try {
      const response = await api.post("/student/project", formData.newProject);
      const data = extractApiData(response);
      setFormData((prev) => ({
        ...prev,
        projects: data.projects || [],
        newProject: {
          title: "",
          description: "",
          technologies: [],
          link: "",
        },
        newProjectTech: "",
      }));
      setSuccessMsg("Project added successfully");
      onFormChange && onFormChange();
    } catch (error) {
      setErrorMsg(extractApiError(error, "Failed to add project"));
    } finally {
      setSavingSection(null);
    }
  };

  const deleteProject = async (projId) => {
    setSavingSection(4);
    try {
      const response = await api.delete(`/student/project/${projId}`);
      const data = extractApiData(response);
      setFormData((prev) => ({
        ...prev,
        projects: data.projects || [],
      }));
      setSuccessMsg("Project deleted successfully");
      onFormChange && onFormChange();
    } catch (error) {
      setErrorMsg(extractApiError(error, "Failed to delete project"));
    } finally {
      setSavingSection(null);
    }
  };

  const uploadResume = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".pdf")) {
      setErrorMsg("Only PDF files are allowed");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("File size must be less than 5MB");
      return;
    }

    setSavingSection(6);
    const formDataToSend = new FormData();
    formDataToSend.append("resume", file);

    try {
      const response = await api.post("/student/resume", formDataToSend, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = extractApiData(response);
      setFormData((prev) => ({
        ...prev,
        resume: data.resume || prev.resume,
      }));
      setSuccessMsg("Resume uploaded successfully");
      onFormChange && onFormChange();
    } catch (error) {
      setErrorMsg(extractApiError(error, "Failed to upload resume"));
    } finally {
      setSavingSection(null);
    }
  };

  const saveProfessionalLinks = async () => {
    const errors = validateProfessionalLinks();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setErrorMsg("Please fix URL validation errors");
      return;
    }

    setSavingSection(5);
    try {
      await api.post("/student/professional-links", formData.professionalLinks);
      setSuccessMsg("Professional links saved successfully");
      setValidationErrors({});
      onFormChange && onFormChange();
    } catch (error) {
      setErrorMsg(extractApiError(error, "Failed to save professional links"));
    } finally {
      setSavingSection(null);
    }
  };

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const getAvailableSkills = () => {
    return SKILLS_BY_DEPARTMENT[department] || [];
  };

  const handleSkillToggle = (skill) => {
    setFormData((prev) => ({
      ...prev,
      technicalSkills: prev.technicalSkills.includes(skill)
        ? prev.technicalSkills.filter((s) => s !== skill)
        : [...prev.technicalSkills, skill],
    }));
  };

  const handleAddCustomSkill = () => {
    if (formData.customSkill.trim()) {
      setFormData((prev) => ({
        ...prev,
        technicalSkills: [...prev.technicalSkills, prev.customSkill.trim()],
        customSkill: "",
      }));
    }
  };

  const handleRemoveSkill = (skill) => {
    setFormData((prev) => ({
      ...prev,
      technicalSkills: prev.technicalSkills.filter((s) => s !== skill),
    }));
  };

  const handleAddProjectTech = () => {
    if (formData.newProjectTech.trim()) {
      setFormData((prev) => ({
        ...prev,
        newProject: {
          ...prev.newProject,
          technologies: [...prev.newProject.technologies, prev.newProjectTech.trim()],
        },
        newProjectTech: "",
      }));
    }
  };

  const handleRemoveProjectTech = (tech) => {
    setFormData((prev) => ({
      ...prev,
      newProject: {
        ...prev.newProject,
        technologies: prev.newProject.technologies.filter((t) => t !== tech),
      },
    }));
  };

  // Tab Component
  const TabButton = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-3 font-medium transition-all duration-200 ${
        activeTab === id
          ? "border-b-2 border-indigo-600 text-indigo-600"
        : "border-b-2 border-transparent text-slate-600 hover:text-slate-900"
      }`}
    >
      <Icon size={18} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Student Profile</h1>
        <p className="text-slate-600">Complete your profile to enhance your placement opportunities</p>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle size={20} className="flex-shrink-0" />
          <p>{successMsg}</p>
          <button onClick={() => setSuccessMsg("")} className="ml-auto">
            <X size={20} />
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertCircle size={20} className="flex-shrink-0" />
          <p>{errorMsg}</p>
          <button onClick={() => setErrorMsg("")} className="ml-auto">
            <X size={20} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex overflow-x-auto">
          <TabButton id={0} label="Student ID" icon={BookOpen} />
          <TabButton id={1} label="Academic Info" icon={BookOpen} />
          <TabButton id={2} label="Technical Skills" icon={Code} />
          <TabButton id={3} label="Certifications" icon={Award} />
          <TabButton id={4} label="Projects" icon={Briefcase} />
          <TabButton id={5} label="Links & Resume" icon={LinkIcon} />
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Section 0: Student ID */}
        {activeTab === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Student ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.studentId}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    studentId: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="e.g., VID123456"
              />
              <p className="text-sm text-slate-600">Your student ID is required to apply for opportunities</p>
            </div>
            <PrimaryButton
              onClick={saveStudentId}
              disabled={savingSection === 0}
              className="w-full"
            >
              {savingSection === 0 ? <Loader className="animate-spin" size={18} /> : "Save Student ID"}
            </PrimaryButton>
          </div>
        )}

        {/* Section 1: Academic Information */}
        {activeTab === 1 && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Class Year <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.year}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      year: e.target.value,
                    }))
                  }
                  className="input-modern w-full rounded-lg border border-slate-300 bg-white px-4 py-2"
                >
                  <option value="">Select Year</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
                {validationErrors.year && <p className="text-sm text-red-600">{validationErrors.year}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">SSC Percentage</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.academiInfo.sscPercentage}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      academiInfo: { ...prev.academiInfo, sscPercentage: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-2"
                  placeholder="e.g., 85.50"
                />
                {validationErrors.sscPercentage && <p className="text-sm text-red-600">{validationErrors.sscPercentage}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">HSC Percentage</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.academiInfo.hscPercentage}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      academiInfo: { ...prev.academiInfo, hscPercentage: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-2"
                  placeholder="e.g., 90.00"
                />
                {validationErrors.hscPercentage && <p className="text-sm text-red-600">{validationErrors.hscPercentage}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">CGPA</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.01"
                  value={formData.academiInfo.cgpa}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      academiInfo: { ...prev.academiInfo, cgpa: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-2"
                  placeholder="e.g., 8.50"
                />
                {validationErrors.cgpa && <p className="text-sm text-red-600">{validationErrors.cgpa}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2"
                  placeholder="10-digit phone number"
                />
              </div>
            </div>

            <PrimaryButton
              onClick={saveAcademicInfo}
              disabled={savingSection === 1}
              loading={savingSection === 1}
              className="w-full rounded-lg py-2"
            >
              {savingSection === 1 ? "Saving..." : "Save Academic Information"}
            </PrimaryButton>
          </div>
        )}

        {/* Section 2: Technical Skills */}
        {activeTab === 2 && (
          <div className="space-y-4">
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700">
                Select Technical Skills <span className="text-red-500">*</span>
              </label>
              <div className="grid gap-2 md:grid-cols-2">
                {getAvailableSkills().map((skill, index) => (
                  <label key={`available-skill-${index}-${skill}`} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={formData.technicalSkills.includes(skill)}
                      onChange={() => handleSkillToggle(skill)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">{skill}</span>
                  </label>
                ))}
              </div>
              {validationErrors.technicalSkills && <p className="text-sm text-red-600">{validationErrors.technicalSkills}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Add Custom Skill</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.customSkill}
                  onChange={(e) => setFormData((prev) => ({ ...prev, customSkill: e.target.value }))}
                  placeholder="e.g., Docker, Kubernetes"
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2"
                />
                <button
                  onClick={handleAddCustomSkill}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Selected Skills</label>
              <div className="flex flex-wrap gap-2">
                {formData.technicalSkills.map((skill, index) => (
                  <div key={`tech-skill-${index}-${skill}`} className="flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-sm text-indigo-700">
                    {skill}
                    <button
                      onClick={() => handleRemoveSkill(skill)}
                      className="hover:text-indigo-900"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <PrimaryButton
              onClick={saveTechnicalSkills}
              disabled={savingSection === 2}
              loading={savingSection === 2}
              className="w-full rounded-lg py-2"
            >
              {savingSection === 2 ? "Saving..." : "Save Technical Skills"}
            </PrimaryButton>
          </div>
        )}

        {/* Section 3: Certifications */}
        {activeTab === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
              <h3 className="font-semibold text-indigo-900 mb-4">Add New Certification</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  type="text"
                  value={formData.newCertification.title}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      newCertification: { ...prev.newCertification, title: e.target.value },
                    }))
                  }
                  placeholder="Certificate Title"
                  className="rounded-lg border border-slate-300 px-4 py-2"
                />
                <input
                  type="text"
                  value={formData.newCertification.issuer}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      newCertification: { ...prev.newCertification, issuer: e.target.value },
                    }))
                  }
                  placeholder="Issuer"
                  className="rounded-lg border border-slate-300 px-4 py-2"
                />
                <input
                  type="date"
                  value={formData.newCertification.issueDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      newCertification: { ...prev.newCertification, issueDate: e.target.value },
                    }))
                  }
                  className="rounded-lg border border-slate-300 px-4 py-2 md:col-span-2"
                />
              </div>
              <PrimaryButton
                onClick={addCertification}
                disabled={savingSection === 3}
                className="mt-4 w-full rounded-lg py-2"
              >
                <Plus size={18} className="inline-block mr-2" />
                Add Certification
              </PrimaryButton>
            </div>

            {formData.certifications.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-slate-900">Your Certifications</h3>
                <div className="space-y-2">
                  {formData.certifications.map((cert, cIdx) => (
                    <div key={cert._id || `cert-${cIdx}-${cert.title}`} className="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:bg-slate-50">
                      <div>
                        <p className="font-medium text-slate-900">{cert.title}</p>
                        <p className="text-sm text-slate-600">{cert.issuer}</p>
                        {cert.issueDate && <p className="text-xs text-slate-500">{new Date(cert.issueDate).toLocaleDateString()}</p>}
                      </div>
                      <button
                        onClick={() => deleteCertification(cert._id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section 4: Projects */}
        {activeTab === 4 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="font-semibold text-emerald-900 mb-4">Add New Project</h3>
              <div className="space-y-4">
                <input
                  type="text"
                  value={formData.newProject.title}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      newProject: { ...prev.newProject, title: e.target.value },
                    }))
                  }
                  placeholder="Project Title"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2"
                />
                <textarea
                  value={formData.newProject.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      newProject: { ...prev.newProject, description: e.target.value },
                    }))
                  }
                  placeholder="Project Description"
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2"
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Technologies Used</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.newProjectTech}
                      onChange={(e) => setFormData((prev) => ({ ...prev, newProjectTech: e.target.value }))}
                      placeholder="e.g., React, Node.js"
                      className="flex-1 rounded-lg border border-slate-300 px-4 py-2"
                    />
                    <button
                      onClick={handleAddProjectTech}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.newProject.technologies.map((tech, index) => (
                      <div key={`project-tech-${index}-${tech}`} className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-700">
                        {tech}
                        <button onClick={() => handleRemoveProjectTech(tech)} className="hover:text-emerald-900">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <input
                  type="url"
                  value={formData.newProject.link}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      newProject: { ...prev.newProject, link: e.target.value },
                    }))
                  }
                  placeholder="Project Link (optional)"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2"
                />
              </div>
              <PrimaryButton
                onClick={addProject}
                disabled={savingSection === 4}
                className="mt-4 w-full rounded-lg py-2"
              >
                <Plus size={18} className="inline-block mr-2" />
                Add Project
              </PrimaryButton>
            </div>

            {formData.projects.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-slate-900">Your Projects</h3>
                <div className="space-y-3">
                  {formData.projects.map((proj) => (
                    <div key={proj._id || `proj-${proj.title}`} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{proj.title}</p>
                          <p className="mt-1 text-sm text-slate-600">{proj.description}</p>
                          {proj.technologies && proj.technologies.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {proj.technologies.map((tech, index) => (
                                <span key={`tech-${proj._id}-${index}-${tech}`} className="inline-block rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                                  {tech}
                                </span>
                              ))}
                            </div>
                          )}
                          {proj.link && (
                            <a href={proj.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-indigo-600 hover:underline">
                              View Project →
                            </a>
                          )}
                        </div>
                        <button
                          onClick={() => deleteProject(proj._id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section 5: Professional Links & Resume */}
        {activeTab === 5 && (
          <div className="space-y-6">
            {/* Professional Links */}
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-4">
              <h3 className="font-semibold text-cyan-900 mb-4">Professional Links</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">LinkedIn Profile URL</label>
                  <input
                    type="url"
                    value={formData.professionalLinks.linkedinProfile}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        professionalLinks: { ...prev.professionalLinks, linkedinProfile: e.target.value },
                      }))
                    }
                    placeholder="https://linkedin.com/in/yourprofile"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2"
                  />
                  {validationErrors.linkedinProfile && <p className="text-sm text-red-600">{validationErrors.linkedinProfile}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">GitHub Profile URL</label>
                  <input
                    type="url"
                    value={formData.professionalLinks.githubProfile}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        professionalLinks: { ...prev.professionalLinks, githubProfile: e.target.value },
                      }))
                    }
                    placeholder="https://github.com/yourprofile"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2"
                  />
                  {validationErrors.githubProfile && <p className="text-sm text-red-600">{validationErrors.githubProfile}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">AlmaShine Profile URL</label>
                  <input
                    type="url"
                    value={formData.professionalLinks.almaShineProfile}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        professionalLinks: { ...prev.professionalLinks, almaShineProfile: e.target.value },
                      }))
                    }
                    placeholder="https://almashine.com/yourprofile"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2"
                  />
                  {validationErrors.almaShineProfile && <p className="text-sm text-red-600">{validationErrors.almaShineProfile}</p>}
                </div>
              </div>
              <PrimaryButton
                onClick={saveProfessionalLinks}
                disabled={savingSection === 5}
                className="mt-4 w-full rounded-lg py-2"
              >
                {savingSection === 5 ? "Saving..." : "Save Professional Links"}
              </PrimaryButton>
            </div>

            {/* Resume Upload */}
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
              <h3 className="font-semibold text-purple-900 mb-4">Resume Upload</h3>
              <div className="space-y-4">
                <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-purple-300 p-6 hover:bg-purple-100 cursor-pointer transition-colors">
                  <FileText size={40} className="mb-2 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">
                    Click to upload resume (PDF, DOC, DOCX — max 5MB)
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={uploadResume}
                    className="hidden"
                  />
                </label>
                {formData.resume.resumeUrl && (
                  <div className="flex items-center justify-between rounded-lg border border-purple-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <FileText size={24} className="text-purple-600" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">Resume uploaded</p>
                        {formData.resume.uploadedAt && (
                          <p className="text-xs text-slate-500">
                            Uploaded on {new Date(formData.resume.uploadedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <a
                      href={
                        formData.resume.resumeUrl?.startsWith("http")
                          ? formData.resume.resumeUrl
                          : `${String(getApiUrl() || "").replace(/\/api\/?$/i, "")}/${String(formData.resume.resumeUrl || "").replace(/^\//, "")}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                    >
                      Download
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

StudentProfileForm.displayName = "StudentProfileForm";

export default StudentProfileForm;
