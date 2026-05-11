import { useEffect, useMemo, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { extractApiError } from "../api";
import { applyToOpportunity } from "../services/opportunitiesService";
import Layout from "../components/Layout";
import Footer from "../components/Footer";
import OpportunityCard from "../components/OpportunityCard";
import { EmptyState, SectionTitle, Spinner, StatusMessage } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useOpportunities } from "../context/OpportunitiesContext";

const StudentDashboard = ({ role = "Student" }) => {
  const { opportunities, loading, fetchOpportunities } = useOpportunities();
  const { user } = useAuth();
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
    if (opportunities?.active?.length > 0 || opportunities?.archive?.length > 0) {
      console.log("[DASHBOARD] Updating from context opportunities");
      setActive(opportunities.active || []);
      setArchive(opportunities.archive || []);
      setError("");
    }
  }, [opportunities]);

  /**
   * Initial load on mount
   * CRITICAL: No hasLoadedRef guard - let deduplicator handle duplicate requests
   * Ensures remount always triggers fetch (deduplicator will deduplicate concurrent requests)
   */
  useEffect(() => {
    const load = async () => {
      setError("");
      try {
        if (process.env.NODE_ENV === "development") {
          console.log("[DASHBOARD] Mount: triggering fetch");
        }
        await fetchOpportunities();
      } catch (err) {
        const errorMsg = extractApiError(err, "Failed to load opportunities");
        setError(errorMsg);
        toast.error(errorMsg);
      }
    };

    load();
  }, []); // Empty dependency - runs only once on mount

  /**
   * Apply to opportunity
   */
  const handleApply = useCallback(async (id) => {
    try {
      await applyToOpportunity(id);
      toast.success("Applied successfully!");
      // Update local state
      setActive((prev) =>
        prev.map((opp) =>
          opp._id === id ? { ...opp, hasApplied: true } : opp
        )
      );
      setError("");
    } catch (err) {
      const errorMsg = extractApiError(err, "Failed to apply to opportunity");
      toast.error(errorMsg);
      throw err;
    }
  }, []);

  /**
   * Memoized filtered and sorted active opportunities
   */
  const activeView = useMemo(
    () =>
      [...active]
        .filter((item) => {
          const matchesSearch = item.announcementHeading
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
          item.announcementHeading
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
        <section className="space-y-4 sm:space-y-6">
          <SectionTitle
            title={`${role} Dashboard`}
            subtitle="Explore active opportunities and track archived postings."
          />
          <div className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2 xl:grid-cols-3">
            <input
              className="input-modern text-xs sm:text-base"
              placeholder="Search by heading"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="input-modern text-xs sm:text-base"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="asc">Sort by Deadline: Earliest</option>
              <option value="desc">Sort by Deadline: Latest</option>
            </select>
            <select
              className="input-modern text-xs sm:text-base"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All Opportunities</option>
              <option value="applied">Applied Opportunities</option>
            </select>
          </div>
          <StatusMessage type="error" message={error} />
          {loading ? (
            <div className="py-8 flex justify-center"><Spinner /></div>
          ) : (
            <>
          <h2 className="text-lg sm:text-xl font-semibold text-black">Active Opportunities</h2>
          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
{activeView.length ? activeView.map((item) => <OpportunityCard key={item._id} opportunity={item} hasApplied={item.hasApplied ?? false} onApply={handleApply} />) : <EmptyState title="No active opportunities" subtitle="Check back later for new postings." />}
          </div>
          <h2 className="pt-2 text-lg sm:text-xl font-semibold text-black">Archived Opportunities</h2>
          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
{archiveView.length ? archiveView.map((item) => <OpportunityCard key={item._id} opportunity={item} hasApplied={item.hasApplied ?? false} onApply={handleApply} />) : <EmptyState title="No archived opportunities" subtitle="Expired postings will appear here automatically." />}
          </div>
            </>
          )}
        </section>
      </Layout>
      <Footer />
    </>
  );
};

export default StudentDashboard;
