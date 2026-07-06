import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import Footer from "../components/Footer";
import PasswordInput from "../components/PasswordInput";
import { useAuth } from "../context/AuthContext";
import api, { extractApiData, extractApiError } from "../api";
import { PrimaryButton, SectionTitle, StatusMessage } from "../components/ui";
import { BriefcaseBusiness, GraduationCap, IdCard, Mail, ShieldCheck, UserCircle2 } from "lucide-react";

const ProfilePage = () => {
  const { user } = useAuth();
  const [profilePhotoSrc, setProfilePhotoSrc] = useState("");
  useEffect(() => {
    let isMounted = true;
    const resolveProfilePhoto = async () => {
      const currentPhoto =
        user?.studentPhoto?.url ||
        (typeof user?.profileImage === "string" && user.profileImage.startsWith("data:")
          ? user.profileImage
          : user?.studentPhoto?.data && user?.studentPhoto?.contentType
            ? `data:${user.studentPhoto.contentType};base64,${user.studentPhoto.data}`
            : "");

      if (currentPhoto) {
        setProfilePhotoSrc(currentPhoto);
        return;
      }

      if (!user?._id || user?.role !== "student") {
        setProfilePhotoSrc("");
        return;
      }

      try {
        const response = await api.get("/student/profile");
        const data = extractApiData(response);
        const profile = data?.profile;
        const profilePhoto = profile?.studentPhoto?.url ||
          (profile?.studentPhoto?.data && profile?.studentPhoto?.contentType
            ? `data:${profile.studentPhoto.contentType};base64,${profile.studentPhoto.data}`
            : "");

        if (isMounted) {
          setProfilePhotoSrc(profilePhoto);
        }
      } catch (error) {
        console.warn("[PROFILE] Unable to load profile photo", error);
        if (isMounted) {
          setProfilePhotoSrc("");
        }
      }
    };

    resolveProfilePhoto();
    return () => {
      isMounted = false;
    };
  }, [user?._id, user?.role, user?.profileImage, user?.studentPhoto?.url, user?.studentPhoto?.data, user?.studentPhoto?.contentType]);
  const role = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "User";
  const roleMeta = {
    admin: {
      title: "Administrator Access",
      description: "Full control over faculty management and global opportunity publishing.",
      icon: ShieldCheck,
    },
    faculty: {
      title: "Faculty Access",
      description: "Post and monitor opportunities for your assigned department.",
      icon: BriefcaseBusiness,
    },
    student: {
      title: "Student Access",
      description: "Explore opportunities and track deadlines relevant to your department.",
      icon: GraduationCap,
    },
  };
  const currentRole = user?.role || "student";
  const RoleIcon = roleMeta[currentRole]?.icon || UserCircle2;
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submitChangePassword = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmNewPassword) {
      setError("All password fields are required.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setError("New password and confirm password do not match.");
      return;
    }
    if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(passwordForm.newPassword)) {
      setError("Password must be 8+ chars with uppercase, number, and special character.");
      return;
    }
    setLoading(true);
    try {
      const response = await api.post("/auth/change-password", passwordForm);
      const data = extractApiData(response);
      setMessage(data?.message || "Password changed successfully.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
    } catch (err) {
      setError(extractApiError(err, "Failed to change password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Layout role={role}>
      <SectionTitle title="Profile & Security" subtitle="Manage profile information, access actions, and account security." />
      <StatusMessage message={message} />
      <StatusMessage type="error" message={error} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="glass-panel space-y-6 p-6">
          <h3 className="text-base font-semibold text-slate-800">Profile Info</h3>
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-indigo-100 ${profilePhotoSrc ? "p-0" : "p-3 text-indigo-700"}`}>
              {profilePhotoSrc ? (
                <img src={profilePhotoSrc} alt={user?.name || "User"} className="h-full w-full object-cover" />
              ) : (
                <UserCircle2 size={20} />
              )}
            </div>
            <div>
              <p className="text-lg font-semibold">{user?.name || "User"}</p>
              <p className="text-sm text-slate-600">{user?.role || "-"}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="mb-1 flex items-center gap-2 text-sm text-slate-600"><Mail size={14} />Email</p>
              <p className="font-medium">{user?.email || "-"}</p>
            </div>
            {currentRole === "student" && (
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="mb-1 flex items-center gap-2 text-sm text-slate-600"><IdCard size={14} />Student ID</p>
                <p className="font-medium">{user?.studentId || "-"}</p>
              </div>
            )}
            <div className="rounded-xl border border-slate-200 p-4 md:col-span-2">
              <p className="mb-1 text-sm text-slate-600">Department</p>
              <p className="font-medium">{user?.department || "-"}</p>
            </div>
          </div>
        </section>
        <section className="space-y-6">
          <div className="glass-panel p-6">
            <h3 className="mb-3 text-base font-semibold text-slate-800">Actions</h3>
            <div className="flex items-center gap-2 text-indigo-700">
              <RoleIcon size={18} />
              <p className="font-semibold">{roleMeta[currentRole]?.title || "Portal Access"}</p>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              {roleMeta[currentRole]?.description || "Access your relevant dashboard actions."}
            </p>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Account is authenticated and linked to role-based routes.
            </div>
          </div>
          <form onSubmit={submitChangePassword} className="glass-panel space-y-4 p-6">
            <h3 className="text-base font-semibold text-slate-800">Security - Change Password</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <PasswordInput
                className="md:col-span-2"
                placeholder="Current Password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              />
              <PasswordInput
                placeholder="New Password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              />
              <PasswordInput
                placeholder="Confirm New Password"
                value={passwordForm.confirmNewPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmNewPassword: e.target.value })}
              />
            </div>
            <p className="text-xs text-slate-500">
              Use at least 8 characters with one uppercase letter, one number, and one special character.
            </p>
            <PrimaryButton type="submit" loading={loading} disabled={loading} className="w-full">
              {loading ? "Updating Password..." : "Update Password"}
            </PrimaryButton>
          </form>
        </section>
      </div>
    </Layout>
    <Footer />
    </>
  );
};

export default ProfilePage;
