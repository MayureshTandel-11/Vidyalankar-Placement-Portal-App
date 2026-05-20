import { useEffect, useMemo, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { extractApiError } from "../api";
import { applyToOpportunity } from "../services/opportunitiesService";
import Layout from "../components/Layout";
import Footer from "../components/Footer";
import OpportunityCard from "../components/OpportunityCard";
import { EmptyState, Spinner, StatusMessage } from "../components/ui";
import { useOpportunities } from "../context/OpportunitiesContext";
import { Search, SortAsc, Filter, Briefcase, Archive, TrendingUp } from "lucide-react";

const StudentDashboard = ({ role = "Student" }) => {
  const { opportunities, loading, refetch } = useOpportunities();
  const [active, setActive] = useState([]);
  const [archive, setArchive] = useState([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("asc");
  const [filter, setFilter] = useState("all"); // all, applied
  const [error, setError] = useState("");

  /**
   * Update local state when opportunities from context change
   * This runs whenever context opportunities are updated
   */
  useEffect(() => {
    setActive(opportunities?.active || []);
    setArchive(opportunities?.archive || []);
    setError("");
  }, [opportunities]);

  /**
   * Apply to opportunity
   */
  const handleApply = useCallback(async (id) => {
    try {
      await applyToOpportunity(id);
      toast.success("Applied successfully!");
      await refetch();
      setError("");
    } catch (err) {
      const errorMsg = extractApiError(err, "Failed to apply to opportunity");
      toast.error(errorMsg);
      throw err;
    }
  }, [refetch]);

  /**
   * Memoized filtered and sorted active opportunities
   */
  const activeView = useMemo(
    () =>
      [...active]
        .filter((item) => {
          const matchesSearch = (item.announcementHeading || "")
            .toLowerCase()
            .includes(search.toLowerCase());
          const matchesFilter =
            filter === "all" || (filter === "applied" && item.hasApplied);
          return matchesSearch && matchesFilter;
        })
        .sort((a, b) =>
          sort === "asc"
            ? new Date(a.lastDate).getTime() - new Date(b.lastDate).getTime()
            : new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()
        ),
    [active, search, sort, filter]
  );

  /**
   * Memoized filtered and sorted archive opportunities
   */
  const archiveView = useMemo(
    () =>
      [...archive]
        .filter((item) =>
          (item.announcementHeading || "")
            .toLowerCase()
            .includes(search.toLowerCase())
        )
        .sort((a, b) =>
          sort === "asc"
            ? new Date(a.lastDate).getTime() - new Date(b.lastDate).getTime()
            : new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()
        ),
    [archive, search, sort]
  );

  return (
    <>
      <Layout role={role}>
        <div className="space-y-6 sm:space-y-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium uppercase tracking-wide">Active Opportunities</p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">{active.length}</p>
                </div>
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                  <Briefcase size={24} className="text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium uppercase tracking-wide">Applied</p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">
                    {active.filter(opp => opp.hasApplied).length}
                  </p>
                </div>
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                  <TrendingUp size={24} className="text-green-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filters Section */}
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                className="w-full pl-11 pr-4 py-3 sm:py-3.5 border border-slate-200 rounded-xl text-sm sm:text-base placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                placeholder="Search by heading..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Filter Controls */}
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
              <div className="relative">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                <select
                  className="w-full pl-11 pr-4 py-2.5 sm:py-3 border border-slate-200 rounded-xl text-sm sm:text-base text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all appearance-none bg-white cursor-pointer"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All Opportunities</option>
                  <option value="applied">Applied Only</option>
                </select>
              </div>

              <div className="relative">
                <SortAsc className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                <select
                  className="w-full pl-11 pr-4 py-2.5 sm:py-3 border border-slate-200 rounded-xl text-sm sm:text-base text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all appearance-none bg-white cursor-pointer"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="asc">Deadline: Earliest</option>
                  <option value="desc">Deadline: Latest</option>
                </select>
              </div>
            </div>
          </div>

          {/* Status Messages */}
          <StatusMessage type="error" message={error} />

          {/* Loading State */}
          {loading ? (
            <div className="py-12 sm:py-16 flex justify-center items-center">
              <div className="text-center space-y-3">
                <Spinner className="h-8 w-8 mx-auto" />
                <p className="text-slate-600 font-medium">Loading opportunities...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Active Opportunities Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg">
                    <Briefcase size={18} className="text-blue-600" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Active Opportunities</h2>
                  <span className="ml-auto inline-flex items-center justify-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                    {activeView.length}
                  </span>
                </div>
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {activeView.length ? (
                    activeView.map((item) => (
                      <OpportunityCard
                        key={item._id}
                        opportunity={item}
                        hasApplied={item.hasApplied ?? false}
                        onApply={handleApply}
                      />
                    ))
                  ) : (
                    <div className="col-span-full">
                      <EmptyState
                        title="No active opportunities found"
                        subtitle={search ? "Try adjusting your search or filters." : "Check back later for new postings."}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Archived Opportunities Section */}
              <div className="space-y-4 pt-6 sm:pt-8 border-t border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-br from-slate-100 to-slate-50 rounded-lg">
                    <Archive size={18} className="text-slate-600" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Archived Opportunities</h2>
                  <span className="ml-auto inline-flex items-center justify-center px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                    {archiveView.length}
                  </span>
                </div>
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {archiveView.length ? (
                    archiveView.map((item) => (
                      <OpportunityCard
                        key={item._id}
                        opportunity={item}
                        hasApplied={item.hasApplied ?? false}
                        onApply={handleApply}
                      />
                    ))
                  ) : (
                    <div className="col-span-full">
                      <EmptyState
                        title="No archived opportunities"
                        subtitle="Expired postings will appear here automatically."
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </Layout>
      <Footer />
    </>
  );
};

export default StudentDashboard;
