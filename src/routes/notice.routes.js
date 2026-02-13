import express from "express"
import {
  getAllNotices,
  getNoticeById,
  createNotice,
  updateNotice,
  deleteNotice,
} from "../controllers/notice.controller.js"
import { verifyAuth, verifyAdminOrEmployee } from "../middleware/auth.js"

const router = express.Router()

// Rutas públicas para clientes autenticados
router.get("/", verifyAuth, getAllNotices)
router.get("/:id", verifyAuth, getNoticeById)

// Rutas protegidas para admin y empleados
router.post("/", verifyAuth, verifyAdminOrEmployee, createNotice)
router.put("/:id", verifyAuth, verifyAdminOrEmployee, updateNotice)
router.delete("/:id", verifyAuth, verifyAdminOrEmployee, deleteNotice)

export default router
