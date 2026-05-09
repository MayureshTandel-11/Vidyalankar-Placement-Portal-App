import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api, { extractApiData, extractApiError } from "../api";
import Layout from "../components/Layout";
import Footer from "../components/Footer";
import OpportunityCard from "../components/OpportunityCard";
import OpportunityForm from "../components/OpportunityForm";
import { EmptyState, SectionTitle, Spinner, StatusMessage, Modal } from "../components/ui";
import { useAuth } from "../context/AuthContext";

const getInitialForm = (facultyDepartment) => ({
  announcementHeading: "",
  type: "Internship",
  description: "",
  eligibilityCriteria: [],
  lastDate: "",
  department: facultyDepartment || "",
  technicalSkills: [],
  applicationLink: "",
});

const normalizeToForm = (item) => ({
  announcementHeading: item.announcementHeading || "",
  type: item.type || "Internship",
  description: item.description || "",
  eligibilityCriteria: (item.eligibilityCriteria || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean),
  lastDate: item.lastDate ? new Date(item.lastDate).toISOString().slice(0, 10) : "",
  department: item.department || "",
  technicalSkills: Array.isArray(item.technicalSkills) ? item.technicalSkills : [],
  applicationLink: item.applicationLink || "",
});

const isArchived = (item) => {
  const lastMidnight = new Date(item.lastDate);
  lastMidnight.setHours(0, 0, 0, 0);
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  return todayMidnight > lastMidnight;
};

const isOwner = (opportunity, userEmail) => {
  if (!opportunity || !userEmail) return false;
  return String(opportunity.createdBy) === String(userEmail);
};

const validateForm = (form) => {
  const trimmedHeading = form.announcementHeading.trim();
  const trimmedDescription = form.description.trim();
  const selectedDate = new Date(form.lastDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  selectedDate.setHours(0, 0, 0, 0);

  const hasEligibility = Array.isArray(form.eligibilityCriteria)
    ? form.eligibilityCriteria.length > 0
    : Boolean(form.eligibilityCriteria?.trim?.());

  if (!trimmedHeading || !form.type || !trimmedDescription || !form.lastDate || !hasEligibility) {
    return "Please fill all required fields (including eligibility criteria)";
  }
  if (trimmedDescription.length > 10000) {
    return "Description must be less than 10000 characters";
  }
  if (selectedDate < today) {
    return "Last date cannot be in the past";
  }
  return "";
};

const MyPostsPage = () => {
  const { user } = useAuth();
  const [active, setActive] = useState([]);
  const [archive, setArchive] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => getInitialForm(user?.department));
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const loadOpportunities = async () => {
    setLoading(true);
    setError("");
    try {
      const [activeRes, archiveRes] = await Promise.all([
        api.get("/opportunities/active"),
        api.get("/opportunities/archive"),
      ]);
      setActive(extractApiData(activeRes) || []);
      setArchive(extractApiData(archiveRes) || []);
    } catch (err) {
      setError(extractApiError(err, "Failed to load your opportunities"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOpportunities();
  }, []);

  const allPosts = useMemo(() => [...active, ...archive], [active, archive]);

  const handleEdit = async (item) => {
    if (!isOwner(item, user?.email)) {
      setError("You don't have permission to edit this opportunity");
      toast.error("You don't have permission to edit this opportunity");
      return;
    }
    if (isArchived(item)) {
      setError("Cannot edit archived opportunities");
      toast.error("Cannot edit archived opportunities");
      return;
    }
    setEditingId(item.id || item._id);
    setForm(normalizeToForm(item));
    setIsModalOpen(true);
  };

  const handleDelete = (item) => {
    const id = item.id || item._id;

    if (!isOwner(item, user?.email)) {
      setError("You don't have permission to delete this opportunity");
      toast.error("You don't have permission to delete this opportunity");
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
                  await api.delete(`/opportunities/${id}`);
                  toast.success("Opportunity deleted successfully", { icon: "🗑️" });
                  await loadOpportunities();
                } catch (deleteError) {
                  const errorMessage = extractApiError(deleteError, "Failed to delete opportunity");
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

  const handleSubmit = async () => {
    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }
    setSaving(true);
    setError("");

    const payload = {
      ...form,
      announcementHeading: form.announcementHeading.trim(),
      description: form.description.trim(),
      department: form.department,
      applicationLink: form.applicationLink || "",
      eligibilityCriteria: Array.isArray(form.eligibilityCriteria)
        ? form.eligibilityCriteria.filter(Boolean).join(", ")
        : (form.eligibilityCriteria || "").trim(),
    };

    try {
      if (editingId) {
        await api.put(`/opportunities/${editingId}`, payload);
        toast.success("Opportunity updated successfully!");
      } else {
        await api.post("/opportunities", payload);
        toast.success("Opportunity created successfully!");
      }
      await loadOpportunities();
      setIsModalOpen(false);
      resetForm();
    } catch (submitError) {
      const errorMessage = extractApiError(submitError, "Failed to save opportunity");
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm(getInitialForm(user?.department));
    setEditingId(null);
  };

  return (
    <>
      <Layout role="Faculty">
        <SectionTitle title="My Posts" subtitle="All opportunities posted or broadcasted by you." />
        <StatusMessage type="error" message={error} />
        {loading ? (
          <div className="py-8 flex justify-center"><Spinner /></div>
        ) : allPosts.length ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {allPosts.map((item) => (
              <OpportunityCard
                key={item._id}
                opportunity={item}
                canManage={true}
                onEdit={handleEdit}
                onDelete={handleDelete}
                deleteLoading={deletingId === (item.id || item._id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No posts yet" subtitle="Your active and archived posts will appear here." />
        )}

        <Modal
          open={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            resetForm();
          }}
          title={editingId ? "Edit Opportunity" : "Create Opportunity"}
        >
          <OpportunityForm
            value={form}
            onChange={setForm}
            onSubmit={handleSubmit}
            submitLabel={editingId ? "Update Opportunity" : "Create Opportunity"}
            showDepartment={false}
            departmentLocked={true}
            loading={saving}
            isEditing={!!editingId}
            onCancelEdit={() => {
              setIsModalOpen(false);
              resetForm();
            }}
          />
        </Modal>
      </Layout>
      <Footer />
    </>
  );
};

export default MyPostsPage;
