import express from "express"
import { registerEntry, getEntriesByClient } from "../controllers/entry.controller.js"
import { verifyAuth, verifyAdminOrEmployee } from "../middleware/auth.js"

const router = express.Router()

router.get("/clients/:clientId", verifyAuth, verifyAdminOrEmployee, getEntriesByClient)
router.post("/clients/:clientId/register", verifyAuth, verifyAdminOrEmployee, registerEntry)

export default router
