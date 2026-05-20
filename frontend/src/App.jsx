import { Navigate, Route, Routes } from "react-router-dom";
import { OpportunitiesProvider } from "./context/OpportunitiesContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import StudentDashboard from "./pages/StudentDashboard";
import FacultyDashboard from "./pages/FacultyDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ManageFacultyPage from "./pages/ManageFacultyPage";
import ProfilePage from "./pages/ProfilePage";
import StudentProfilePage from "./pages/StudentProfilePage";
import FacultyOpportunitiesPage from "./pages/FacultyOpportunitiesPage";
import AdminOpportunitiesPage from "./pages/AdminOpportunitiesPage";
import MyPostsPage from "./pages/MyPostsPage";
import StudentDeletionRequestPage from "./pages/StudentDeletionRequestPage";
import StudentDepartmentChangeRequestPage from "./pages/StudentDepartmentChangeRequestPage";
import AdminDepartmentRequestsPage from "./pages/AdminDepartmentRequestsPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import PromotionsPage from "./pages/PromotionsPage";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Footer from "./components/Footer";
import StudentManagement from "./components/StudentManagement";
import StudentAnalytics from "./components/StudentAnalytics";
// import Notifications from "./components/Notifications";
import { useState } from "react";
import AnalyticsPage from "./pages/AnalyticsPage";

const ProtectedRoute = ({ children, allowRoles }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (allowRoles && !allowRoles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

const HomeRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to="/dashboard" replace />;
};

const PublicOnly = ({ children }) => {
  const { user } = useAuth();
  return user ? <Navigate to="/" replace /> : children;
};

const App = () => {
  const { user } = useAuth();
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  return (
    <OpportunitiesProvider>
      <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
      <Route path="/forgot-password" element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} />
      <Route path="/dashboard" element={<ProtectedRoute><RoleDashboard /></ProtectedRoute>} />
      <Route path="/opportunities" element={<ProtectedRoute><RoleOpportunities /></ProtectedRoute>} />
      <Route path="/post-opportunity" element={<ProtectedRoute allowRoles={["faculty"]}><FacultyOpportunitiesPage /></ProtectedRoute>} />
      <Route path="/my-posts" element={<ProtectedRoute allowRoles={["faculty"]}><MyPostsPage /></ProtectedRoute>} />
      <Route path="/manage-faculty" element={<ProtectedRoute allowRoles={["admin"]}><ManageFacultyPage /></ProtectedRoute>} />
      <Route path="/students" element={<ProtectedRoute allowRoles={["faculty", "admin"]}><Layout role={user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}><StudentManagement /></Layout></ProtectedRoute>} />
      <Route path="/promotions" element={<ProtectedRoute allowRoles={["faculty", "admin"]}><PromotionsPage /></ProtectedRoute>} />
      {/* FIX: Use dedicated AnalyticsPage instead of broken inline StudentAnalytics with null studentId */}
      <Route path="/analytics" element={<ProtectedRoute allowRoles={["faculty", "admin"]}><AnalyticsPage /></ProtectedRoute>} />
      {/* <Route path="/notifications" element={<ProtectedRoute allowRoles={["student"]}><Layout role="Student"><Notifications onUnreadCountChange={setUnreadNotifications} /></Layout></ProtectedRoute>} /> */}
      <Route path="/request-deletion" element={<ProtectedRoute allowRoles={["student"]}><StudentDeletionRequestPage /></ProtectedRoute>} />
      <Route path="/department-change-request" element={<ProtectedRoute allowRoles={["student"]}><StudentDepartmentChangeRequestPage /></ProtectedRoute>} />
      <Route path="/department-requests" element={<ProtectedRoute allowRoles={["admin"]}><AdminDepartmentRequestsPage /></ProtectedRoute>} />
      <Route path="/student/profile" element={<ProtectedRoute allowRoles={["student"]}><StudentProfilePage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/student" element={<Navigate to="/dashboard" replace />} />
      <Route path="/faculty" element={<Navigate to="/dashboard" replace />} />
      <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </OpportunitiesProvider>
  );
};

const RoleDashboard = () => {
  const { user } = useAuth();
  if (user?.role === "admin") return <AdminDashboard />;
  if (user?.role === "faculty") return <FacultyDashboard />;
  return <StudentDashboard role="Student" />;
};

const RoleOpportunities = () => {
  const { user } = useAuth();
  if (user?.role === "admin") return <AdminOpportunitiesPage />;
  if (user?.role === "faculty") return <FacultyOpportunitiesPage />;
  return <StudentDashboard role="Student" />;
};

export default App;
