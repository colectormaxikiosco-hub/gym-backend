import express from "express"
import {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  resendWelcomeWhatsApp,
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
} from "../controllers/client.controller.js"
import { authenticate, requireRole } from "../middleware/auth.js"
import { validateCreateClient, validateUpdateClient } from "../middleware/validate.js"

const router = express.Router()

router.get("/my-profile", authenticate, requireRole(["client"]), getMyProfile)
router.put("/my-profile", authenticate, requireRole(["client"]), updateMyProfile)
router.post("/my-profile/change-password", authenticate, requireRole(["client"]), changeMyPassword)

// Rutas para usuarios del sistema (gestión de clientes)
router.get("/", authenticate, requireRole(["admin", "empleado"]), getAllClients)
router.get("/:id", authenticate, requireRole(["admin", "empleado"]), getClientById)
router.post("/", authenticate, requireRole(["admin", "empleado"]), validateCreateClient, createClient)
router.put("/:id", authenticate, requireRole(["admin", "empleado"]), validateUpdateClient, updateClient)
router.delete("/:id", authenticate, requireRole(["admin"]), deleteClient)
router.post("/:id/resend-welcome-whatsapp", authenticate, requireRole(["admin", "empleado"]), resendWelcomeWhatsApp)

export default router
