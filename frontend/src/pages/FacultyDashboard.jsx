import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import Footer from "../components/Footer";
import OpportunityCard from "../components/OpportunityCard";
import { EmptyState, SectionTitle, Spinner, StatusMessage } from "../components/ui";
import { useOpportunities } from "../context/OpportunitiesContext";
import { getApplicantsCount, deleteOpportunity } from "../services/opportunitiesService";

const FacultyDashboard = () => {
  const navigate = useNavigate();
  const { opportunities, loading, refetch } = useOpportunities();
  const [active, setActive] = useState([]);
  const [archive, setArchive] = useState([]);
  const [error, setError] = useState("");
  const [applicantCounts, setApplicantCounts] = useState({});
  const [deletingId, setDeletingId] = useState("");
  const [countsLoading, setCountsLoading] = useState(false);

  /**
   * Update local state whenever context opportunities change.
   * FIX: Removed the length > 0 guard — it was preventing state update after
   * a page refresh where context initialises empty then fills asynchronously.
   */
  useEffect(() => {
    setActive(opportunities?.active || []);
    setArchive(opportunities?.archive || []);
    if (opportunities?.active || opportunities?.archive) {
      setError("");
    }
  }, [opportunities]);

  /**
   * Applicant counts load when opportunities list changes (context handles fetching).
   */
  const loadApplicantCounts = useCallback(async () => {
    const allOpportunities = [...active, ...archive];
    if (allOpportunities.length === 0) {
      if (process.env.NODE_ENV === "development") {
        console.log("[FACULTY DASHBOARD] No opportunities to load counts for");
      }
      return;
    }

    setCountsLoading(true);
    const counts = {};
    try {
      if (process.env.NODE_ENV === "development") {
        console.log("[FACULTY DASHBOARD] Loading applicant counts for", allOpportunities.length, "opportunities");
      }

      await Promise.all(
        allOpportunities.map(async (opp) => {
          try {
            const countData = await getApplicantsCount(opp._id);
            counts[opp._id] = countData.count;
          } catch (err) {
            console.error(`[FACULTY DASHBOARD] Failed to fetch count for ${opp._id}:`, err);
          }
        })
      );
      setApplicantCounts(counts);

      if (process.env.NODE_ENV === "development") {
        console.log("[FACULTY DASHBOARD] Applicant counts loaded:", counts);
      }
    } catch (err) {
      console.error("[FACULTY DASHBOARD] Failed to load applicant counts:", err);
    } finally {
      setCountsLoading(false);
    }
  }, [active, archive]);

  useEffect(() => {
    if (active.length > 0 || archive.length > 0) {
      loadApplicantCounts();
    }
  }, [active.length, archive.length, loadApplicantCounts]);

  const handleEdit = (opportunity) => {
    navigate(`/faculty/opportunities?edit=${opportunity._id}`);
  };

  const handleDelete = (opportunity) => {
    toast.custom((t) => (
      <div className="w-[340px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl space-y-4">
        <div>
          <h3 className="font-semibold text-slate-900">Delete Opportunity</h3>
          <p className="text-sm text-slate-600 mt-1">Are you sure you want to delete this opportunity? This action cannot be undone.</p>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                setDeletingId(opportunity._id);
                await deleteOpportunity(opportunity._id);
                await refetch();
                const newCounts = { ...applicantCounts };
                delete newCounts[opportunity._id];
                setApplicantCounts(newCounts);
                toast.success("Opportunity deleted successfully.");
              } catch (err) {
                toast.error(err.message || "Failed to delete opportunity");
              } finally {
                setDeletingId("");
              }
            }}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm font-medium"
            disabled={deletingId === opportunity._id}
          >
            Delete
          </button>
        </div>
      </div>
    ));
  };

  const allOpportunities = useMemo(() => [...active, ...archive], [active, archive]);

  return (
    <>
      <Layout role="Faculty">
      <SectionTitle title="Faculty Dashboard" subtitle="Overview of your department opportunities." />
      <StatusMessage type="error" message={error} />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="glass-panel p-6 space-y-3">
          <p className="text-sm text-slate-600">Active Opportunities</p>
          <p className="text-2xl font-semibold">{active.length}</p>
        </div>
        <div className="glass-panel p-6 space-y-3">
          <p className="text-sm text-slate-600">Archived Opportunities</p>
          <p className="text-2xl font-semibold">{archive.length}</p>
        </div>
      </div>
      <div className="mt-6">
        <h3 className="mb-4 text-lg font-medium">Opportunity Details</h3>
        {loading ? (
          <div className="py-8 flex justify-center"><Spinner /></div>
        ) : allOpportunities.length ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {allOpportunities.map((item) => (
              <OpportunityCard
                key={item._id}
                opportunity={item}
                canManage={true}
                applicantCount={applicantCounts[item._id] ?? null}
                onEdit={() => handleEdit(item)}
                onDelete={() => handleDelete(item)}
                deleteLoading={deletingId === item._id}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No opportunities available" subtitle="Create opportunities from Post Opportunities page." />
        )}
      </div>
    </Layout>
    <Footer />
    </>
  );
};

export default FacultyDashboard;
