import pool from "../config/database.js"

export const getAllNotices = async (req, res, next) => {
  try {
    const [notices] = await pool.query(
      `SELECT n.*, u.name as created_by_name 
       FROM notices n 
       LEFT JOIN users u ON n.created_by = u.id 
       WHERE n.active = true 
       ORDER BY n.created_at DESC`,
    )

    res.json({
      success: true,
      data: notices,
    })
  } catch (error) {
    console.error("Error al obtener avisos")
    next(error)
  }
}

export const getNoticeById = async (req, res, next) => {
  try {
    const { id } = req.params
    const [notices] = await pool.query(
      `SELECT n.*, u.name as created_by_name 
       FROM notices n 
       LEFT JOIN users u ON n.created_by = u.id 
       WHERE n.id = ?`,
      [id],
    )

    if (notices.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Aviso no encontrado",
      })
    }

    res.json({
      success: true,
      data: notices[0],
    })
  } catch (error) {
    console.error("Error al obtener aviso")
    next(error)
  }
}

export const createNotice = async (req, res, next) => {
  try {
    const { title, content, type } = req.body
    const userId = req.user.id

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: "Título y contenido son requeridos",
      })
    }

    const [result] = await pool.query("INSERT INTO notices (title, content, type, created_by) VALUES (?, ?, ?, ?)", [
      title,
      content,
      type || "info",
      userId,
    ])

    const [newNotice] = await pool.query(
      `SELECT n.*, u.name as created_by_name 
       FROM notices n 
       LEFT JOIN users u ON n.created_by = u.id 
       WHERE n.id = ?`,
      [result.insertId],
    )

    res.status(201).json({
      success: true,
      message: "Aviso creado correctamente",
      data: newNotice[0],
    })
  } catch (error) {
    console.error("Error al crear aviso")
    next(error)
  }
}

export const updateNotice = async (req, res, next) => {
  try {
    const { id } = req.params
    const { title, content, type, active } = req.body

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: "Título y contenido son requeridos",
      })
    }

    const [result] = await pool.query("UPDATE notices SET title = ?, content = ?, type = ?, active = ? WHERE id = ?", [
      title,
      content,
      type,
      active !== undefined ? active : true,
      id,
    ])

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Aviso no encontrado",
      })
    }

    const [updatedNotice] = await pool.query(
      `SELECT n.*, u.name as created_by_name 
       FROM notices n 
       LEFT JOIN users u ON n.created_by = u.id 
       WHERE n.id = ?`,
      [id],
    )

    res.json({
      success: true,
      message: "Aviso actualizado correctamente",
      data: updatedNotice[0],
    })
  } catch (error) {
    console.error("Error al actualizar aviso")
    next(error)
  }
}

export const deleteNotice = async (req, res, next) => {
  try {
    const { id } = req.params

    const [result] = await pool.query("UPDATE notices SET active = false WHERE id = ?", [id])

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Aviso no encontrado",
      })
    }

    res.json({
      success: true,
      message: "Aviso eliminado correctamente",
    })
  } catch (error) {
    console.error("Error al eliminar aviso")
    next(error)
  }
}
