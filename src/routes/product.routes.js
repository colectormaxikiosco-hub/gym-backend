import express from "express"
import {
  getAllProducts,
  getProductById,
  getProductAlerts,
  createProduct,
  updateProduct,
  deleteProduct,
  getMovementsByProductId,
  getAllMovements,
  createStockMovement,
} from "../controllers/product.controller.js"
import { verifyAuth, verifyAdmin, verifyAdminOrEmployee } from "../middleware/auth.js"
import { validateProduct, validateStockMovement } from "../middleware/validate.js"

const router = express.Router()

// Rutas estáticas primero (para no capturar "movements" como id)
router.get("/movements/all", verifyAuth, verifyAdmin, getAllMovements)
router.post("/movements", verifyAuth, verifyAdmin, validateStockMovement, createStockMovement)
router.get("/alerts", verifyAuth, verifyAdminOrEmployee, getProductAlerts)

// Listar y ver producto: admin y empleado (para punto de venta)
router.get("/", verifyAuth, verifyAdminOrEmployee, getAllProducts)
router.get("/:id", verifyAuth, verifyAdminOrEmployee, getProductById)

// Crear, editar, eliminar y movimientos: solo admin
router.post("/", verifyAuth, verifyAdmin, validateProduct, createProduct)
router.put("/:id", verifyAuth, verifyAdmin, validateProduct, updateProduct)
router.delete("/:id", verifyAuth, verifyAdmin, deleteProduct)
router.get("/:productId/movements", verifyAuth, verifyAdmin, getMovementsByProductId)

export default router
