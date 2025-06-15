const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.as2f3ea.mongodb.net/bookNest?retryWrites=true&w=majority`;

// MongoDB Connection
mongoose
  .connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB connection error:", err));

// Mongoose Schema & Model
const bookSchema = new mongoose.Schema({
  name: { type: String, required: true },
  author: { type: String, required: true },
  category: { type: String, required: true },
  image: { type: String },
  rating: { type: Number, min: 1, max: 5 },
});

const Book = mongoose.model("Book", bookSchema);

// Create Book (POST)
app.post("/books", async (req, res) => {
  const { name, author, category, image, rating } = req.body;
  const newBook = new Book({ name, author, category, image, rating });

  try {
    await newBook.save();
    res.status(201).json({ message: "Book added successfully", newBook });
  } catch (err) {
    res.status(500).json({ message: "Failed to add book", error: err });
  }
});

// Get All Books (GET)
app.get("/books", async (req, res) => {
  try {
    const books = await Book.find();
    res.json(books);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch books", error: err });
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

// Delete Book (DELETE)
app.delete("/books/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await Book.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ message: "Book not found" });
    res.json({ message: "Book deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete book", error: err });
  }
});


app.get("/", (req, res) => {
  res.send("Book Nest Cooking");
});

app.listen(port, () => {
  console.log(`Book Nest Server Is running on port http://localhost:${port}`);
});
