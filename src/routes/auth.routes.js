import express from "express"
import { login, verifyToken } from "../controllers/auth.controller.js"
import { body } from "express-validator"
import { validate } from "../middleware/validate.js"

const router = express.Router()

// Login
router.post(
  "/login",
  [
    body("username").trim().notEmpty().withMessage("Usuario es requerido"),
    body("password").notEmpty().withMessage("Contraseña es requerida"),
    validate,
  ],
  login,
)

// Verificar token
router.get("/verify", verifyToken)

export default router
