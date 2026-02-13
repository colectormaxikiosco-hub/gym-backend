import pool from "../config/database.js"

export const getAllCategories = async (req, res) => {
  try {
    const { active_only } = req.query
    let sql = "SELECT * FROM categories"
    const params = []
    if (active_only === "1" || active_only === "true") {
      sql += " WHERE active = TRUE"
    }
    sql += " ORDER BY name ASC"
    const [rows] = await pool.query(sql, params)
    res.json({
      success: true,
      message: "Categorías obtenidas correctamente",
      data: rows,
    })
  } catch (error) {
    console.error("Error al obtener categorías:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener categorías",
    })
  }
}

export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params
    const [rows] = await pool.query("SELECT * FROM categories WHERE id = ?", [id])
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Categoría no encontrada",
      })
    }
    res.json({
      success: true,
      data: rows[0],
    })
  } catch (error) {
    console.error("Error al obtener categoría:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener categoría",
    })
  }
}

export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body
    const [result] = await pool.query(
      "INSERT INTO categories (name, description) VALUES (?, ?)",
      [name?.trim() || "", description?.trim() || null]
    )
    const [newRow] = await pool.query("SELECT * FROM categories WHERE id = ?", [result.insertId])
    res.status(201).json({
      success: true,
      message: "Categoría creada correctamente",
      data: newRow[0],
    })
  } catch (error) {
    console.error("Error al crear categoría:", error)
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        success: false,
        message: "Ya existe una categoría con ese nombre",
      })
    }
    res.status(500).json({
      success: false,
      message: "Error al crear categoría",
    })
  }
}

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, active } = req.body
    const [result] = await pool.query(
      "UPDATE categories SET name = ?, description = ?, active = ? WHERE id = ?",
      [name?.trim() || "", description?.trim() || null, active !== undefined ? !!active : true, id]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Categoría no encontrada",
      })
    }
    const [updated] = await pool.query("SELECT * FROM categories WHERE id = ?", [id])
    res.json({
      success: true,
      message: "Categoría actualizada correctamente",
      data: updated[0],
    })
  } catch (error) {
    console.error("Error al actualizar categoría:", error)
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        success: false,
        message: "Ya existe otra categoría con ese nombre",
      })
    }
    res.status(500).json({
      success: false,
      message: "Error al actualizar categoría",
    })
  }
}

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params
    const [result] = await pool.query("UPDATE categories SET active = FALSE WHERE id = ?", [id])
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Categoría no encontrada",
      })
    }
    res.json({
      success: true,
      message: "Categoría desactivada correctamente",
    })
  } catch (error) {
    console.error("Error al desactivar categoría:", error)
    res.status(500).json({
      success: false,
      message: "Error al desactivar categoría",
    })
  }
}
