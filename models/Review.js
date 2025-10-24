

const reviewSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    author: {
      name: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
      },
      photoURL: {
        type: String,
        default: "",
      },
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    category: {
      type: String,
      enum: ["Review", "Blog", "Recommendation"],
      default: "Review",
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

const Review = mongoose.model("Review", reviewSchema);

module.exports = Review;
