import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import Footer from "../components/Footer";
import OpportunityCard from "../components/OpportunityCard";
import { EmptyState, SectionTitle, Spinner, StatusMessage } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import {
  deleteOpportunity,
  getOpportunities,
} from "../services/opportunitiesService";

const isArchived = (item) => {
  const lastMidnight = new Date(item.lastDate);
  lastMidnight.setHours(0, 0, 0, 0);
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  return todayMidnight > lastMidnight;
};



const MyPostsPage = () => {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  const loadOpportunities = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getOpportunities();
      // Filter to show:
      // 1. Opportunities created by the current faculty
      // 2. Admin opportunities where faculty has performed actions (timeline modifications, attendance records, etc.)
      const filtered = data.filter((item) => {
        const isCreator = String(item.createdByEmail) === String(user?.email);
        if (isCreator) return true;

        // Check if faculty has performed any action on admin-created opportunities
        const isAdminCreated = item.createdByRole === "admin" || item.createdBy === "admin";
        if (isAdminCreated) {
          // Check if faculty has modified timeline stages
          const hasTimelineModifications =
            item.timelineStages && Array.isArray(item.timelineStages) &&
            item.timelineStages.some(stage =>
              String(stage.createdBy) === String(user?.email) || String(stage.modifiedBy) === String(user?.email)
            );

          // Check if faculty has recorded attendance
          const hasAttendanceRecords =
            item.attendanceRecords && Array.isArray(item.attendanceRecords) &&
            item.attendanceRecords.some(record =>
              String(record.recordedBy) === String(user?.email)
            );

          // Check if faculty is in collaborators/modifiedBy
          const isCollaborator =
            (item.collaborators && Array.isArray(item.collaborators) &&
              item.collaborators.some(collab => String(collab) === String(user?.email))) ||
            String(item.lastModifiedBy) === String(user?.email);

          return hasTimelineModifications || hasAttendanceRecords || isCollaborator;
        }

        return false;
      });
      setOpportunities(filtered || []);
    } catch (err) {
      setError(err.message || "Failed to load your opportunities");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  const sorted = useMemo(
    () =>
      [...opportunities].sort(
        (a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
      ),
    [opportunities]
  );

  const handleEdit = async (item) => {
    const id = item.id || item._id;
    const isCreator = String(item.createdByEmail) === String(user?.email);

    if (!isCreator) {
      setError("You can only edit opportunities you created");
      toast.error("You can only edit opportunities you created");
      return;
    }
    if (isArchived(item)) {
      setError("Cannot edit archived opportunities");
      toast.error("Cannot edit archived opportunities");
      return;
    }
    setSearchParams({ edit: id });
  };

  const handleDelete = (item) => {
    const id = item.id || item._id;
    const isCreator = String(item.createdByEmail) === String(user?.email);

    if (!isCreator) {
      setError("You can only delete opportunities you created");
      toast.error("You can only delete opportunities you created");
      return;
    }

    toast.custom(
      (t) => (
        <div className="w-[320px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
          <p className="font-semibold text-slate-900">Delete this opportunity?</p>
          <p className="mt-1 text-sm text-slate-600">This action cannot be undone.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
              onClick={() => toast.dismiss(t.id)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white"
              onClick={async () => {
                toast.dismiss(t.id);
                setDeletingId(id);
                try {
                  await deleteOpportunity(id);
                  toast.success("Opportunity deleted successfully", { icon: "🗑️" });
                  await loadOpportunities();
                } catch (deleteError) {
                  const errorMessage = deleteError.message || "Failed to delete opportunity";
                  toast.error(errorMessage);
                  setError(errorMessage);
                } finally {
                  setDeletingId("");
                }
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ),
      { duration: Infinity }
    );
  };

  return (
    <>
      <Layout role="Faculty">
        <SectionTitle title="My Posts" subtitle="All opportunities posted or managed by you." />
        <StatusMessage type="error" message={error} />
        {loading ? (
          <div className="py-8 flex justify-center"><Spinner /></div>
        ) : sorted.length ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sorted.map((item) => {
              const isCreator = String(item.createdByEmail) === String(user?.email);
              return (
                <OpportunityCard
                  key={item._id}
                  opportunity={item}
                  canManage={isCreator}
                  onEdit={isCreator ? handleEdit : undefined}
                  onDelete={isCreator ? handleDelete : undefined}
                  editDisabled={isArchived(item) || !isCreator}
                  deleteLoading={deletingId === (item.id || item._id)}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState title="No posts yet" subtitle="Your opportunities will appear here." />
        )}
      </Layout>
      <Footer />
    </>
  );
};

export default MyPostsPage;
