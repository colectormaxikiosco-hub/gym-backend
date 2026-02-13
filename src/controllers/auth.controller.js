import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import pool from "../config/database.js"

const generateToken = (id, role, type) => {
  return jwt.sign({ id, role, type }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE })
}

export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Usuario y contraseña son requeridos",
      })
    }

    // Primero buscar en usuarios del sistema
    let [users] = await pool.query("SELECT id, username, password, name, role, active FROM users WHERE username = ?", [
      username,
    ])

    let userType = "user"
    let user = users[0]

    // Si no se encuentra en usuarios, buscar en clientes
    if (!user) {
      ;[users] = await pool.query("SELECT id, username, password, name, active FROM clients WHERE username = ?", [
        username,
      ])
      user = users[0]
      userType = "client"
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Credenciales incorrectas",
      })
    }

    if (!user.active) {
      return res.status(403).json({
        success: false,
        message: `${userType === "user" ? "Usuario" : "Cliente"} inactivo. Contacte al administrador`,
      })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Credenciales incorrectas",
      })
    }

    // Actualizar último login
    const table = userType === "user" ? "users" : "clients"
    await pool.query(`UPDATE ${table} SET last_login = NOW() WHERE id = ?`, [user.id])

    const token = generateToken(user.id, user.role || "client", userType)

    res.json({
      success: true,
      message: "Login exitoso",
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role || "client",
          type: userType,
        },
      },
    })
  } catch (error) {
    console.error("Error en login:", error.message)
    next(error)
  }
}

export const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token no proporcionado",
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const table = decoded.type === "user" ? "users" : "clients"
    const query =
      decoded.type === "user"
        ? "SELECT id, username, name, role FROM users WHERE id = ? AND active = 1"
        : "SELECT id, username, name FROM clients WHERE id = ? AND active = 1"

    const [users] = await pool.query(query, [decoded.id])

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Usuario no válido",
      })
    }

    const userData = users[0]

    res.json({
      success: true,
      data: {
        user: {
          ...userData,
          role: userData.role || "client",
          type: decoded.type,
        },
      },
    })
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
    console.error("Error en verificación de token")
    next(error)
  }
}
