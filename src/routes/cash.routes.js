import express from "express"
import { verifyAuth, verifyAdminOrEmployee } from "../middleware/auth.js"
import {
  validateCreateCashMovement,
  validateOpenCashSession,
  validateCloseCashSession,
} from "../middleware/validate.js"
import {
  getActiveSession,
  openCashSession,
  closeCashSession,
  createMovement,
  getCashSessions,
  getCashSessionDetail,
  getIncomeByPaymentMethod,
} from "../controllers/cash.controller.js"

const router = express.Router()

// Todas las rutas requieren autenticación y rol de admin o empleado
router.use(verifyAuth)
router.use(verifyAdminOrEmployee)

// Obtener sesión activa
router.get("/active", getActiveSession)

// Obtener desglose de ingresos por método de pago
router.get("/income-breakdown", getIncomeByPaymentMethod)

// Abrir caja
router.post("/open", validateOpenCashSession, openCashSession)

// Cerrar caja
router.patch("/:id/close", validateCloseCashSession, closeCashSession)

// Registrar movimiento
router.post("/movements", validateCreateCashMovement, createMovement)

// Obtener historial de sesiones
router.get("/sessions", getCashSessions)

// Obtener detalle de sesión
router.get("/sessions/:id", getCashSessionDetail)

export default router
