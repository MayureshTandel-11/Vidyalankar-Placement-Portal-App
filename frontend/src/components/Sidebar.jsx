import { NavLink } from "react-router-dom";
import { BriefcaseBusiness, ChevronLeft, ChevronRight, FileText, LayoutDashboard, ListChecks, ShieldCheck, Trash2, UserRound, Users, BarChart3 } from "lucide-react";
import { motion as Motion } from "framer-motion";

const roleItems = {
  Student: [
    { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
    { label: "My Profile", to: "/student/profile", icon: FileText },
    { label: "Opportunities", to: "/opportunities", icon: BriefcaseBusiness },
    { label: "Notifications", to: "/notifications", icon: Users },
    { label: "Profile", to: "/profile", icon: UserRound },
  ],
  Faculty: [
    { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
    { label: "Post Opportunities", to: "/post-opportunity", icon: BriefcaseBusiness },
    { label: "My Posts", to: "/my-posts", icon: ListChecks },
    { label: "Students", to: "/students", icon: Users },
    { label: "Analytics", to: "/analytics", icon: BarChart3 },
    { label: "Profile", to: "/profile", icon: UserRound },
  ],
  Admin: [
    { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
    { label: "Opportunities", to: "/opportunities", icon: BriefcaseBusiness },
    { label: "Create Faculty", to: "/manage-faculty", icon: Users },
    { label: "Students", to: "/students", icon: Users },
    { label: "Analytics", to: "/analytics", icon: BarChart3 },
    { label: "Profile", to: "/profile", icon: ShieldCheck },
  ],
};

const Sidebar = ({ role, collapsed, setCollapsed, mobile = false }) => (
  <Motion.aside
    animate={{ width: collapsed ? 80 : 240 }}
    className={`${
      mobile
        ? "w-full flex flex-col"
        : "sticky top-20 h-[calc(100vh-6rem)] flex flex-col"
    } overflow-y-auto rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50 to-white shadow-sm`}
  >
    {/* Header */}
    <div className="flex items-center justify-between border-b border-indigo-100 bg-white/70 px-3 py-3 gap-2 flex-shrink-0">
      {!collapsed && (
        <p className="text-sm font-semibold text-indigo-900 truncate">{role} Panel</p>
      )}
      {!mobile && (
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="rounded-lg border border-red-200 bg-white p-1.5 text-red-700 transition-all duration-200 ease-in-out hover:bg-red-50 flex-shrink-0 ml-auto"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      )}
    </div>

    {/* Navigation Items */}
    <nav className="flex-1 overflow-y-auto space-y-1 px-2 py-3">
      {(roleItems[role] || roleItems.Student).map((item) => (
        <NavLink
          key={item.label}
          to={item.to}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-in-out whitespace-nowrap ${
              isActive
                ? "bg-red-50 text-red-700 ring-1 ring-red-100"
                : "text-indigo-900/75 hover:bg-indigo-100/60 hover:text-indigo-900"
            }`
          }
        >
          <item.icon size={18} className="flex-shrink-0" />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </NavLink>
      ))}
    </nav>
  </Motion.aside>
);

export default Sidebar;
