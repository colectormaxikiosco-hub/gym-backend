import express from "express"
import { getAllClasses, getClassById, createClass, updateClass, deleteClass } from "../controllers/class.controller.js"
import { verifyAuth, verifyAdminOrEmployee } from "../middleware/auth.js"

const router = express.Router()

// Rutas públicas para clientes autenticados
router.get("/", verifyAuth, getAllClasses)
router.get("/:id", verifyAuth, getClassById)

// Rutas protegidas para admin y empleados
router.post("/", verifyAuth, verifyAdminOrEmployee, createClass)
router.put("/:id", verifyAuth, verifyAdminOrEmployee, updateClass)
router.delete("/:id", verifyAuth, verifyAdminOrEmployee, deleteClass)

export default router
