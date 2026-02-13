import express from "express"
import { getAllPlans, getPlanById, createPlan, updatePlan, deletePlan } from "../controllers/plan.controller.js"
import { verifyAuth, verifyAdminOrEmployee } from "../middleware/auth.js"
import { validateCreatePlan } from "../middleware/validate.js"

const router = express.Router()

// Rutas accesibles para admin y empleados
router.get("/", verifyAuth, getAllPlans)
router.get("/:id", verifyAuth, getPlanById)

// Rutas solo para admin
router.post("/", verifyAuth, verifyAdminOrEmployee, validateCreatePlan, createPlan)
router.put("/:id", verifyAuth, verifyAdminOrEmployee, validateCreatePlan, updatePlan)
router.delete("/:id", verifyAuth, verifyAdminOrEmployee, deletePlan)

export default router
