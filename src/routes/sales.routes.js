import express from "express"
import { getAllSales, getSaleById, createSale, cancelSale } from "../controllers/sales.controller.js"
import { verifyAuth, verifyAdminOrEmployee } from "../middleware/auth.js"
import { validateCreateSale } from "../middleware/validate.js"

const router = express.Router()

router.get("/", verifyAuth, verifyAdminOrEmployee, getAllSales)
router.get("/:id", verifyAuth, verifyAdminOrEmployee, getSaleById)
router.post("/", verifyAuth, verifyAdminOrEmployee, validateCreateSale, createSale)
router.patch("/:id/cancel", verifyAuth, verifyAdminOrEmployee, cancelSale)

export default router
