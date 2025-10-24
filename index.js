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

// Create Book (POST)
app.post("/books", async (req, res) => {
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

  let query = {};
  if (category) query.category = category;
  if (available) query.quantity = { $gt: 0 };

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
app.put("/books/:id", async (req, res) => {
  // Firebase Token check added here
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
app.post("/borrow",  async (req, res) => {
  // Firebase Token check added here
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
app.get("/borrowed",  async (req, res) => {
  
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
app.delete("/borrowed/:id",  async (req, res) => {
  
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
app.delete("/books/:id",  async (req, res) => {
  // Firebase Token check added here
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

// Default Route
app.get("/", (req, res) => {
  res.send("Book Nest Cooking");
});

// Start Server
app.listen(port, () => {
  console.log(`Book Nest Server is running on port http://localhost:${port}`);
});
