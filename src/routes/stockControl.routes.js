import express from "express"
import { verifyAuth, verifyAdminOrEmployee } from "../middleware/auth.js"
import {
  getCurrentStockControl,
  saveCurrentStockControl,
  skipCurrentStockControl,
  getStockControls,
  getStockControlById,
  getStockControlBySession,
} from "../controllers/stockControl.controller.js"

const router = express.Router()

router.use(verifyAuth)
router.use(verifyAdminOrEmployee)

router.get("/current", getCurrentStockControl)
router.post("/current", saveCurrentStockControl)
router.put("/current", saveCurrentStockControl)
router.post("/current/skip", skipCurrentStockControl)

router.get("/", getStockControls)
router.get("/by-session/:cashSessionId", getStockControlBySession)
router.get("/:id", getStockControlById)

export default router
