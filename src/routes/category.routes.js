import express from "express"
import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controller.js"
import { verifyAuth, verifyAdmin } from "../middleware/auth.js"
import { validateCategory } from "../middleware/validate.js"

const router = express.Router()

// Listar (admin para config; también usado por productos - mismo rol admin)
router.get("/", verifyAuth, verifyAdmin, getAllCategories)
router.get("/:id", verifyAuth, verifyAdmin, getCategoryById)

// CRUD solo admin
router.post("/", verifyAuth, verifyAdmin, validateCategory, createCategory)
router.put("/:id", verifyAuth, verifyAdmin, validateCategory, updateCategory)
router.delete("/:id", verifyAuth, verifyAdmin, deleteCategory)

export default router
