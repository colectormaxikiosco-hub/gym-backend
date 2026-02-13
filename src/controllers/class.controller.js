import pool from "../config/database.js"

export const getAllClasses = async (req, res, next) => {
  try {
    const [classes] = await pool.query(
      `SELECT c.*, u.name as created_by_name 
       FROM classes c 
       LEFT JOIN users u ON c.created_by = u.id 
       WHERE c.active = true 
       ORDER BY 
         FIELD(c.day_of_week, 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'),
         c.start_time`,
    )

    res.json({
      success: true,
      data: classes,
    })
  } catch (error) {
    console.error("Error al obtener clases")
    next(error)
  }
}

export const getClassById = async (req, res, next) => {
  try {
    const { id } = req.params
    const [classes] = await pool.query(
      `SELECT c.*, u.name as created_by_name 
       FROM classes c 
       LEFT JOIN users u ON c.created_by = u.id 
       WHERE c.id = ?`,
      [id],
    )

    if (classes.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Clase no encontrada",
      })
    }

    res.json({
      success: true,
      data: classes[0],
    })
  } catch (error) {
    console.error("Error al obtener clase")
    next(error)
  }
}

export const createClass = async (req, res, next) => {
  try {
    const { name, description, instructor, day_of_week, start_time, end_time, capacity } = req.body
    const userId = req.user.id

    if (!name || !day_of_week || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: "Nombre, día de la semana, hora de inicio y fin son requeridos",
      })
    }

    const [result] = await pool.query(
      "INSERT INTO classes (name, description, instructor, day_of_week, start_time, end_time, capacity, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [name, description, instructor, day_of_week, start_time, end_time, capacity || 20, userId],
    )

    const [newClass] = await pool.query(
      `SELECT c.*, u.name as created_by_name 
       FROM classes c 
       LEFT JOIN users u ON c.created_by = u.id 
       WHERE c.id = ?`,
      [result.insertId],
    )

    res.status(201).json({
      success: true,
      message: "Clase creada correctamente",
      data: newClass[0],
    })
  } catch (error) {
    console.error("Error al crear clase")
    next(error)
  }
}

export const updateClass = async (req, res, next) => {
  try {
    const { id } = req.params
    const { name, description, instructor, day_of_week, start_time, end_time, capacity, active } = req.body

    if (!name || !day_of_week || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: "Nombre, día de la semana, hora de inicio y fin son requeridos",
      })
    }

    const [result] = await pool.query(
      "UPDATE classes SET name = ?, description = ?, instructor = ?, day_of_week = ?, start_time = ?, end_time = ?, capacity = ?, active = ? WHERE id = ?",
      [
        name,
        description,
        instructor,
        day_of_week,
        start_time,
        end_time,
        capacity,
        active !== undefined ? active : true,
        id,
      ],
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Clase no encontrada",
      })
    }

    const [updatedClass] = await pool.query(
      `SELECT c.*, u.name as created_by_name 
       FROM classes c 
       LEFT JOIN users u ON c.created_by = u.id 
       WHERE c.id = ?`,
      [id],
    )

    res.json({
      success: true,
      message: "Clase actualizada correctamente",
      data: updatedClass[0],
    })
  } catch (error) {
    console.error("Error al actualizar clase")
    next(error)
  }
}

export const deleteClass = async (req, res, next) => {
  try {
    const { id } = req.params

    const [result] = await pool.query("UPDATE classes SET active = false WHERE id = ?", [id])

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Clase no encontrada",
      })
    }

    res.json({
      success: true,
      message: "Clase eliminada correctamente",
    })
  } catch (error) {
    console.error("Error al eliminar clase")
    next(error)
  }
}
