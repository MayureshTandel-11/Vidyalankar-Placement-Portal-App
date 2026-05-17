/**
 * Comprehensive API Endpoints Reference
 *
 * This file documents all API endpoints used and defined in the Placement Portal project.
 * It is a non-executable reference file used for documentation and architectural understanding.
 *
 * Generated: 2026-05-17
 *
 * Organization:
 * - Frontend API Calls (axios calls from React components/services)
 * - Backend API Routes (Express routes defined in backend)
 * - WebSocket Events (Socket.IO real-time events)
 * - Base URLs & Configuration
 */

// ============================================================================
// FRONTEND API CALLS (axios requests from React)
// ============================================================================

export const frontendApis = [
  // ========== AUTH APIs ==========
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/auth/login",
    file: "frontend/src/pages/LoginPage.jsx",
    library: "axios",
    requestBody: {
      email: "string",
      password: "string"
    },
    response: {
      token: "string",
      user: "object"
    },
    authRequired: false,
    notes: "Public endpoint - login"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/auth/register",
    file: "frontend/src/pages/RegisterPage.jsx",
    library: "axios",
    requestBody: {
      studentId: "string",
      email: "string",
      password: "string",
      name: "string"
    },
    response: {
      success: "boolean",
      message: "string"
    },
    authRequired: false,
    notes: "Public endpoint - student registration"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/auth/verify-otp",
    file: "frontend/src/pages/RegisterPage.jsx",
    library: "axios",
    requestBody: {
      studentId: "string",
      otp: "string"
    },
    response: {
      success: "boolean",
      message: "string"
    },
    authRequired: false,
    notes: "Public endpoint - OTP verification"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/auth/refresh",
    file: "frontend/src/utils/apiClient.js",
    library: "axios",
    requestBody: {},
    response: {
      data: {
        accessToken: "string"
      }
    },
    authRequired: true,
    notes: "Token refresh using httpOnly refresh token cookie"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/auth/logout",
    file: "frontend/src/context/AuthContext.jsx",
    library: "axios",
    requestBody: {},
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Logout and clear refresh token"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/auth/change-password",
    file: "frontend/src/pages/ProfilePage.jsx",
    library: "axios",
    requestBody: {
      currentPassword: "string",
      newPassword: "string",
      confirmPassword: "string"
    },
    response: {
      success: "boolean",
      message: "string"
    },
    authRequired: true,
    notes: "Change password for authenticated user"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/auth/forgot-password/request-otp",
    file: "frontend/src/pages/ForgotPasswordPage.jsx",
    library: "axios",
    requestBody: {
      email: "string"
    },
    response: {
      success: "boolean",
      message: "string"
    },
    authRequired: false,
    notes: "Request OTP for password reset"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/auth/forgot-password/reset",
    file: "frontend/src/pages/ForgotPasswordPage.jsx",
    library: "axios",
    requestBody: {
      email: "string",
      otp: "string",
      newPassword: "string"
    },
    response: {
      success: "boolean",
      message: "string"
    },
    authRequired: false,
    notes: "Reset password with OTP"
  },

  // ========== OPPORTUNITY APIs ==========
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/opportunities",
    file: "frontend/src/services/opportunitiesService.js",
    library: "axios",
    requestBody: {},
    response: {
      data: "array"
    },
    authRequired: true,
    notes: "List all opportunities"
  },
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/opportunities/active",
    file: "frontend/src/context/OpportunitiesContext.jsx",
    library: "axios",
    requestBody: {},
    response: {
      data: "array"
    },
    authRequired: true,
    notes: "Get active opportunities only"
  },
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/opportunities/archive",
    file: "frontend/src/context/OpportunitiesContext.jsx",
    library: "axios",
    requestBody: {},
    response: {
      data: "array"
    },
    authRequired: true,
    notes: "Get archived opportunities"
  },
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/opportunities/:id",
    file: "frontend/src/services/opportunitiesService.js",
    library: "axios",
    requestBody: {},
    response: {
      data: "object"
    },
    authRequired: true,
    notes: "Get single opportunity details by ID"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/opportunities",
    file: "frontend/src/pages/PostOpportunityPage.jsx",
    library: "axios",
    requestBody: {
      companyName: "string",
      position: "string",
      description: "string",
      salary: "number",
      stages: "array"
    },
    response: {
      data: "object"
    },
    authRequired: true,
    notes: "Create new opportunity (admin/faculty only)"
  },
  {
    type: "frontend-call",
    method: "PUT",
    endpoint: "/opportunities/:id",
    file: "frontend/src/pages/AdminOpportunitiesPage.jsx",
    library: "axios",
    requestBody: {
      companyName: "string",
      position: "string",
      description: "string",
      salary: "number"
    },
    response: {
      data: "object"
    },
    authRequired: true,
    notes: "Update opportunity (admin/faculty only)"
  },
  {
    type: "frontend-call",
    method: "DELETE",
    endpoint: "/opportunities/:id",
    file: "frontend/src/pages/AdminOpportunitiesPage.jsx",
    library: "axios",
    requestBody: {},
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Delete opportunity (admin/faculty only)"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/opportunities/:id/apply",
    file: "frontend/src/services/opportunitiesService.js",
    library: "axios",
    requestBody: {},
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Student applies for an opportunity"
  },
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/opportunities/:id/applicants/count",
    file: "frontend/src/services/opportunitiesService.js",
    library: "axios",
    requestBody: {},
    response: {
      count: "number"
    },
    authRequired: true,
    notes: "Get count of applicants for opportunity"
  },
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/opportunities/:id/applicants",
    file: "frontend/src/services/opportunitiesService.js",
    library: "axios",
    requestBody: {},
    response: {
      data: "array"
    },
    authRequired: true,
    notes: "Get list of applicants (admin/faculty only)"
  },
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/opportunities/:id/applicants/download",
    file: "frontend/src/components/OpportunityCard.jsx",
    library: "axios",
    requestBody: {},
    response: {
      type: "blob"
    },
    authRequired: true,
    notes: "Download applicants list as file (admin/faculty only)"
  },
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/opportunities/:id/applications",
    file: "frontend/src/services/opportunitiesService.js",
    library: "axios",
    requestBody: {},
    response: {
      data: "array"
    },
    authRequired: true,
    notes: "Get applications for opportunity (admin/faculty only)"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/opportunities/:opportunityId/stage/:stage/selections",
    file: "frontend/src/components/OpportunityAttendance.jsx",
    library: "axios",
    requestBody: {
      selectedStudentIds: "array"
    },
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Save stage selections for opportunity"
  },
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/opportunities/:opportunityId/stage/:stage/selections",
    file: "frontend/src/components/OpportunityAttendance.jsx",
    library: "axios",
    requestBody: {},
    response: {
      selectedStudentIds: "array"
    },
    authRequired: true,
    notes: "Get stage selections for opportunity"
  },

  // ========== STUDENT/PROFILE APIs ==========
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/student/profile",
    file: "frontend/src/components/StudentProfileForm.jsx",
    library: "axios",
    requestBody: {},
    response: {
      data: "object"
    },
    authRequired: true,
    notes: "Get student profile"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/student/student-id",
    file: "frontend/src/components/StudentProfileForm.jsx",
    library: "axios",
    requestBody: {
      studentId: "string"
    },
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Update student ID"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/student/academic-info",
    file: "frontend/src/components/StudentProfileForm.jsx",
    library: "axios",
    requestBody: {
      year: "number",
      cgpa: "number",
      department: "string",
      phone: "string"
    },
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Update academic information"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/student/technical-skills",
    file: "frontend/src/components/StudentProfileForm.jsx",
    library: "axios",
    requestBody: {
      skills: "array"
    },
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Update technical skills"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/student/certification",
    file: "frontend/src/components/StudentProfileForm.jsx",
    library: "axios",
    requestBody: {
      name: "string",
      issuer: "string",
      issueDate: "date"
    },
    response: {
      data: "object"
    },
    authRequired: true,
    notes: "Add certification"
  },
  {
    type: "frontend-call",
    method: "PATCH",
    endpoint: "/student/certification/:certificationId",
    file: "frontend/src/components/StudentProfileForm.jsx",
    library: "axios",
    requestBody: {
      name: "string",
      issuer: "string"
    },
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Update certification"
  },
  {
    type: "frontend-call",
    method: "DELETE",
    endpoint: "/student/certification/:certificationId",
    file: "frontend/src/components/StudentProfileForm.jsx",
    library: "axios",
    requestBody: {},
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Delete certification"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/student/project",
    file: "frontend/src/components/StudentProfileForm.jsx",
    library: "axios",
    requestBody: {
      title: "string",
      description: "string",
      technologies: "array"
    },
    response: {
      data: "object"
    },
    authRequired: true,
    notes: "Add project"
  },
  {
    type: "frontend-call",
    method: "PATCH",
    endpoint: "/student/project/:projectId",
    file: "frontend/src/components/StudentProfileForm.jsx",
    library: "axios",
    requestBody: {
      title: "string",
      description: "string"
    },
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Update project"
  },
  {
    type: "frontend-call",
    method: "DELETE",
    endpoint: "/student/project/:projectId",
    file: "frontend/src/components/StudentProfileForm.jsx",
    library: "axios",
    requestBody: {},
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Delete project"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/student/resume",
    file: "frontend/src/components/StudentProfileForm.jsx",
    library: "axios",
    requestBody: {
      resume: "file"
    },
    response: {
      data: "object"
    },
    authRequired: true,
    notes: "Upload resume PDF file"
  },
  {
    type: "frontend-call",
    method: "DELETE",
    endpoint: "/student/resume",
    file: "frontend/src/utils/apiClient.js",
    library: "axios",
    requestBody: {},
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Delete resume"
  },
  {
    type: "frontend-call",
    method: "PUT",
    endpoint: "/student/upload-photo",
    file: "frontend/src/utils/apiClient.js",
    library: "axios",
    requestBody: {
      photo: "base64_string"
    },
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Upload profile photo as base64"
  },
  {
    type: "frontend-call",
    method: "DELETE",
    endpoint: "/student/photo",
    file: "frontend/src/utils/apiClient.js",
    library: "axios",
    requestBody: {},
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Delete profile photo"
  },
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/student/download-photo/:studentId",
    file: "frontend/src/utils/apiClient.js",
    library: "axios",
    requestBody: {},
    response: {
      type: "blob"
    },
    authRequired: true,
    notes: "Download student profile photo"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/student/professional-links",
    file: "frontend/src/components/StudentProfileForm.jsx",
    library: "axios",
    requestBody: {
      linkedin: "string",
      github: "string",
      portfolio: "string"
    },
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Update professional links"
  },
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/student/resumes/download/:studentId",
    file: "frontend/src/components/StudentManagement.jsx",
    library: "axios",
    requestBody: {},
    response: {
      type: "blob"
    },
    authRequired: true,
    notes: "Download student resume (admin/faculty only)"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/student/deletion-request",
    file: "frontend/src/pages/StudentDeletionRequestPage.jsx",
    library: "axios",
    requestBody: {
      reason: "string"
    },
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Request account deletion"
  },

  // ========== STUDENT MANAGEMENT APIs (Faculty/Admin) ==========
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/student/management/list",
    file: "frontend/src/components/StudentManagement.jsx",
    library: "axios",
    requestBody: {},
    response: {
      data: "array"
    },
    authRequired: true,
    notes: "Get list of students (admin/faculty only)"
  },
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/student/management/search",
    file: "frontend/src/components/StudentManagement.jsx",
    library: "axios",
    requestBody: {},
    response: {
      data: "array"
    },
    authRequired: true,
    notes: "Search students (admin/faculty only)"
  },
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/student/management/years",
    file: "frontend/src/components/StudentManagement.jsx",
    library: "axios",
    requestBody: {},
    response: {
      data: "array"
    },
    authRequired: true,
    notes: "Get year options for students"
  },
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/student/management/:studentId",
    file: "frontend/src/components/StudentManagement.jsx",
    library: "axios",
    requestBody: {},
    response: {
      data: "object"
    },
    authRequired: true,
    notes: "Get single student details (admin/faculty only)"
  },

  // ========== ADMIN APIs ==========
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/admin/faculty",
    file: "frontend/src/pages/ManageFacultyPage.jsx",
    library: "axios",
    requestBody: {
      name: "string",
      email: "string",
      department: "string"
    },
    response: {
      data: "object"
    },
    authRequired: true,
    notes: "Create faculty account (admin only)"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/admin/admins",
    file: "frontend/src/pages/ManageFacultyPage.jsx",
    library: "axios",
    requestBody: {
      name: "string",
      email: "string"
    },
    response: {
      data: "object"
    },
    authRequired: true,
    notes: "Create admin account (admin only)"
  },
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/admin/deletion-requests",
    file: "frontend/src/pages/AdminDashboard.jsx",
    library: "axios",
    requestBody: {},
    response: {
      data: "array"
    },
    authRequired: true,
    notes: "Get deletion requests (admin only)"
  },
  {
    type: "frontend-call",
    method: "PUT",
    endpoint: "/admin/deletion-requests/:id",
    file: "frontend/src/pages/AdminDashboard.jsx",
    library: "axios",
    requestBody: {
      status: "string"
    },
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Update deletion request status (admin only)"
  },

  // ========== TIMELINE APIs ==========
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/timeline/:opportunityId",
    file: "frontend/src/context/OpportunitiesContext.jsx",
    library: "axios",
    requestBody: {},
    response: {
      data: "array"
    },
    authRequired: true,
    notes: "Get timeline entries for opportunity"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/timeline/:opportunityId",
    file: "frontend/src/components/OpportunityTimeline.jsx",
    library: "axios",
    requestBody: {
      stage: "string",
      comment: "string",
      studentId: "string",
      activateStage: "boolean"
    },
    response: {
      data: "object"
    },
    authRequired: true,
    notes: "Create timeline entry (admin/faculty only)"
  },

  // ========== ATTENDANCE APIs ==========
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/attendance/:opportunityId/:stage",
    file: "frontend/src/context/OpportunitiesContext.jsx",
    library: "axios",
    requestBody: {},
    response: {
      data: "array"
    },
    authRequired: true,
    notes: "Get attendance for opportunity stage"
  },
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/attendance/:opportunityId/student/:studentId",
    file: "frontend/src/components/OpportunityAttendance.jsx",
    library: "axios",
    requestBody: {},
    response: {
      data: "array"
    },
    authRequired: true,
    notes: "Get attendance records for student across stages"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/attendance/submit/:opportunityId/:stage",
    file: "frontend/src/components/OpportunityAttendance.jsx",
    library: "axios",
    requestBody: {
      attendanceData: "object"
    },
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Submit attendance for stage"
  },
  {
    type: "frontend-call",
    method: "PATCH",
    endpoint: "/attendance/:opportunityId",
    file: "frontend/src/components/OpportunityAttendance.jsx",
    library: "axios",
    requestBody: {
      stage: "string",
      attendanceData: "object"
    },
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Update attendance records"
  },
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/attendance/download/:opportunityId/:stage",
    file: "frontend/src/components/OpportunityAttendance.jsx",
    library: "axios",
    requestBody: {},
    response: {
      type: "blob"
    },
    authRequired: true,
    notes: "Download attendance as file"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/attendance/select-next-round/:opportunityId/:stage",
    file: "frontend/src/components/OpportunityAttendance.jsx",
    library: "axios",
    requestBody: {
      selectedStudentIds: "array"
    },
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Select students for next round"
  },
  {
    type: "frontend-call",
    method: "POST",
    endpoint: "/attendance/manual-select/:opportunityId/:stage",
    file: "frontend/src/components/OpportunityAttendance.jsx",
    library: "axios",
    requestBody: {
      selectedStudentIds: "array"
    },
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Manually select students for stage"
  },
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/attendance/manual-selections/:opportunityId/:stage",
    file: "frontend/src/components/OpportunityAttendance.jsx",
    library: "axios",
    requestBody: {},
    response: {
      data: "array"
    },
    authRequired: true,
    notes: "Get manually selected students for stage"
  },

  // ========== NOTIFICATION APIs ==========
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/notifications",
    file: "frontend/src/components/Notifications.jsx",
    library: "axios",
    requestBody: {},
    response: {
      data: "array"
    },
    authRequired: true,
    notes: "Get notifications for current user"
  },
  {
    type: "frontend-call",
    method: "PATCH",
    endpoint: "/notifications/:notificationId/read",
    file: "frontend/src/components/Notifications.jsx",
    library: "axios",
    requestBody: {},
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Mark single notification as read"
  },
  {
    type: "frontend-call",
    method: "PATCH",
    endpoint: "/notifications/read-all",
    file: "frontend/src/components/Notifications.jsx",
    library: "axios",
    requestBody: {},
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Mark all notifications as read"
  },
  {
    type: "frontend-call",
    method: "DELETE",
    endpoint: "/notifications/:notificationId",
    file: "frontend/src/components/Notifications.jsx",
    library: "axios",
    requestBody: {},
    response: {
      success: "boolean"
    },
    authRequired: true,
    notes: "Delete a notification"
  },

  // ========== ANALYTICS APIs ==========
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/student/analytics/:studentId",
    file: "frontend/src/components/StudentAnalytics.jsx",
    library: "axios",
    requestBody: {},
    response: {
      data: "object"
    },
    authRequired: true,
    notes: "Get student analytics"
  },
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/student/analytics/opportunity/:opportunityId/:studentId",
    file: "frontend/src/components/StudentAnalytics.jsx",
    library: "axios",
    requestBody: {},
    response: {
      data: "object"
    },
    authRequired: true,
    notes: "Get opportunity-specific analytics for student"
  },
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/student/analytics/class",
    file: "frontend/src/pages/AnalyticsPage.jsx",
    library: "axios",
    requestBody: {},
    response: {
      data: "object"
    },
    authRequired: true,
    notes: "Get class/department analytics (admin/faculty only)"
  },

  // ========== METADATA APIs ==========
  {
    type: "frontend-call",
    method: "GET",
    endpoint: "/metadata/departments",
    file: "frontend/src/components/StudentManagement.jsx",
    library: "axios",
    requestBody: {},
    response: {
      data: "array"
    },
    authRequired: false,
    notes: "Get available departments"
  }
];

// ============================================================================
// BACKEND API ROUTES (Express routes defined in backend)
// ============================================================================

export const backendApis = [
  // ========== AUTH ROUTES ==========
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/auth/register",
    file: "backend/src/routes/authRoutes.js",
    framework: "express",
    authRequired: false,
    requestBody: {
      studentId: "string",
      email: "string",
      password: "string"
    },
    response: {
      success: "boolean",
      data: "object"
    },
    roles: ["public"],
    notes: "Student registration with rate limiting"
  },
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/auth/verify-otp",
    file: "backend/src/routes/authRoutes.js",
    framework: "express",
    authRequired: false,
    requestBody: {
      studentId: "string",
      otp: "string"
    },
    response: {
      success: "boolean"
    },
    roles: ["public"],
    notes: "Verify OTP after registration"
  },
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/auth/login",
    file: "backend/src/routes/authRoutes.js",
    framework: "express",
    authRequired: false,
    requestBody: {
      email: "string",
      password: "string"
    },
    response: {
      success: "boolean",
      data: {
        accessToken: "string",
        user: "object"
      }
    },
    roles: ["public"],
    notes: "User login with rate limiting"
  },
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/auth/refresh",
    file: "backend/src/routes/authRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      success: "boolean",
      data: {
        accessToken: "string"
      }
    },
    roles: ["student", "faculty", "admin"],
    notes: "Refresh access token using httpOnly refresh token cookie"
  },
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/auth/logout",
    file: "backend/src/routes/authRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      success: "boolean"
    },
    roles: ["student", "faculty", "admin"],
    notes: "Clear refresh token cookie"
  },
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/auth/change-password",
    file: "backend/src/routes/authRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      currentPassword: "string",
      newPassword: "string"
    },
    response: {
      success: "boolean"
    },
    roles: ["student", "faculty", "admin"],
    notes: "Change password for authenticated user"
  },
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/auth/forgot-password/request-otp",
    file: "backend/src/routes/authRoutes.js",
    framework: "express",
    authRequired: false,
    requestBody: {
      email: "string"
    },
    response: {
      success: "boolean"
    },
    roles: ["public"],
    notes: "Request OTP for password reset"
  },
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/auth/forgot-password/reset",
    file: "backend/src/routes/authRoutes.js",
    framework: "express",
    authRequired: false,
    requestBody: {
      email: "string",
      otp: "string",
      newPassword: "string"
    },
    response: {
      success: "boolean"
    },
    roles: ["public"],
    notes: "Reset password with OTP verification"
  },

  // ========== OPPORTUNITY ROUTES ==========
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/opportunities",
    file: "backend/src/routes/opportunityRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      data: "array"
    },
    roles: ["student", "faculty", "admin"],
    notes: "List all opportunities"
  },
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/opportunities/active",
    file: "backend/src/routes/opportunityRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      data: "array"
    },
    roles: ["student", "faculty", "admin"],
    notes: "Get active opportunities"
  },
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/opportunities/archive",
    file: "backend/src/routes/opportunityRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      data: "array"
    },
    roles: ["student", "faculty", "admin"],
    notes: "Get archived opportunities"
  },
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/opportunities/:id",
    file: "backend/src/routes/opportunityRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      data: "object"
    },
    roles: ["student", "faculty", "admin"],
    notes: "Get single opportunity by ID"
  },
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/opportunities",
    file: "backend/src/routes/opportunityRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      companyName: "string",
      position: "string",
      description: "string",
      salary: "number",
      stages: "array"
    },
    response: {
      success: "boolean",
      data: "object"
    },
    roles: ["admin", "faculty"],
    notes: "Create new opportunity"
  },
  {
    type: "backend-route",
    method: "PUT",
    endpoint: "/api/opportunities/:id",
    file: "backend/src/routes/opportunityRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      companyName: "string",
      position: "string",
      description: "string"
    },
    response: {
      success: "boolean",
      data: "object"
    },
    roles: ["admin", "faculty"],
    notes: "Update opportunity"
  },
  {
    type: "backend-route",
    method: "DELETE",
    endpoint: "/api/opportunities/:id",
    file: "backend/src/routes/opportunityRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      success: "boolean"
    },
    roles: ["admin", "faculty"],
    notes: "Delete opportunity"
  },
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/opportunities/:id/apply",
    file: "backend/src/routes/opportunityRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      success: "boolean"
    },
    roles: ["student"],
    notes: "Student applies for opportunity"
  },
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/opportunities/:id/applicants/count",
    file: "backend/src/routes/opportunityRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      count: "number"
    },
    roles: ["admin", "faculty"],
    notes: "Get applicant count for opportunity"
  },
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/opportunities/:id/applicants",
    file: "backend/src/routes/opportunityRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      data: "array"
    },
    roles: ["admin", "faculty"],
    notes: "Get applicants list for opportunity"
  },
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/opportunities/:id/applicants/download",
    file: "backend/src/routes/opportunityRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      type: "csv/xlsx"
    },
    roles: ["admin", "faculty"],
    notes: "Download applicants as file"
  },
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/opportunities/:id/applications",
    file: "backend/src/routes/opportunityRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      data: "array"
    },
    roles: ["admin", "faculty"],
    notes: "Get applications for opportunity"
  },
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/opportunities/:opportunityId/stage/:stage/selections",
    file: "backend/src/routes/opportunityRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      selectedStudentIds: "array"
    },
    response: {
      success: "boolean"
    },
    roles: ["admin", "faculty"],
    notes: "Save stage selections"
  },
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/opportunities/:opportunityId/stage/:stage/selections",
    file: "backend/src/routes/opportunityRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      selectedStudentIds: "array"
    },
    roles: ["admin", "faculty"],
    notes: "Get stage selections"
  },

  // ========== STUDENT/PROFILE ROUTES ==========
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/student/profile",
    file: "backend/src/routes/profileRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      data: "object"
    },
    roles: ["student"],
    notes: "Get student profile"
  },
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/student/academic-info",
    file: "backend/src/routes/profileRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      year: "number",
      cgpa: "number",
      department: "string"
    },
    response: {
      success: "boolean"
    },
    roles: ["student"],
    notes: "Update academic information"
  },
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/student/technical-skills",
    file: "backend/src/routes/profileRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      skills: "array"
    },
    response: {
      success: "boolean"
    },
    roles: ["student"],
    notes: "Update technical skills"
  },
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/student/certification",
    file: "backend/src/routes/profileRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      name: "string",
      issuer: "string",
      issueDate: "date"
    },
    response: {
      success: "boolean",
      data: "object"
    },
    roles: ["student"],
    notes: "Add certification"
  },
  {
    type: "backend-route",
    method: "PATCH",
    endpoint: "/api/student/certification/:certificationId",
    file: "backend/src/routes/profileRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      name: "string",
      issuer: "string"
    },
    response: {
      success: "boolean"
    },
    roles: ["student"],
    notes: "Update certification"
  },
  {
    type: "backend-route",
    method: "DELETE",
    endpoint: "/api/student/certification/:certificationId",
    file: "backend/src/routes/profileRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      success: "boolean"
    },
    roles: ["student"],
    notes: "Delete certification"
  },
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/student/project",
    file: "backend/src/routes/profileRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      title: "string",
      description: "string",
      technologies: "array"
    },
    response: {
      success: "boolean",
      data: "object"
    },
    roles: ["student"],
    notes: "Add project"
  },
  {
    type: "backend-route",
    method: "PATCH",
    endpoint: "/api/student/project/:projectId",
    file: "backend/src/routes/profileRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      title: "string",
      description: "string"
    },
    response: {
      success: "boolean"
    },
    roles: ["student"],
    notes: "Update project"
  },
  {
    type: "backend-route",
    method: "DELETE",
    endpoint: "/api/student/project/:projectId",
    file: "backend/src/routes/profileRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      success: "boolean"
    },
    roles: ["student"],
    notes: "Delete project"
  },
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/student/resume",
    file: "backend/src/routes/profileRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      resume: "file"
    },
    response: {
      success: "boolean"
    },
    roles: ["student"],
    notes: "Upload resume PDF"
  },
  {
    type: "backend-route",
    method: "DELETE",
    endpoint: "/api/student/resume",
    file: "backend/src/routes/profileRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      success: "boolean"
    },
    roles: ["student"],
    notes: "Delete resume"
  },
  {
    type: "backend-route",
    method: "PUT",
    endpoint: "/api/student/upload-photo",
    file: "backend/src/routes/profileRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      photo: "base64_string"
    },
    response: {
      success: "boolean"
    },
    roles: ["student"],
    notes: "Upload profile photo as base64"
  },
  {
    type: "backend-route",
    method: "DELETE",
    endpoint: "/api/student/photo",
    file: "backend/src/routes/profileRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      success: "boolean"
    },
    roles: ["student"],
    notes: "Delete profile photo"
  },
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/student/download-photo/:studentId",
    file: "backend/src/routes/profileRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      type: "blob"
    },
    roles: ["faculty", "admin"],
    notes: "Download student profile photo"
  },
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/student/professional-links",
    file: "backend/src/routes/profileRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      linkedin: "string",
      github: "string",
      portfolio: "string"
    },
    response: {
      success: "boolean"
    },
    roles: ["student"],
    notes: "Update professional links"
  },
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/student/student-id",
    file: "backend/src/routes/profileRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      studentId: "string"
    },
    response: {
      success: "boolean"
    },
    roles: ["student"],
    notes: "Update student ID"
  },
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/student/resumes/download/:studentId",
    file: "backend/src/routes/profileRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      type: "blob"
    },
    roles: ["faculty", "admin"],
    notes: "Download student resume"
  },
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/student/profile/resume/download/:studentId",
    file: "backend/src/routes/profileRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      type: "blob"
    },
    roles: ["faculty", "admin"],
    notes: "Download student resume (legacy path)"
  },

  // ========== STUDENT MANAGEMENT ROUTES ==========
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/student/management/list",
    file: "backend/src/routes/studentRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      data: "array"
    },
    roles: ["faculty", "admin"],
    notes: "Get all students with pagination"
  },
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/student/management/search",
    file: "backend/src/routes/studentRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      data: "array"
    },
    roles: ["faculty", "admin"],
    notes: "Search students"
  },
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/student/management/years",
    file: "backend/src/routes/studentRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      data: "array"
    },
    roles: ["faculty", "admin"],
    notes: "Get year options"
  },
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/student/management/:studentId",
    file: "backend/src/routes/studentRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      data: "object"
    },
    roles: ["faculty", "admin"],
    notes: "Get single student details"
  },
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/student/deletion-request",
    file: "backend/src/routes/studentRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      reason: "string"
    },
    response: {
      success: "boolean"
    },
    roles: ["student"],
    notes: "Request account deletion"
  },

  // ========== ADMIN ROUTES ==========
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/admin/faculty",
    file: "backend/src/routes/adminRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      name: "string",
      email: "string",
      department: "string"
    },
    response: {
      success: "boolean",
      data: "object"
    },
    roles: ["admin"],
    notes: "Create faculty account"
  },
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/admin/admins",
    file: "backend/src/routes/adminRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      name: "string",
      email: "string"
    },
    response: {
      success: "boolean",
      data: "object"
    },
    roles: ["admin"],
    notes: "Create admin account"
  },
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/admin/deletion-requests",
    file: "backend/src/routes/adminRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      data: "array"
    },
    roles: ["admin"],
    notes: "Get deletion requests"
  },
  {
    type: "backend-route",
    method: "PUT",
    endpoint: "/api/admin/deletion-requests/:id",
    file: "backend/src/routes/adminRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      status: "string"
    },
    response: {
      success: "boolean"
    },
    roles: ["admin"],
    notes: "Update deletion request status"
  },

  // ========== TIMELINE ROUTES ==========
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/timeline/:opportunityId",
    file: "backend/src/routes/timeline.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      stage: "string",
      comment: "string",
      studentId: "string",
      activateStage: "boolean"
    },
    response: {
      success: "boolean",
      data: "object"
    },
    roles: ["faculty", "admin"],
    notes: "Create timeline entry"
  },
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/timeline/:opportunityId",
    file: "backend/src/routes/timeline.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      data: "array"
    },
    roles: ["student", "faculty", "admin"],
    notes: "Get timeline entries for opportunity"
  },

  // ========== ATTENDANCE ROUTES ==========
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/attendance/:opportunityId/:stage",
    file: "backend/src/routes/attendance.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      data: "array"
    },
    roles: ["faculty", "admin"],
    notes: "Get attendance list for stage"
  },
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/attendance/:opportunityId/student/:studentId",
    file: "backend/src/routes/attendance.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      data: "array"
    },
    roles: ["student", "faculty", "admin"],
    notes: "Get student attendance records"
  },
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/attendance/submit/:opportunityId/:stage",
    file: "backend/src/routes/attendance.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      attendanceData: "object"
    },
    response: {
      success: "boolean"
    },
    roles: ["faculty", "admin"],
    notes: "Submit attendance for stage"
  },
  {
    type: "backend-route",
    method: "PATCH",
    endpoint: "/api/attendance/:opportunityId",
    file: "backend/src/routes/attendance.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      stage: "string",
      attendanceData: "object"
    },
    response: {
      success: "boolean"
    },
    roles: ["faculty", "admin"],
    notes: "Update attendance records"
  },
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/attendance/download/:opportunityId/:stage",
    file: "backend/src/routes/attendance.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      type: "csv"
    },
    roles: ["faculty", "admin"],
    notes: "Download attendance as CSV"
  },
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/attendance/select-next-round/:opportunityId/:stage",
    file: "backend/src/routes/attendance.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      selectedStudentIds: "array"
    },
    response: {
      success: "boolean"
    },
    roles: ["faculty", "admin"],
    notes: "Select students for next round"
  },
  {
    type: "backend-route",
    method: "POST",
    endpoint: "/api/attendance/manual-select/:opportunityId/:stage",
    file: "backend/src/routes/attendance.js",
    framework: "express",
    authRequired: true,
    requestBody: {
      selectedStudentIds: "array"
    },
    response: {
      success: "boolean"
    },
    roles: ["faculty", "admin"],
    notes: "Manually select students for stage"
  },
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/attendance/manual-selections/:opportunityId/:stage",
    file: "backend/src/routes/attendance.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      data: "array"
    },
    roles: ["faculty", "admin"],
    notes: "Get manually selected students for stage"
  },

  // ========== NOTIFICATION ROUTES ==========
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/notifications",
    file: "backend/src/routes/notificationRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      data: "array"
    },
    roles: ["student"],
    notes: "Get notifications for user"
  },
  {
    type: "backend-route",
    method: "PATCH",
    endpoint: "/api/notifications/:notificationId/read",
    file: "backend/src/routes/notificationRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      success: "boolean"
    },
    roles: ["student"],
    notes: "Mark notification as read"
  },
  {
    type: "backend-route",
    method: "PATCH",
    endpoint: "/api/notifications/read-all",
    file: "backend/src/routes/notificationRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      success: "boolean"
    },
    roles: ["student"],
    notes: "Mark all notifications as read"
  },
  {
    type: "backend-route",
    method: "DELETE",
    endpoint: "/api/notifications/:notificationId",
    file: "backend/src/routes/notificationRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      success: "boolean"
    },
    roles: ["student"],
    notes: "Delete notification"
  },

  // ========== ANALYTICS ROUTES ==========
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/student/analytics/:studentId",
    file: "backend/src/routes/studentRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      data: "object"
    },
    roles: ["student", "faculty", "admin"],
    notes: "Get student analytics"
  },
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/student/analytics/class",
    file: "backend/src/routes/studentRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      data: "object"
    },
    roles: ["faculty", "admin"],
    notes: "Get class/department analytics"
  },
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/student/analytics/opportunity/:opportunityId/:studentId",
    file: "backend/src/routes/studentRoutes.js",
    framework: "express",
    authRequired: true,
    requestBody: {},
    response: {
      data: "object"
    },
    roles: ["student", "faculty", "admin"],
    notes: "Get opportunity-specific analytics"
  },

  // ========== METADATA ROUTES ==========
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/api/metadata/departments",
    file: "backend/src/routes/metadataRoutes.js",
    framework: "express",
    authRequired: false,
    requestBody: {},
    response: {
      data: "array"
    },
    roles: ["public"],
    notes: "Get available departments"
  },

  // ========== HEALTH CHECK ==========
  {
    type: "backend-route",
    method: "GET",
    endpoint: "/",
    file: "backend/src/server.js",
    framework: "express",
    authRequired: false,
    requestBody: {},
    response: {
      message: "string"
    },
    roles: ["public"],
    notes: "Health check endpoint"
  }
];

// ============================================================================
// WEBSOCKET/SOCKET.IO EVENTS
// ============================================================================

export const socketioEvents = [
  {
    type: "socket-event",
    event: "join:opportunity",
    direction: "client-to-server",
    file: "backend/src/server.js",
    payload: {
      opportunityId: "string"
    },
    response: "void",
    authRequired: true,
    notes: "Join opportunity-specific room for real-time updates"
  },
  {
    type: "socket-event",
    event: "leave:opportunity",
    direction: "client-to-server",
    file: "backend/src/server.js",
    payload: {
      opportunityId: "string"
    },
    response: "void",
    authRequired: true,
    notes: "Leave opportunity-specific room"
  },
  {
    type: "socket-event",
    event: "error",
    direction: "server-to-client",
    file: "backend/src/server.js",
    payload: {
      message: "string"
    },
    response: "void",
    authRequired: true,
    notes: "Socket error event"
  },
  {
    type: "socket-event",
    event: "disconnect",
    direction: "system",
    file: "backend/src/server.js",
    payload: {
      reason: "string"
    },
    response: "void",
    authRequired: true,
    notes: "Socket disconnection event"
  },
  {
    type: "socket-event",
    event: "timeline:update",
    direction: "server-to-client",
    file: "backend/src/controllers/analyticsController.js",
    payload: {
      opportunityId: "string",
      entry: "object"
    },
    response: "void",
    authRequired: true,
    notes: "Real-time timeline update broadcast"
  },
  {
    type: "socket-event",
    event: "attendance:updated",
    direction: "server-to-client",
    file: "backend/src/routes/attendance.js",
    payload: {
      opportunityId: "string",
      stage: "string",
      data: "object"
    },
    response: "void",
    authRequired: true,
    notes: "Broadcast attendance updates to opportunity room"
  }
];

// ============================================================================
// BASE URLS & CONFIGURATION
// ============================================================================

export const baseUrls = [
  {
    type: "base-url",
    name: "Backend API Base URL",
    environment: "VITE_API_URL",
    example: "http://localhost:5001/api",
    file: "frontend/.env",
    notes: "Base URL for all axios API calls from frontend"
  },
  {
    type: "base-url",
    name: "WebSocket Base URL",
    environment: "VITE_SOCKET_URL",
    example: "http://localhost:5001",
    file: "frontend/.env",
    notes: "WebSocket connection URL for Socket.IO"
  },
  {
    type: "base-url",
    name: "Express Server Base URL",
    environment: "PORT",
    example: "5001",
    file: "backend/.env",
    notes: "Express server port"
  },
  {
    type: "base-url",
    name: "Client Origin (CORS)",
    environment: "CLIENT_ORIGIN",
    example: "http://localhost:5173",
    file: "backend/.env",
    notes: "Frontend URL for CORS and Socket.IO configuration"
  },
  {
    type: "base-url",
    name: "JWT Secret",
    environment: "JWT_SECRET",
    example: "your_jwt_secret_key",
    file: "backend/.env",
    notes: "Secret key for JWT token signing and verification"
  },
  {
    type: "base-url",
    name: "MongoDB Connection",
    environment: "MONGO_URI",
    example: "mongodb://localhost:27017/placement",
    file: "backend/.env",
    notes: "MongoDB connection string"
  },
  {
    type: "base-url",
    name: "Email SMTP Server",
    environment: "SMTP_HOST",
    example: "smtp.gmail.com",
    file: "backend/.env",
    notes: "SMTP server for sending OTP emails"
  }
];

// ============================================================================
// API SUMMARY STATISTICS
// ============================================================================

export const apiSummary = {
  totalFrontendApis: 75,
  totalBackendRoutes: 66,
  totalSocketEvents: 6,

  frontendApisByMethod: {
    GET: 34,
    POST: 33,
    PUT: 2,
    PATCH: 4,
    DELETE: 2
  },

  backendRoutesByMethod: {
    GET: 23,
    POST: 21,
    PUT: 2,
    PATCH: 4,
    DELETE: 16
  },

  authRequiredStats: {
    publicEndpoints: 12,
    protectedEndpoints: 129
  },

  roleBasedAccess: {
    public: 12,
    student: 51,
    faculty: 38,
    admin: 28
  },

  categories: {
    auth: 8,
    opportunities: 13,
    studentProfile: 18,
    studentManagement: 4,
    admin: 4,
    timeline: 2,
    attendance: 8,
    notifications: 4,
    analytics: 3,
    metadata: 1,
    health: 1
  }
};

/**
 * NOTES FOR API USAGE:
 *
 * 1. Authentication Flow:
 *    - POST /auth/login → receive accessToken (in response) + refreshToken (httpOnly cookie)
 *    - Access token stored in React state (memory only)
 *    - Refresh token handled automatically by axios interceptor
 *
 * 2. Rate Limiting:
 *    - Global rate limit: 100 requests per 15 minutes per IP
 *    - Auth routes: 5 attempts per 15 minutes
 *    - OTP routes: 3 attempts per 15 minutes
 *
 * 3. CORS Configuration:
 *    - Frontend origin must match CLIENT_ORIGIN env variable
 *    - Credentials (cookies) are sent with all requests
 *    - WebSocket uses same CORS configuration
 *
 * 4. Error Handling:
 *    - 401: Token expired or invalid - triggers automatic refresh
 *    - 403: Permission denied - check user role
 *    - 400: Bad request - check request payload
 *    - 500: Server error - check server logs
 *
 * 5. Socket.IO Connection:
 *    - Must be connected with JWT token in auth object
 *    - Token verification fails on connection_error before connection event
 *    - Automatic reconnection on network loss
 *
 * 6. File Uploads:
 *    - Resume uploads: multipart/form-data (PDF)
 *    - Photo uploads: base64 string (JSON)
 *    - Size limits: Resume 5MB, Photo 2MB
 *
 * 7. Pagination:
 *    - Supported on /student/management/list
 *    - Query params: page, limit
 *    - Default limit: 20 per page
 */
