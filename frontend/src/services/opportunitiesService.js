import api, { extractApiData, extractApiError } from "../api";

export const getOpportunities = async () => {
  const response = await api.get("/opportunities");
  return extractApiData(response) || [];
};

export const getOpportunityById = async (id) => {
  try {
    const response = await api.get(`/opportunities/${id}`);
    return extractApiData(response);
  } catch (error) {
    throw new Error(extractApiError(error, "Opportunity not found"));
  }
};

export const createOpportunity = async (payload) => {
  try {
    const response = await api.post("/opportunities", payload);
    return extractApiData(response);
  } catch (error) {
    throw new Error(extractApiError(error, "Failed to create opportunity"));
  }
};

export const updateOpportunity = async (id, payload) => {
  try {
    const response = await api.put(`/opportunities/${id}`, payload);
    return extractApiData(response);
  } catch (error) {
    const message = extractApiError(error, "Failed to update opportunity");
    if (error?.response?.status === 409) throw new Error("Cannot edit archived opportunities");
    if (error?.response?.status === 403) throw new Error("You don't have permission to edit this opportunity");
    throw new Error(message);
  }
};

export const applyToOpportunity = async (id) => {
  try {
    const response = await api.post(`/opportunities/${id}/apply`);
    return extractApiData(response);
  } catch (error) {
    const message = extractApiError(error, "Failed to apply");
    if (error?.response?.status === 400 && message.includes("already applied")) {
      throw new Error("You have already applied to this opportunity");
    }
    if (error?.response?.status === 403) throw new Error("Only students can apply");
    if (error?.response?.status === 400 && message.includes("archived")) {
      throw new Error("Cannot apply to archived opportunities");
    }
    throw new Error(message);
  }
};

export const getApplicantsCount = async (id) => {
  try {
    const response = await api.get(`/opportunities/${id}/applicants/count`);
    return extractApiData(response);
  } catch (error) {
    throw new Error(extractApiError(error, "Failed to fetch applicant count"));
  }
};

export const getApplicants = async (id) => {
  try {
    const response = await api.get(`/opportunities/${id}/applicants`);
    return extractApiData(response);
  } catch (error) {
    throw new Error(extractApiError(error, "Failed to fetch applicants"));
  }
};

export const getOpportunityApplications = async (id) => {
  try {
    const response = await api.get(`/opportunities/${id}/applications`);
    return extractApiData(response) || { applications: [] };
  } catch (error) {
    throw new Error(extractApiError(error, "Failed to fetch applications"));
  }
};

export const deleteOpportunity = async (id) => {
  try {
    const response = await api.delete(`/opportunities/${id}`);
    return extractApiData(response);
  } catch (error) {
    const message = extractApiError(error, "Failed to delete opportunity");
    if (error?.response?.status === 403) throw new Error("You don't have permission to delete this opportunity");
    if (error?.response?.status === 404) throw new Error("Opportunity not found");
    throw new Error(message);
  }
};

// Result Section APIs
export const getResultStudents = async (opportunityId) => {
  try {
    const response = await api.get(`/results/${opportunityId}`);
    return extractApiData(response) || { resultStudents: [] };
  } catch (error) {
    throw new Error(extractApiError(error, "Failed to fetch result students"));
  }
};

export const uploadOfferLetter = async (opportunityId, studentId, file) => {
  try {
    const formData = new FormData();
    formData.append("opportunityId", opportunityId);
    formData.append("studentId", studentId);
    formData.append("offerLetter", file);

    const response = await api.post("/results/upload-offer-letter", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return extractApiData(response);
  } catch (error) {
    const message = extractApiError(error, "Failed to upload offer letter");
    if (error?.response?.status === 400 && message.includes("PDF")) {
      throw new Error("Only PDF files are allowed");
    }
    if (error?.response?.status === 400 && message.includes("5MB")) {
      throw new Error("File size exceeds 5MB limit");
    }
    throw new Error(message);
  }
};

export const downloadOfferLetter = async (offerId) => {
  try {
    const response = await api.get(`/results/download/${offerId}`, {
      responseType: "blob",
    });

    const blob = new Blob([response.data], { type: "application/pdf" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    const contentDisposition = response.headers["content-disposition"];
    let filename = "offer-letter.pdf";

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    const message = extractApiError(error, "Failed to download offer letter");
    if (error?.response?.status === 403) throw new Error("You don't have permission to download this offer letter");
    if (error?.response?.status === 404) throw new Error("Offer letter not found");
    throw new Error(message);
  }
};
