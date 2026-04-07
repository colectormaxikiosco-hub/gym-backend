import pool from "../config/database.js"

/** Normaliza `active` desde MySQL (0/1, boolean, Buffer en BIT) */
function rowIsActive(row) {
  const v = row?.active
  if (v == null) return true
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(v)) {
    return v.length > 0 && v[0] === 1
  }
  const n = Number(v)
  if (!Number.isNaN(n)) return n === 1
  return Boolean(v)
}

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
    const includeInactive = ["1", "true", "yes"].includes(
      String(req.query.include_inactive || "").toLowerCase(),
    )
    const where = includeInactive ? "" : "WHERE active = TRUE"
    const [plans] = await pool.query(
      `SELECT * FROM plans ${where} ORDER BY active DESC, duration_days ASC, name ASC`,
    )
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
    const { name, duration_days, duration_hours, price, description, instructor_ids } = req.body
    const days = duration_days != null ? Number(duration_days) : 0
    const hours = duration_hours != null ? Number(duration_hours) : 0
    const [result] = await pool.query(
      "INSERT INTO plans (name, duration_days, duration_hours, price, description) VALUES (?, ?, ?, ?, ?)",
      [name, days, hours || null, price, description || null]
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
    const { name, duration_days, duration_hours, price, description, active, instructor_ids } = req.body
    const days = duration_days != null ? Number(duration_days) : 0
    const hours = duration_hours != null ? Number(duration_hours) : 0
    const [result] = await pool.query(
      "UPDATE plans SET name = ?, duration_days = ?, duration_hours = ?, price = ?, description = ?, active = ? WHERE id = ?",
      [name, days, hours || null, price, description, active !== undefined ? active : true, id]
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

    const [planRows] = await pool.query("SELECT id, active FROM plans WHERE id = ?", [id])
    if (planRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Plan no encontrado",
      })
    }

    const [countRows] = await pool.query(
      "SELECT COUNT(*) as count FROM memberships WHERE plan_id = ?",
      [id],
    )
    const membershipCount = Number(countRows[0]?.count ?? 0)

    if (membershipCount > 0) {
      const wasActive = rowIsActive(planRows[0])
      await pool.query("UPDATE plans SET active = FALSE WHERE id = ?", [id])
      return res.json({
        success: true,
        action: "deactivated",
        message: wasActive
          ? "El plan tiene membresías en el historial. Se desactivó: no se podrá elegir en nuevas membresías; las actuales y pasadas no se alteran."
          : "El plan ya estaba desactivado. Sigue sin mostrarse para nuevas membresías.",
      })
    }

    const [del] = await pool.query("DELETE FROM plans WHERE id = ?", [id])
    if (del.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Plan no encontrado",
      })
    }
    return res.json({
      success: true,
      action: "deleted",
      message: "Plan eliminado correctamente",
    })
  } catch (error) {
    console.error("Error al eliminar o desactivar plan:", error)
    res.status(500).json({
      success: false,
      message: "Error al procesar la solicitud del plan",
    })
  }
}

export const togglePlanStatus = async (req, res) => {
  try {
    const { id } = req.params
    const [rows] = await pool.query("SELECT * FROM plans WHERE id = ?", [id])
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Plan no encontrado",
      })
    }
    const nextActive = !rowIsActive(rows[0])
    await pool.query("UPDATE plans SET active = ? WHERE id = ?", [nextActive ? 1 : 0, id])
    const [updated] = await pool.query("SELECT * FROM plans WHERE id = ?", [id])
    const [withInstructors] = await attachInstructorsToPlans(updated)
    res.json({
      success: true,
      message: nextActive ? "Plan activado correctamente" : "Plan desactivado correctamente",
      data: withInstructors[0],
    })
  } catch (error) {
    console.error("Error al cambiar estado del plan:", error)
    res.status(500).json({
      success: false,
      message: "Error al cambiar estado del plan",
    })
  }
}
