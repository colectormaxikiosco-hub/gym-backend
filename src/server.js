import express from "express"
import cors from "cors"
import helmet from "helmet"
import dotenv from "dotenv"
import rateLimit from "express-rate-limit"
import authRoutes from "./routes/auth.routes.js"
import userRoutes from "./routes/user.routes.js"
import clientRoutes from "./routes/client.routes.js"
import noticeRoutes from "./routes/notice.routes.js"
import classRoutes from "./routes/class.routes.js"
import planRoutes from "./routes/plan.routes.js"
import membershipRoutes from "./routes/membership.routes.js"
import cashRoutes from "./routes/cash.routes.js"
import currentAccountRoutes from "./routes/currentAccount.routes.js"
import entryRoutes from "./routes/entry.routes.js"
import instructorRoutes from "./routes/instructor.routes.js"
import productRoutes from "./routes/product.routes.js"
import categoryRoutes from "./routes/category.routes.js"
import salesRoutes from "./routes/sales.routes.js"
import reportsRoutes from "./routes/reports.routes.js"
import { errorHandler } from "./middleware/errorHandler.js"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
const isProduction = process.env.NODE_ENV === "production"

if (!process.env.CORS_ORIGIN) {
  throw new Error("CORS_ORIGIN no está configurado en las variables de entorno")
}

const allowedOrigins = process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())

// Security middleware
app.use(helmet())

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 60, // 60 peticiones por minuto por IP
  message: "Demasiadas peticiones desde esta IP, intente de nuevo más tarde.",
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests to prevent counting them
  skipSuccessfulRequests: false,
  // Skip failed requests
  skipFailedRequests: false,
})

app.use("/api/", limiter)

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 intentos de login por 15 minutos
  message: "Demasiados intentos de inicio de sesión, intente de nuevo más tarde.",
})

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)

      if (allowedOrigins.indexOf(origin) === -1) {
        return callback(new Error("No permitido por CORS"), false)
      }
      return callback(null, true)
    },
    credentials: true,
  }),
)

// Body parsers
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

if (!isProduction) {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
    next()
  })
}

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() })
})

// Routes con rate limiting específico para auth
app.use("/api/auth", authLimiter, authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/clients", clientRoutes)
app.use("/api/notices", noticeRoutes)
app.use("/api/classes", classRoutes)
app.use("/api/plans", planRoutes)
app.use("/api/memberships", membershipRoutes)
app.use("/api/cash", cashRoutes)
app.use("/api/current-account", currentAccountRoutes)
app.use("/api/entries", entryRoutes)
app.use("/api/instructors", instructorRoutes)
app.use("/api/products", productRoutes)
app.use("/api/categories", categoryRoutes)
app.use("/api/sales", salesRoutes)
app.use("/api/reports", reportsRoutes)

// Error handler (debe ir al final)
app.use(errorHandler)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Ruta no encontrada" })
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason)
})

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error)
  // En producción, deberías cerrar el servidor gracefully
  if (isProduction) {
    process.exit(1)
  }
})

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT} - Ambiente: ${process.env.NODE_ENV || "development"}`)
  if (!isProduction) {
    console.log(`URL: http://localhost:${PORT}`)
    console.log(`CORS Origins: ${allowedOrigins.join(", ")}`)
  }
})
