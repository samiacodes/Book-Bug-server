const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.use(
  cors({
    origin: "*"
  })
);

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nxpjara.mongodb.net/?appName=Cluster0`;

// MongoDB Connection
mongoose
  .connect(uri)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB connection error:", err));

// Import middleware
const { verifyFirebaseToken, verifyAdmin } = require("./middleware/verifyFirebaseToken");

// Mongoose Schema & Model
const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  category: { type: String },
  quantity: { type: Number, default: 0 },
  available: { type: Boolean, default: true },
});

const borrowedSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },
  borrowedDate: { type: Date, default: Date.now },
  returnDate: { type: Date },
});

const BorrowedBook = mongoose.model("BorrowedBook", borrowedSchema);
const Book = mongoose.model("Book", bookSchema);

// Review Schema
const reviewSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    author: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      photoURL: { type: String, default: "" },
    },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    category: {
      type: String,
      enum: ["Review", "Blog", "Recommendation"],
      default: "Review",
    },
  },
  { timestamps: true }
);

const Review = mongoose.model("Review", reviewSchema);

// Banner Schema
const bannerSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subtitle: { type: String },
  imageUrl: { type: String, required: true },
  active: { type: Boolean, default: false },
}, { timestamps: true });

const Banner = mongoose.model("Banner", bannerSchema);

// Create Book (POST)
app.post("/books", verifyFirebaseToken, async (req, res) => {
  const { title, description, category, quantity, available } = req.body;
  const newBook = new Book({
    title,
    description,
    category,
    quantity,
    available,
  });

  try {
    await newBook.save();
    res.status(201).json({ message: "Book added successfully", newBook });
  } catch (err) {
    res.status(500).json({ message: "Failed to add book", error: err });
  }
});

// Get All Books (GET)
app.get("/books", async (req, res) => {
  const category = req.query.category;
  const available = req.query.available === "true";
  const search = req.query.search;

  let query = {};
  if (category) query.category = category;
  if (available) query.quantity = { $gt: 0 };
  
  // Add search functionality
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } }
    ];
  }

  try {
    const result = await Book.find(query);
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: "Failed to get books", error: err });
  }
});

// Get Single Book (GET)
app.get("/books/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const book = await Book.findById(id);
    if (!book) return res.status(404).json({ message: "Book not found" });
    res.json(book);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch book", error: err });
  }
});

// Update Book (PUT)
app.put("/books/:id", verifyFirebaseToken, async (req, res) => {
  const { id } = req.params;
  const updatedBook = req.body;

  try {
    const result = await Book.findByIdAndUpdate(id, updatedBook, { new: true });
    if (!result) return res.status(404).json({ message: "Book not found" });
    res.json({ message: "Book updated successfully", updatedBook: result });
  } catch (err) {
    res.status(500).json({ message: "Failed to update book", error: err });
  }
});

// Borrow Book (POST)
app.post("/borrow", verifyFirebaseToken, async (req, res) => {
  const { userEmail, bookId } = req.body;

  try {
    const alreadyBorrowed = await BorrowedBook.findOne({
      userEmail,
      bookId,
    });

    if (alreadyBorrowed) {
      return res
        .status(400)
        .json({ message: "You have already borrowed this book!" });
    }

    await Book.findByIdAndUpdate(bookId, { $inc: { quantity: -1 } });

    const borrowed = new BorrowedBook({ userEmail, bookId });
    await borrowed.save();
    res.status(200).json({ message: "Book borrowed successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to borrow book", error: err });
  }
});

// Get Borrowed Books (GET)
app.get("/borrowed", verifyFirebaseToken, async (req, res) => {
  
  const { email } = req.query;
  try {
    const borrowedBooks = await BorrowedBook.find({
      userEmail: email,
    }).populate("bookId");
    res.send(borrowedBooks);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch borrowed books", error: err });
  }
});

// Return Book (DELETE)
app.delete("/borrowed/:id", verifyFirebaseToken, async (req, res) => {
  
  const borrowedId = req.params.id;

  try {
    const borrowedEntry = await BorrowedBook.findById(borrowedId);
    if (!borrowedEntry)
      return res.status(404).json({ message: "Borrowed entry not found" });

    borrowedEntry.returnDate = new Date();
    await borrowedEntry.save();

    await Book.findByIdAndUpdate(borrowedEntry.bookId, {
      $inc: { quantity: 1 },
    });
    await BorrowedBook.findByIdAndDelete(borrowedId);

    res.json({ message: "Book returned successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to return book", error: err });
  }
});
app.put("/book/return", async (req, res) => {
  try {
    const { bookId } = req.body;
    if (!bookId) {
      return res.status(400).send({ error: "Book ID is required" });
    }

    // Increase the book quantity by 1 using $inc
    const updatedBook = await Book.updateOne(
      { _id: bookId },
      { $inc: { quantity: 1 } } 
    );

    if (updatedBook.modifiedCount === 0) {
      return res.status(404).send({ error: "Book not found" });
    }

    res.status(200).send({ message: "Book quantity updated successfully" });
  } catch (err) {
    console.error("Error updating book quantity:", err);
    res.status(500).send({ error: "Failed to update book quantity" });
  }
});

// Delete Book (DELETE)
app.delete("/books/:id", verifyFirebaseToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await Book.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ message: "Book not found" });
    res.json({ message: "Book deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete book", error: err });
  }
});

// ==================== REVIEW ROUTES ====================

// Get All Reviews (GET)
app.get("/reviews", async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 });
    res.status(200).json(reviews);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch reviews", error: err });
  }
});

// Get Single Review (GET)
app.get("/reviews/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ message: "Review not found" });
    res.status(200).json(review);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch review", error: err });
  }
});

// Create Review (POST)
app.post("/reviews", async (req, res) => {
  const { title, content, author, rating, category } = req.body;

  if (!title || !content || !author?.name || !author?.email) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const newReview = new Review({
    title,
    content,
    author,
    rating: rating || 5,
    category: category || "Review",
  });

  try {
    await newReview.save();
    res.status(201).json({ message: "Review created successfully", review: newReview });
  } catch (err) {
    res.status(500).json({ message: "Failed to create review", error: err });
  }
});

// Update Review (PUT)
app.put("/reviews/:id", async (req, res) => {
  const { id } = req.params;
  const { title, content, rating, category } = req.body;

  try {
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ message: "Review not found" });

    // Only allow the author to update their review
    if (req.body.userEmail && review.author.email !== req.body.userEmail) {
      return res.status(403).json({ message: "Unauthorized to update this review" });
    }

    const updatedReview = await Review.findByIdAndUpdate(
      id,
      { title, content, rating, category },
      { new: true }
    );

    res.status(200).json({ message: "Review updated successfully", review: updatedReview });
  } catch (err) {
    res.status(500).json({ message: "Failed to update review", error: err });
  }
});

// Delete Review (DELETE)
app.delete("/reviews/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ message: "Review not found" });

    // Only allow the author to delete their review
    if (req.body.userEmail && review.author.email !== req.body.userEmail) {
      return res.status(403).json({ message: "Unauthorized to delete this review" });
    }

    await Review.findByIdAndDelete(id);
    res.status(200).json({ message: "Review deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete review", error: err });
  }
});

// ==================== BANNER ROUTES ====================

// Get All Banners (GET)
app.get("/banners", async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });
    res.status(200).json(banners);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch banners", error: err });
  }
});

// Get Active Banner (GET)
app.get("/banners/active", async (req, res) => {
  try {
    const banner = await Banner.findOne({ active: true });
    res.status(200).json(banner);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch active banner", error: err });
  }
});

// Create Banner (POST) - Protected route
app.post("/banners", verifyFirebaseToken, async (req, res) => {
  try {
    const { title, subtitle, imageUrl, active } = req.body;
    
    // Create new banner
    const newBanner = new Banner({
      title,
      subtitle,
      imageUrl,
      active
    });
    
    const savedBanner = await newBanner.save();
    res.status(201).json({ message: "Banner created successfully", banner: savedBanner });
  } catch (err) {
    res.status(500).json({ message: "Failed to create banner", error: err });
  }
});

// Update Banner (PUT) - Protected route
app.put("/banners/:id", verifyFirebaseToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subtitle, imageUrl, active } = req.body;
    
    const updatedBanner = await Banner.findByIdAndUpdate(
      id,
      { title, subtitle, imageUrl, active },
      { new: true }
    );
    
    if (!updatedBanner) {
      return res.status(404).json({ message: "Banner not found" });
    }
    
    res.status(200).json({ message: "Banner updated successfully", banner: updatedBanner });
  } catch (err) {
    res.status(500).json({ message: "Failed to update banner", error: err });
  }
});

// Delete Banner (DELETE) - Protected route
app.delete("/banners/:id", verifyFirebaseToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedBanner = await Banner.findByIdAndDelete(id);
    
    if (!deletedBanner) {
      return res.status(404).json({ message: "Banner not found" });
    }
    
    res.status(200).json({ message: "Banner deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete banner", error: err });
  }
});

// Set Active Banner (PUT) - Protected route
app.put("/banners/:id/active", verifyFirebaseToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First, set all banners to inactive
    await Banner.updateMany({}, { active: false });
    
    // Then, set the specified banner to active
    const updatedBanner = await Banner.findByIdAndUpdate(
      id,
      { active: true },
      { new: true }
    );
    
    if (!updatedBanner) {
      return res.status(404).json({ message: "Banner not found" });
    }
    
    res.status(200).json({ message: "Banner set as active successfully", banner: updatedBanner });
  } catch (err) {
    res.status(500).json({ message: "Failed to set active banner", error: err });
  }
});

// Default Route
app.get("/", (req, res) => {
  res.send("Book Nest Cooking");
});

// Start Server
app.listen(port, () => {
  console.log(`Book Nest Server is running on port http://localhost:${port}`);
});
