import pool from "../config/database.js"

async function attachInstructorsToPlans(plans) {
  if (!plans || plans.length === 0) return plans
  const planIds = plans.map((p) => p.id)
  const placeholders = planIds.map(() => "?").join(",")
  const [rows] = await pool.query(
    `SELECT pi.plan_id, i.id as instructor_id, i.name as instructor_name, i.dni as instructor_dni, i.phone as instructor_phone
     FROM plan_instructors pi
     INNER JOIN instructors i ON i.id = pi.instructor_id AND i.active = 1
     WHERE pi.plan_id IN (${placeholders})
     ORDER BY i.name`,
    planIds
  )
  const byPlan = {}
  rows.forEach((r) => {
    if (!byPlan[r.plan_id]) byPlan[r.plan_id] = []
    byPlan[r.plan_id].push({
      id: r.instructor_id,
      name: r.instructor_name,
      dni: r.instructor_dni,
      phone: r.instructor_phone,
    })
  })
  return plans.map((p) => ({ ...p, instructors: byPlan[p.id] || [] }))
}

export const getAllPlans = async (req, res) => {
  try {
    const [plans] = await pool.query("SELECT * FROM plans WHERE active = TRUE ORDER BY duration_days ASC")
    const withInstructors = await attachInstructorsToPlans(plans)
    res.json({
      success: true,
      message: "Planes obtenidos correctamente",
      data: withInstructors,
    })
  } catch (error) {
    console.error("Error al obtener planes:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener planes",
    })
  }
}

export const getPlanById = async (req, res) => {
  try {
    const { id } = req.params
    const [plans] = await pool.query("SELECT * FROM plans WHERE id = ?", [id])
    if (plans.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Plan no encontrado",
      })
    }
    const [withInstructors] = await attachInstructorsToPlans(plans)
    res.json({
      success: true,
      data: withInstructors,
    })
  } catch (error) {
    console.error("Error al obtener plan:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener plan",
    })
  }
}

export const createPlan = async (req, res) => {
  try {
    const { name, duration_days, price, description, instructor_ids } = req.body
    const [result] = await pool.query(
      "INSERT INTO plans (name, duration_days, price, description) VALUES (?, ?, ?, ?)",
      [name, duration_days, price, description || null]
    )
    const planId = result.insertId
    const ids = Array.isArray(instructor_ids) ? instructor_ids.map((id) => Number(id)).filter((id) => id > 0) : []
    if (ids.length > 0) {
      const values = ids.map((instructorId) => [planId, instructorId])
      await pool.query(
        "INSERT INTO plan_instructors (plan_id, instructor_id) VALUES ?",
        [values]
      )
    }
    const [newPlan] = await pool.query("SELECT * FROM plans WHERE id = ?", [planId])
    const [withInstructors] = await attachInstructorsToPlans(newPlan)
    res.status(201).json({
      success: true,
      message: "Plan creado correctamente",
      data: withInstructors,
    })
  } catch (error) {
    console.error("Error al crear plan:", error)
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        success: false,
        message: "Ya existe un plan con ese nombre",
      })
    }
    res.status(500).json({
      success: false,
      message: "Error al crear plan",
    })
  }
}

export const updatePlan = async (req, res) => {
  try {
    const { id } = req.params
    const { name, duration_days, price, description, active, instructor_ids } = req.body
    const [result] = await pool.query(
      "UPDATE plans SET name = ?, duration_days = ?, price = ?, description = ?, active = ? WHERE id = ?",
      [name, duration_days, price, description, active !== undefined ? active : true, id]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Plan no encontrado",
      })
    }
    await pool.query("DELETE FROM plan_instructors WHERE plan_id = ?", [id])
    const planIdNum = Number(id)
    const ids = Array.isArray(instructor_ids) ? instructor_ids.map((i) => Number(i)).filter((i) => i > 0) : []
    if (ids.length > 0) {
      const values = ids.map((instructorId) => [planIdNum, instructorId])
      await pool.query(
        "INSERT INTO plan_instructors (plan_id, instructor_id) VALUES ?",
        [values]
      )
    }
    const [updatedPlan] = await pool.query("SELECT * FROM plans WHERE id = ?", [id])
    const [withInstructors] = await attachInstructorsToPlans(updatedPlan)
    res.json({
      success: true,
      message: "Plan actualizado correctamente",
      data: withInstructors,
    })
  } catch (error) {
    console.error("Error al actualizar plan:", error)
    res.status(500).json({
      success: false,
      message: "Error al actualizar plan",
    })
  }
}

export const deletePlan = async (req, res) => {
  try {
    const { id } = req.params
    const [memberships] = await pool.query(
      "SELECT COUNT(*) as count FROM memberships WHERE plan_id = ? AND status = 'active' AND start_date <= CURDATE() AND end_date >= CURDATE()",
      [id]
    )
    if (memberships[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: "No se puede eliminar el plan porque tiene membresías activas",
      })
    }
    const [result] = await pool.query("UPDATE plans SET active = FALSE WHERE id = ?", [id])
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Plan no encontrado",
      })
    }
    res.json({
      success: true,
      message: "Plan desactivado correctamente",
    })
  } catch (error) {
    console.error("Error al desactivar plan:", error)
    res.status(500).json({
      success: false,
      message: "Error al desactivar plan",
    })
  }
}
