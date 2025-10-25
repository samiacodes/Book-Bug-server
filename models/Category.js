const mongoose = require("mongoose");

// Category schema
const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Category model
const Category = mongoose.model("Category", CategorySchema);

module.exports = Category;