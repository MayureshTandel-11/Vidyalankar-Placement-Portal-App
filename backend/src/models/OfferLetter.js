const mongoose = require("mongoose");

const offerLetterSchema = new mongoose.Schema(
  {
    // Link to the opportunity
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Opportunity",
      required: true,
      index: true,
    },
    // Student who receives the offer
    studentId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    // File information
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    filePath: {
      type: String,
      required: true,
      trim: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    // Upload metadata
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound unique index: one offer letter per student per opportunity
offerLetterSchema.index(
  { opportunityId: 1, studentId: 1 },
  { unique: true, name: "opportunity_student_offer_unique" }
);

module.exports = mongoose.model("OfferLetter", offerLetterSchema);
