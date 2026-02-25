import bcrypt from "bcryptjs"
import pool from "../config/database.js"

// Obtener perfil del usuario actual
export const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id

    const [users] = await pool.query(
      "SELECT id, username, name, email, role, created_at, last_login FROM users WHERE id = ? AND active = 1",
      [userId],
    )

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      })
    }

    res.json({
      success: true,
      data: users[0],
    })
  } catch (error) {
    console.error("Error al obtener perfil")
    next(error)
  }
}

// Actualizar perfil del usuario actual
export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id
    const { username, name, email } = req.body
    const emailNormalized = (email != null && String(email).trim() !== "") ? String(email).trim() : null

    if (!username || !name) {
      return res.status(400).json({
        success: false,
        message: "Nombre de usuario y nombre son requeridos",
      })
    }

    // Verificar si el username ya existe (excepto el usuario actual)
    const [existingUsers] = await pool.query("SELECT id FROM users WHERE username = ? AND id != ?", [username, userId])

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: "El nombre de usuario ya está en uso",
      })
    }

    if (emailNormalized) {
      const [existingEmail] = await pool.query("SELECT id FROM users WHERE email = ? AND id != ?", [emailNormalized, userId])
      if (existingEmail.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Ya existe otro usuario con ese email",
        })
      }
    }

    await pool.query("UPDATE users SET username = ?, name = ?, email = ? WHERE id = ?", [username, name, emailNormalized, userId])

    const [updatedUser] = await pool.query(
      "SELECT id, username, name, email, role, created_at, last_login FROM users WHERE id = ?",
      [userId],
    )

    res.json({
      success: true,
      message: "Perfil actualizado correctamente",
      data: updatedUser[0],
    })
  } catch (error) {
    console.error("Error al actualizar perfil")
    next(error)
  }
}

// Cambiar contraseña del usuario actual
export const changePassword = async (req, res, next) => {
  try {
    const userId = req.user.id
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Contraseña actual y nueva son requeridas",
      })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "La nueva contraseña debe tener al menos 6 caracteres",
      })
    }

    const [users] = await pool.query("SELECT password FROM users WHERE id = ? AND active = 1", [userId])

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      })
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, users[0].password)

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "La contraseña actual es incorrecta",
      })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await pool.query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, userId])

    res.json({
      success: true,
      message: "Contraseña cambiada correctamente",
    })
  } catch (error) {
    console.error("Error al cambiar contraseña")
    next(error)
  }
}

// Obtener todos los usuarios (solo admin)
export const getAllUsers = async (req, res, next) => {
  try {
    const [users] = await pool.query(
      "SELECT id, username, name, email, role, active, created_at, last_login FROM users ORDER BY created_at DESC",
    )

    res.json({
      success: true,
      data: users,
    })
  } catch (error) {
    console.error("Error al obtener usuarios")
    next(error)
  }
}

// Crear nuevo usuario (solo admin)
export const createUser = async (req, res, next) => {
  try {
    const { username, password, name, email, role } = req.body
    const emailNormalized = (email != null && String(email).trim() !== "") ? String(email).trim() : null

    if (!username || !password || !name || !role) {
      return res.status(400).json({
        success: false,
        message: "Todos los campos son requeridos",
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "La contraseña debe tener al menos 6 caracteres",
      })
    }

    if (!["admin", "empleado"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Rol inválido. Use 'admin' o 'empleado'",
      })
    }

    const [existingUsers] = await pool.query("SELECT id FROM users WHERE username = ?", [username])

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: "El nombre de usuario ya existe",
      })
    }

    if (emailNormalized) {
      const [existingEmail] = await pool.query("SELECT id FROM users WHERE email = ?", [emailNormalized])
      if (existingEmail.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Ya existe un usuario con ese email",
        })
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const [result] = await pool.query(
      "INSERT INTO users (username, password, name, email, role) VALUES (?, ?, ?, ?, ?)",
      [username, hashedPassword, name, emailNormalized, role],
    )

    const [newUser] = await pool.query(
      "SELECT id, username, name, email, role, active, created_at FROM users WHERE id = ?",
      [result.insertId],
    )

    res.status(201).json({
      success: true,
      message: "Usuario creado correctamente",
      data: newUser[0],
    })
  } catch (error) {
    console.error("Error al crear usuario", error)
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        success: false,
        message: "Ya existe un usuario con ese email o nombre de usuario",
      })
    }
    next(error)
  }
}

// Actualizar usuario (solo admin)
export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params
    const { username, name, email, role, active } = req.body
    const emailNormalized = (email != null && String(email).trim() !== "") ? String(email).trim() : null

    if (!username || !name || !role) {
      return res.status(400).json({
        success: false,
        message: "Nombre de usuario, nombre y rol son requeridos",
      })
    }

    if (!["admin", "empleado"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Rol inválido. Use 'admin' o 'empleado'",
      })
    }

    const [existingUsers] = await pool.query("SELECT id FROM users WHERE username = ? AND id != ?", [username, id])

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: "El nombre de usuario ya está en uso",
      })
    }

    if (emailNormalized) {
      const [existingEmail] = await pool.query("SELECT id FROM users WHERE email = ? AND id != ?", [emailNormalized, id])
      if (existingEmail.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Ya existe otro usuario con ese email",
        })
      }
    }

    await pool.query("UPDATE users SET username = ?, name = ?, email = ?, role = ?, active = ? WHERE id = ?", [
      username,
      name,
      emailNormalized,
      role,
      active !== undefined ? active : true,
      id,
    ])

    const [updatedUser] = await pool.query(
      "SELECT id, username, name, email, role, active, created_at, last_login FROM users WHERE id = ?",
      [id],
    )

    if (updatedUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      })
    }

    res.json({
      success: true,
      message: "Usuario actualizado correctamente",
      data: updatedUser[0],
    })
  } catch (error) {
    console.error("Error al actualizar usuario", error)
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        success: false,
        message: "Ya existe otro usuario con ese email",
      })
    }
    next(error)
  }
}

// Eliminar usuario (desactivar) (solo admin)
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params

    if (Number.parseInt(id) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "No puedes eliminar tu propio usuario",
      })
    }

    await pool.query("UPDATE users SET active = 0 WHERE id = ?", [id])

    res.json({
      success: true,
      message: "Usuario desactivado correctamente",
    })
  } catch (error) {
    console.error("Error al eliminar usuario")
    next(error)
  }
}
