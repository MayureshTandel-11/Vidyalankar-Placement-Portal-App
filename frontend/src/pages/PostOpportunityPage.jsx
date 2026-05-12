import { useState, useMemo } from "react";
import toast from "react-hot-toast";
import api, { extractApiError } from "../api";
import Layout from "../components/Layout";
import Footer from "../components/Footer";
import OpportunityForm from "../components/OpportunityForm";
import { SectionTitle, StatusMessage } from "../components/ui";
import { useAuth } from "../context/AuthContext";

const PostOpportunityPage = () => {
  const { user } = useAuth();

  const initial = useMemo(
    () => ({
      announcementHeading: "",
      type: "Internship",
      description: "",
      eligibilityCriteria: [],
      lastDate: "",
      department: user?.department || "",
      technicalSkills: [],
      applicationLink: "",
    }),
    [user?.department]
  );

  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    setMessage("");
    const hasEligibility = Array.isArray(form.eligibilityCriteria)
      ? form.eligibilityCriteria.length > 0
      : Boolean(form.eligibilityCriteria);
    if (!form.announcementHeading || !form.type || !form.description || !hasEligibility || !form.lastDate) {
      setError("Please fill all required opportunity fields.");
      return;
    }
    setLoading(true);
    try {
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
      await api.post("/opportunities", payload);
      setForm(initial);
      setMessage("Opportunity created successfully.");
      toast.success("Opportunity created");
    } catch (err) {
      setError(extractApiError(err, "Unable to save opportunity."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <><Layout role="Faculty">
      <SectionTitle title="Post Opportunity" subtitle="Create new opportunities for your department." />
      <StatusMessage message={message} />
      <StatusMessage type="error" message={error} />
      {/* <OpportunityForm
        value={form}
        onChange={setForm}
        onSubmit={submit}
        submitLabel="Create Opportunity"
        showDepartment
        departmentLocked
        loading={loading} /> */}
    </Layout><Footer /></>
  );
};

export default PostOpportunityPage;
