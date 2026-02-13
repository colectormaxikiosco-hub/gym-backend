import jwt from "jsonwebtoken"

export const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token no proporcionado",
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Token inválido",
      })
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expirado",
      })
    }
    return res.status(500).json({
      success: false,
      message: "Error en la autenticación",
    })
  }
}

export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        message: "Acceso denegado",
      })
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "No tienes permisos para realizar esta acción",
      })
    }

    next()
  }
}

export const verifyAuth = authenticate
export const verifyAdmin = (req, res, next) => requireRole(["admin"])(req, res, next)
export const verifyAdminOrEmployee = (req, res, next) => requireRole(["admin", "empleado"])(req, res, next)
