import express from "express"
import { verifyAuth } from "../middleware/auth.js"
import {
  getClientCurrentAccount,
  registerPayment,
  getCurrentAccountSummary,
} from "../controllers/currentAccount.controller.js"

const router = express.Router()

// Todas las rutas requieren autenticación
router.use(verifyAuth)

// Obtener resumen general de cuentas corrientes
router.get("/summary", getCurrentAccountSummary)

// Obtener cuenta corriente de un cliente específico
router.get("/client/:clientId", getClientCurrentAccount)

// Registrar pago de cuenta corriente
router.post("/client/:clientId/payment", registerPayment)

export default router
