const mongoose = require("mongoose");

// Book schema
const BookSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true }, 
  author: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  category: { type: String, default: "Uncategorized" }, 
  quantity: { type: Number, default: 0 }, 
  available: { type: Boolean, default: true },
  image: { type: String, default: "" }, // Cloudinary URL
  rating: { type: Number, min: 1, max: 5, default: 5 },
  averageRating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 }
}, { timestamps: true });

// Add pre-save middleware to ensure required fields
BookSchema.pre('save', function(next) {
  // Ensure title and author are not empty
  if (!this.title || this.title.trim() === '') {
    this.title = 'Untitled Book';
  }
  
  if (!this.author || this.author.trim() === '') {
    this.author = 'Unknown Author';
  }
  
  next();
});

// Book model
const Book = mongoose.model("Book", BookSchema);

module.exports = Book;