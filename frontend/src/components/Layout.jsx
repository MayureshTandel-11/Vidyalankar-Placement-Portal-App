import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Menu, UserCircle2, X } from "lucide-react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import api, { extractApiData } from "../api";
import { useAuth } from "../context/AuthContext";
import { PrimaryButton } from "./ui";
import Sidebar from "./Sidebar";
import Logo from "./Logo";

const Layout = ({ children, role = "Student" }) => {
  const { user, logout } = useAuth();
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
        console.warn("[LAYOUT] Unable to load profile photo", error);
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
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen flex-col text-slate-900">
      <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 px-3 sm:px-4 md:px-6 py-2 backdrop-blur-sm shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              aria-label="Open mobile menu"
              className="h-9 w-9 flex items-center justify-center rounded-md border border-slate-200 bg-white/85 text-slate-700 transition hover:border-red-300 hover:text-red-600 md:hidden flex-shrink-0"
              onClick={() => setShowMenu(true)}
            >
              <Menu size={18} />
            </button>
            <Logo className="h-8 w-auto flex-shrink-0" />
            <span className="text-xs sm:text-sm md:text-base font-semibold tracking-tight text-slate-800 truncate">
              Vidyalankar Placement Portal
            </span>
          </div>

          <div className="relative flex items-center gap-2 flex-shrink-0">
            {/* <button
              onClick={() => setShowNotifications((current) => !current)}
              className="h-9 w-9 flex items-center justify-center relative rounded-md border border-slate-200 bg-white/85 text-slate-700 transition hover:border-red-300 hover:text-red-600 flex-shrink-0"
              aria-label="Toggle notifications"
            >
              <Bell size={18} />
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.75)]" />
            </button> */}
            <button
              onClick={() => setShowProfile((current) => !current)}
              className="h-9 px-2 flex items-center gap-1.5 rounded-md border border-slate-200 bg-white/85 text-slate-700 transition hover:border-red-300 hover:text-red-600 flex-shrink-0"
              aria-label="Toggle user profile menu"
            >
              {profilePhotoSrc ? (
                <img src={profilePhotoSrc} alt={user?.name || "User"} className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <UserCircle2 size={18} className="flex-shrink-0" />
              )}
              <span className="hidden xs:inline text-xs sm:text-sm truncate max-w-[60px] sm:max-w-none">{user?.name?.split(" ")[0] || "Profile"}</span>
            </button>

            <AnimatePresence>
              {showNotifications ? (
                <Motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="glass-panel absolute right-0 xs:right-12 sm:right-16 top-full mt-2 w-full xs:w-60 sm:w-72 p-4 text-sm z-50 mx-2 xs:mx-0 rounded-lg border border-slate-200/50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold text-slate-900">Notifications</p>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 hover:text-slate-600 transition"
                      aria-label="Close notifications"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-3 text-center">
                    <p className="text-xs xs:text-sm text-slate-600">🔔 No new notifications</p>
                  </div>
                </Motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {showProfile ? (
                <Motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="glass-panel absolute right-0 top-full mt-2 w-56 xs:w-60 sm:w-64 space-y-4 p-4 text-sm z-50 rounded-lg border border-slate-200/50"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <p className="text-xs text-slate-600">Account Role</p>
                      <p className="font-semibold text-slate-900">{role}</p>
                    </div>
                    <button
                      onClick={() => setShowProfile(false)}
                      className="text-slate-400 hover:text-slate-600 transition"
                      aria-label="Close profile"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="bg-gradient-to-br from-red-50 to-red-100/50 p-3 rounded-lg border border-red-200/50">
                    <p className="text-xs text-indigo-700">👤 <span className="font-medium">{user?.name || "User"}</span></p>
                  </div>
                  <PrimaryButton onClick={handleLogout} className="w-full text-xs sm:text-sm py-2">
                    Logout
                  </PrimaryButton>
                </Motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {showMenu ? (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 lg:hidden"
            onClick={() => setShowMenu(false)}
          >
            <Motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="h-full w-[280px] bg-white/95 p-3 backdrop-blur-lg flex flex-col"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-sm flex-shrink-0">
                    {user?.name?.charAt(0) || "A"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {user?.name || "User"}
                    </p>
                    <p className="text-xs text-slate-500">{role}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMenu(false)}
                  className="h-9 w-9 flex items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600 flex-shrink-0"
                  aria-label="Close mobile menu"
                >
                  <X size={18} />
                </button>
              </div>
              <Sidebar role={role} collapsed={false} setCollapsed={() => {}} mobile />
            </Motion.div>
          </Motion.div>
        ) : null}
      </AnimatePresence>

      <main className="flex-1 flex">
        {/* Content Container */}
        <div className="w-full flex flex-col md:flex-row md:gap-4">
          {/* Sidebar - Hidden on mobile, visible on md+ */}
          <aside className="hidden md:block md:w-60 lg:w-64 flex-shrink-0">
            <Sidebar role={role} collapsed={collapsed} setCollapsed={setCollapsed} />
          </aside>

          {/* Main Content Area */}
          <Motion.section
            className="flex-1 min-w-0 px-3 py-3 xs:px-4 sm:px-6 md:px-4 lg:px-6 md:py-4 lg:py-5 overflow-x-hidden"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24 }}
          >
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </Motion.section>
        </div>
      </main>


    </div>
  );
};

export default Layout;
