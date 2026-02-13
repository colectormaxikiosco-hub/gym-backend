import express from "express"
import {
  getAllMemberships,
  getMembershipById,
  getClientActiveMembership,
  createMembership,
  updateMembership,
  cancelMembership,
  updateExpiredMemberships,
  recordMembershipReminder,
} from "../controllers/membership.controller.js"
import { verifyAuth, verifyAdminOrEmployee } from "../middleware/auth.js"
import { validateCreateMembershipWithPayment } from "../middleware/validate.js"

const router = express.Router()

// Rutas para admin y empleados
router.get("/", verifyAuth, verifyAdminOrEmployee, getAllMemberships)
router.get("/:id", verifyAuth, verifyAdminOrEmployee, getMembershipById)
router.get("/client/:clientId/active", verifyAuth, getClientActiveMembership)
router.post("/", verifyAuth, verifyAdminOrEmployee, validateCreateMembershipWithPayment, createMembership)
router.put("/:id", verifyAuth, verifyAdminOrEmployee, updateMembership)
router.patch("/:id/cancel", verifyAuth, verifyAdminOrEmployee, cancelMembership)

// Registrar que se envió recordatorio por WhatsApp (5, 3 o 1 días restantes)
router.post("/:id/record-reminder", verifyAuth, verifyAdminOrEmployee, recordMembershipReminder)

// Ruta para actualizar membresías expiradas (puede ser ejecutada por un cron job)
router.post("/update-expired", verifyAuth, verifyAdminOrEmployee, updateExpiredMemberships)

export default router
