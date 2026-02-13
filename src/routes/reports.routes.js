import express from "express"
import { verifyAuth, verifyAdminOrEmployee } from "../middleware/auth.js"
import { getMembershipReports, getSalesReports } from "../controllers/reports.controller.js"

const router = express.Router()

router.use(verifyAuth)
router.use(verifyAdminOrEmployee)

router.get("/memberships", getMembershipReports)
router.get("/sales", getSalesReports)

export default router
