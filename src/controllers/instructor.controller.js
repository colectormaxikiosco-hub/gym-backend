import pool from "../config/database.js"

export const getAllInstructors = async (req, res, next) => {
  try {
    const [instructors] = await pool.query(
      "SELECT id, name, dni, phone, active, created_at, updated_at FROM instructors ORDER BY name ASC"
    )
    res.json({
      success: true,
      message: "Instructores obtenidos correctamente",
      data: instructors,
    })
  } catch (error) {
    console.error("Error al obtener instructores:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener instructores",
    })
  }
}

export const getInstructorById = async (req, res, next) => {
  try {
    const { id } = req.params
    const [rows] = await pool.query(
      "SELECT id, name, dni, phone, active, created_at, updated_at FROM instructors WHERE id = ?",
      [id]
    )
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Instructor no encontrado",
      })
    }
    res.json({
      success: true,
      data: rows[0],
    })
  } catch (error) {
    console.error("Error al obtener instructor:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener instructor",
    })
  }
}

export const createInstructor = async (req, res, next) => {
  try {
    const { name, dni, phone } = req.body
    const [result] = await pool.query(
      "INSERT INTO instructors (name, dni, phone) VALUES (?, ?, ?)",
      [name.trim(), dni.trim(), (phone || "").trim() || null]
    )
    const [newRow] = await pool.query(
      "SELECT id, name, dni, phone, active, created_at, updated_at FROM instructors WHERE id = ?",
      [result.insertId]
    )
    res.status(201).json({
      success: true,
      message: "Instructor creado correctamente",
      data: newRow[0],
    })
  } catch (error) {
    console.error("Error al crear instructor:", error)
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        success: false,
        message: "Ya existe un instructor con ese DNI",
      })
    }
    res.status(500).json({
      success: false,
      message: "Error al crear instructor",
    })
  }
}

export const updateInstructor = async (req, res, next) => {
  try {
    const { id } = req.params
    const { name, dni, phone, active } = req.body
    const [current] = await pool.query(
      "SELECT id, name, dni, phone FROM instructors WHERE id = ?",
      [id]
    )
    if (current.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Instructor no encontrado",
      })
    }
    const nameVal = name != null && name !== "" ? String(name).trim() : current[0].name
    const dniVal = dni != null && dni !== "" ? String(dni).trim() : current[0].dni
    const phoneVal = phone !== undefined && phone !== null ? (String(phone).trim() || null) : current[0].phone
    const activeVal = active !== undefined ? !!active : true
    const [result] = await pool.query(
      "UPDATE instructors SET name = ?, dni = ?, phone = ?, active = ? WHERE id = ?",
      [nameVal, dniVal, phoneVal, activeVal, id]
    )
    const [rows] = await pool.query(
      "SELECT id, name, dni, phone, active, created_at, updated_at FROM instructors WHERE id = ?",
      [id]
    )
    res.json({
      success: true,
      message: "Instructor actualizado correctamente",
      data: rows[0],
    })
  } catch (error) {
    console.error("Error al actualizar instructor:", error)
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        success: false,
        message: "Ya existe un instructor con ese DNI",
      })
    }
    res.status(500).json({
      success: false,
      message: "Error al actualizar instructor",
    })
  }
}

export const deleteInstructor = async (req, res, next) => {
  try {
    const { id } = req.params
    const [result] = await pool.query("DELETE FROM instructors WHERE id = ?", [id])
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Instructor no encontrado",
      })
    }
    res.json({
      success: true,
      message: "Instructor eliminado correctamente",
    })
  } catch (error) {
    console.error("Error al eliminar instructor:", error)
    res.status(500).json({
      success: false,
      message: "Error al eliminar instructor",
    })
  }
}
