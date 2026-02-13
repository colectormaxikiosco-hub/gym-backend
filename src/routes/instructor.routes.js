import express from "express"
import {
  getAllInstructors,
  getInstructorById,
  createInstructor,
  updateInstructor,
  deleteInstructor,
} from "../controllers/instructor.controller.js"
import { verifyAuth, verifyAdminOrEmployee } from "../middleware/auth.js"
import { validateCreateInstructor, validateUpdateInstructor } from "../middleware/validate.js"

const router = express.Router()

router.get("/", verifyAuth, getAllInstructors)
router.get("/:id", verifyAuth, getInstructorById)
router.post("/", verifyAuth, verifyAdminOrEmployee, validateCreateInstructor, createInstructor)
router.put("/:id", verifyAuth, verifyAdminOrEmployee, validateUpdateInstructor, updateInstructor)
router.delete("/:id", verifyAuth, verifyAdminOrEmployee, deleteInstructor)

export default router
