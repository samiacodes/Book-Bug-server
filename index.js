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
const { verifyFirebaseToken } = require("./middleware/verifyFirebaseToken");

// Import models
const Book = require("./models/Book");

const borrowedSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },
  borrowedDate: { type: Date, default: Date.now },
  returnDate: { type: Date },
});

const BorrowedBook = mongoose.model("BorrowedBook", borrowedSchema);

// Import models
const Review = require("./models/Review");

// Function to update book's average rating and review count
const updateBookRating = async (bookId) => {
  try {
    // Get all reviews for this book
    const reviews = await Review.find({ bookId });
    
    if (reviews.length === 0) {
      // If no reviews, reset to default values
      await Book.findByIdAndUpdate(bookId, {
        averageRating: 0,
        reviewCount: 0
      });
      return;
    }
    
    // Calculate average rating
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;
    
    // Update book with new average rating and review count
    await Book.findByIdAndUpdate(bookId, {
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
      reviewCount: reviews.length
    });
  } catch (err) {
    console.error("Error updating book rating:", err);
  }
};

// Banner Schema
const bannerSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subtitle: { type: String },
  imageUrl: { type: String, required: true },
  active: { type: Boolean, default: false },
}, { timestamps: true });

const Banner = mongoose.model("Banner", bannerSchema);

// Import models
const Category = require("./models/Category");

// Create Book (POST)
app.post("/books", verifyFirebaseToken, async (req, res) => {
  const { title, author, description, category, quantity, available, image, rating } = req.body;
  
  // Validate required fields
  if (!title || !author) {
    return res.status(400).json({ message: "Title and author are required" });
  }
  
  const newBook = new Book({
    title,
    author,
    description: description || "",
    category: category || "Uncategorized",
    quantity: quantity !== undefined ? quantity : 0,
    available: available !== undefined ? available : true,
    image: image || "",
    rating: rating !== undefined ? rating : 5
  });

  try {
    await newBook.save();
    res.status(201).json({ message: "Book added successfully", newBook });
  } catch (err) {
    res.status(500).json({ message: "Failed to add book", error: err.message });
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
  const { title, author, description, category, quantity, available, image, rating } = req.body;
  
  // Prepare update object with only provided fields
  const updateFields = {};
  if (title !== undefined) updateFields.title = title;
  if (author !== undefined) updateFields.author = author;
  if (description !== undefined) updateFields.description = description;
  if (category !== undefined) updateFields.category = category;
  if (quantity !== undefined) updateFields.quantity = quantity;
  if (available !== undefined) updateFields.available = available;
  if (image !== undefined) updateFields.image = image;
  if (rating !== undefined) updateFields.rating = rating;

  try {
    const result = await Book.findByIdAndUpdate(id, updateFields, { new: true });
    if (!result) return res.status(404).json({ message: "Book not found" });
    res.json({ message: "Book updated successfully", updatedBook: result });
  } catch (err) {
    res.status(500).json({ message: "Failed to update book", error: err.message });
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
    // Find the book to delete to get its ID for reference
    const bookToDelete = await Book.findById(id);
    if (!bookToDelete) return res.status(404).json({ message: "Book not found" });
    
    // Delete all reviews associated with this book
    await Review.deleteMany({ bookId: id });
    
    // Delete all borrowed records for this book
    await BorrowedBook.deleteMany({ bookId: id });
    
    // Delete the book itself
    const result = await Book.findByIdAndDelete(id);
    
    res.json({ message: "Book, associated reviews, and borrowed records deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete book", error: err });
  }
});

// ==================== REVIEW ROUTES ====================

// Get All Reviews (GET)
app.get("/reviews", async (req, res) => {
  try {
    let query = {};
    
    // Filter by bookId if provided
    if (req.query.bookId) {
      query.bookId = req.query.bookId;
    }
    
    const reviews = await Review.find(query).sort({ createdAt: -1 });
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
  const { title, content, author, rating, category, bookId } = req.body;

  if (!title || !content || !author?.name || !author?.email || !bookId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  // Verify that the book exists
  const book = await Book.findById(bookId);
  if (!book) {
    return res.status(404).json({ message: "Book not found" });
  }

  const newReview = new Review({
    title,
    content,
    author,
    rating: rating || 5,
    category: category || "Review",
    bookId,
  });

  try {
    await newReview.save();
    
    // Update book's average rating and review count
    await updateBookRating(bookId);
    
    res.status(201).json({ message: "Review created successfully", review: newReview });
  } catch (err) {
    res.status(500).json({ message: "Failed to create review", error: err });
  }
});

// Update Review (PUT)
app.put("/reviews/:id", async (req, res) => {
  const { id } = req.params;
  const { title, content, rating, category, bookId } = req.body;

  try {
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ message: "Review not found" });

    // Only allow the author to update their review
    if (req.body.userEmail && review.author.email !== req.body.userEmail) {
      return res.status(403).json({ message: "Unauthorized to update this review" });
    }

    const updateData = { title, content, rating, category };
    
    // Only update bookId if it's provided
    if (bookId !== undefined) {
      updateData.bookId = bookId;
    }

    const updatedReview = await Review.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );
    
    // Update book's average rating and review count
    await updateBookRating(updatedReview.bookId);

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
    
    // Update book's average rating and review count
    await updateBookRating(review.bookId);
    
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

// ==================== CATEGORY ROUTES ====================

// Get All Categories (GET)
app.get("/categories", async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.status(200).json(categories);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ message: "Failed to fetch categories", error: err.message });
  }
});

// Create Category (POST)
app.post("/categories", verifyFirebaseToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // Check if category already exists
    const existingCategory = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingCategory) {
      return res.status(400).json({ message: "Category already exists" });
    }
    
    const newCategory = new Category({
      name,
      description
    });
    
    await newCategory.save();
    res.status(201).json({ message: "Category created successfully", category: newCategory });
  } catch (err) {
    console.error("Error creating category:", err);
    res.status(500).json({ message: "Failed to create category", error: err.message });
  }
});

// Update Category (PUT)
app.put("/categories/:id", verifyFirebaseToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    // Check if another category with the same name exists
    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      _id: { $ne: id }
    });
    if (existingCategory) {
      return res.status(400).json({ message: "Category name already exists" });
    }
    
    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { name, description, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!updatedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }
    
    res.status(200).json({ message: "Category updated successfully", category: updatedCategory });
  } catch (err) {
    console.error("Error updating category:", err);
    res.status(500).json({ message: "Failed to update category", error: err.message });
  }
});

// Delete Category (DELETE)
app.delete("/categories/:id", verifyFirebaseToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedCategory = await Category.findByIdAndDelete(id);
    
    if (!deletedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }
    
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (err) {
    console.error("Error deleting category:", err);
    res.status(500).json({ message: "Failed to delete category", error: err.message });
  }
});

// ==================== USER MANAGEMENT ROUTES ====================

// Get All Users (GET) - Admin only
app.get("/users", verifyFirebaseToken, async (req, res) => {
  try {
    // Check if user is admin by email (matching client-side logic)
    if (req.user.email !== "admin@bookbug.com") {
      return res.status(403).send({ error: "Forbidden - Admin access required" });
    }
    
    // Import admin SDK
    const admin = require("./firebaseAdmin");
    
    // Fetch all users from Firebase Authentication
    const listUsersResult = await admin.auth().listUsers();
    const users = listUsersResult.users.map(userRecord => ({
      uid: userRecord.uid,
      email: userRecord.email || '',
      displayName: userRecord.displayName || '',
      photoURL: userRecord.photoURL || '',
      disabled: userRecord.disabled || false,
      emailVerified: userRecord.emailVerified || false,
      createdAt: userRecord.metadata.creationTime,
      lastSignInAt: userRecord.metadata.lastSignInTime,
      role: userRecord.email === 'admin@bookbug.com' ? 'admin' : 'user'
    }));
    
    res.status(200).json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Failed to fetch users", error: err.message });
  }
});

// ==================== DASHBOARD STATISTICS ROUTES ====================

// Get Dashboard Statistics (GET)
app.get("/dashboard/stats", async (req, res) => {
  try {
    // Get total books count
    const totalBooks = await Book.countDocuments();
    
    // Get total banners count
    const totalBanners = await Banner.countDocuments();
    
    // Get borrowed books count (books that have been borrowed but not returned)
    const borrowedBooks = await BorrowedBook.countDocuments({ returnDate: null });
    
    // Get all books to calculate categories (matching frontend logic)
    const books = await Book.find();
    const categories = [...new Set(books.map(book => book.category).filter(Boolean))].length;
    
    // For total users, we would typically integrate with Firebase Admin SDK
    // Since we don't have direct access to Firebase users, we'll estimate based on borrowed books
    // In a real implementation, you would use Firebase Admin SDK to get actual user count
    const totalUsers = await BorrowedBook.distinct("userEmail").then(users => users.length);
    
    const stats = {
      totalBooks,
      totalUsers,
      borrowedBooks,
      categories,
      totalBanners
    };
    
    console.log("Dashboard stats response:", JSON.stringify(stats, null, 2));
    
    res.status(200).json(stats);
  } catch (err) {
    console.error("Error fetching dashboard stats:", err);
    res.status(500).json({ message: "Failed to fetch dashboard statistics", error: err.message });
  }
});

// Get Recent Books (GET)
app.get("/dashboard/recent-books", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const recentBooks = await Book.find().sort({ _id: -1 }).limit(limit);
    res.status(200).json(recentBooks);
  } catch (err) {
    console.error("Error fetching recent books:", err);
    res.status(500).json({ message: "Failed to fetch recent books", error: err.message });
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
