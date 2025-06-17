const mongoose = require("mongoose");

// Book schema
const BookSchema = new mongoose.Schema({
  title: { type: String, required: true }, 
  description: { type: String },
  category: { type: String }, 
  quantity: { type: Number, default: 0 }, 
  available: { type: Boolean, default: true },
});

// Book মডেল তৈরি করা
const Book = mongoose.model("Book", BookSchema);

module.exports = Book;
