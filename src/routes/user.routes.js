import express from "express"
import { verifyAuth, verifyAdmin } from "../middleware/auth.js"
import {
  getProfile,
  updateProfile,
  changePassword,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
} from "../controllers/user.controller.js"
import { validateUpdateProfile, validateChangePassword, validateCreateUser } from "../middleware/validate.js"

const router = express.Router()

// Rutas de perfil (cualquier usuario autenticado)
router.get("/profile", verifyAuth, getProfile)
router.put("/profile", verifyAuth, validateUpdateProfile, updateProfile)
router.post("/change-password", verifyAuth, validateChangePassword, changePassword)

// Rutas de gestión de usuarios (solo admin)
router.get("/", verifyAuth, verifyAdmin, getAllUsers)
router.post("/", verifyAuth, verifyAdmin, validateCreateUser, createUser)
router.put("/:id", verifyAuth, verifyAdmin, validateUpdateProfile, updateUser)
router.delete("/:id", verifyAuth, verifyAdmin, deleteUser)

export default router
