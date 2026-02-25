import pool from "../config/database.js"

// Sincroniza estado en BD: las que están 'active' y ya vencieron (end_date < hoy) pasan a 'expired'
// Retorna el resultado del UPDATE para poder usar affectedRows si hace falta
const syncExpiredMemberships = async () => {
  const [result] = await pool.query(
    "UPDATE memberships SET status = 'expired' WHERE status = 'active' AND end_date < CURDATE()",
  )
  return result
}

export const getAllMemberships = async (req, res) => {
  try {
    // Antes de listar, actualizar membresías vencidas para que el estado en BD sea correcto
    await syncExpiredMemberships()

    const { status, plan_id, search, page: pageParam, limit: limitParam } = req.query

    const usePagination = pageParam != null && limitParam != null
    const page = usePagination ? Math.max(1, parseInt(pageParam, 10) || 1) : 1
    const limit = usePagination
      ? Math.max(1, Math.min(100, parseInt(limitParam, 10) || 10))
      : 1000
    const offset = usePagination ? (page - 1) * limit : 0

    const baseFrom = `
      FROM memberships m
      INNER JOIN clients c ON m.client_id = c.id
      INNER JOIN plans p ON m.plan_id = p.id
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN instructors i ON m.instructor_id = i.id
      WHERE 1=1
    `
    const params = []

    if (status) {
      params.push(status)
    }
    if (plan_id) {
      params.push(plan_id)
    }
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`
      params.push(searchTerm, searchTerm, searchTerm)
    }

    const statusCondition = status ? " AND m.status = ?" : ""
    const planCondition = plan_id ? " AND m.plan_id = ?" : ""
    const searchCondition = search && search.trim()
      ? " AND (c.name LIKE ? OR c.dni LIKE ? OR c.phone LIKE ?)"
      : ""

    const baseWhere = baseFrom + statusCondition + planCondition + searchCondition

    const countQuery = `SELECT COUNT(*) as total ${baseWhere}`
    const [countResult] = await pool.query(countQuery, params)
    const total = countResult[0]?.total ?? 0
    const totalPages = usePagination ? Math.max(1, Math.ceil(total / limit)) : 1

    const limitClause = usePagination ? " LIMIT ? OFFSET ?" : ""
    const dataQuery = `
      SELECT 
        m.*,
        c.name as client_name,
        c.dni as client_dni,
        c.phone as client_phone,
        p.name as plan_name,
        p.price as plan_price,
        p.duration_days as plan_duration,
        DATEDIFF(m.end_date, CURDATE()) as days_remaining,
        u.name as created_by_name,
        i.name as instructor_name
      ${baseWhere}
      ORDER BY m.created_at DESC
      ${limitClause}
    `
    const dataParams = usePagination ? [...params, limit, offset] : params
    const [memberships] = await pool.query(dataQuery, dataParams)

    res.json({
      success: true,
      message: "Membresías obtenidas correctamente",
      data: memberships,
      pagination: { page, limit: usePagination ? limit : (total > 0 ? total : 1), total, totalPages },
    })
  } catch (error) {
    console.error("Error al obtener membresías:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener membresías",
    })
  }
}

export const getMembershipById = async (req, res) => {
  try {
    const { id } = req.params

    // Sincronizar esta membresía si está activa y ya venció
    await pool.query(
      "UPDATE memberships SET status = 'expired' WHERE id = ? AND status = 'active' AND end_date < CURDATE()",
      [id],
    )

    const [memberships] = await pool.query(
      `
      SELECT 
        m.*,
        c.name as client_name,
        c.dni as client_dni,
        c.phone as client_phone,
        p.name as plan_name,
        p.price as plan_price,
        p.duration_days as plan_duration,
        i.name as instructor_name
      FROM memberships m
      INNER JOIN clients c ON m.client_id = c.id
      INNER JOIN plans p ON m.plan_id = p.id
      LEFT JOIN instructors i ON m.instructor_id = i.id
      WHERE m.id = ?
    `,
      [id],
    )

    if (memberships.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Membresía no encontrada",
      })
    }

    res.json({
      success: true,
      data: memberships[0],
    })
  } catch (error) {
    console.error("Error al obtener membresía:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener membresía",
    })
  }
}

export const getClientActiveMembership = async (req, res) => {
  try {
    const { clientId } = req.params

    const [memberships] = await pool.query(
      `
      SELECT 
        m.*,
        p.name as plan_name,
        p.price as plan_price,
        p.duration_days as plan_duration,
        DATEDIFF(m.end_date, CURDATE()) as days_remaining
      FROM memberships m
      INNER JOIN plans p ON m.plan_id = p.id
      WHERE m.client_id = ? AND m.status = 'active' AND m.start_date <= CURDATE() AND m.end_date >= CURDATE()
      ORDER BY m.end_date DESC
      LIMIT 1
    `,
      [clientId],
    )

    if (memberships.length === 0) {
      return res.json({
        success: true,
        message: "No hay membresía activa",
        data: null,
      })
    }

    res.json({
      success: true,
      data: memberships[0],
    })
  } catch (error) {
    console.error("Error al obtener membresía activa:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener membresía activa",
    })
  }
}

export const createMembership = async (req, res) => {
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()
    console.log("[v0] Creando membresía con pago:", req.body)

    const { client_id, plan_id, instructor_id: instructorIdParam, start_date, payment_method, payments: paymentsBody, notes } = req.body
    const created_by = req.user.id

    const startDateParsed = start_date ? new Date(start_date) : null
    if (!start_date || !startDateParsed || Number.isNaN(startDateParsed.getTime())) {
      await connection.rollback()
      return res.status(400).json({
        success: false,
        message: "La fecha de inicio es requerida y debe ser una fecha válida (formato AAAA-MM-DD).",
      })
    }

    // Membresía "en vigor" = activa, ya iniciada y no vencida
    const [existingCurrent] = await connection.query(
      `SELECT id, end_date FROM memberships 
       WHERE client_id = ? AND status = 'active' AND start_date <= CURDATE() AND end_date >= CURDATE() 
       ORDER BY end_date DESC LIMIT 1`,
      [client_id],
    )
    if (existingCurrent.length > 0) {
      const currentEnd = existingCurrent[0].end_date ? String(existingCurrent[0].end_date).split("T")[0] : null
      const newStart = start_date ? String(start_date).split("T")[0] : null
      const isRenewal = currentEnd && newStart && currentEnd === newStart
      if (!isRenewal) {
        await connection.rollback()
        return res.status(400).json({
          success: false,
          message:
            "El cliente ya tiene una membresía en vigor. Para renovar o cambiar, la nueva membresía debe comenzar el mismo día en que vence la actual (" +
            currentEnd +
            ").",
        })
      }
    }

    const validPaymentMethods = ["cash", "transfer", "credit_card", "current_account"]
    let payments = []
    if (paymentsBody && Array.isArray(paymentsBody) && paymentsBody.length > 0) {
      for (const p of paymentsBody) {
        const method = (p.payment_method || "").trim()
        const amount = Math.round(Number(p.amount) * 100) / 100
        if (!validPaymentMethods.includes(method) || amount <= 0) continue
        payments.push({ payment_method: method, amount })
      }
    }
    if (payments.length === 0) {
      payments = payment_method && validPaymentMethods.includes(payment_method)
        ? [{ payment_method, amount: 0 }]
        : []
    }

    // Obtener información del plan
    const [plans] = await connection.query(
      "SELECT duration_days, price, name FROM plans WHERE id = ? AND active = TRUE",
      [plan_id],
    )

    if (plans.length === 0) {
      await connection.rollback()
      return res.status(404).json({
        success: false,
        message: "Plan no encontrado o inactivo",
      })
    }

    const plan = plans[0]
    const planPrice = Math.round(Number(plan.price) * 100) / 100

    if (payments.length === 1 && payments[0].amount === 0) {
      payments[0].amount = planPrice
    }
    if (payments.length === 0) {
      await connection.rollback()
      return res.status(400).json({
        success: false,
        message: "Debe indicar método de pago o pagos combinados.",
      })
    }
    const sumPayments = Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100) / 100
    if (Math.abs(sumPayments - planPrice) > 0.01) {
      await connection.rollback()
      return res.status(400).json({
        success: false,
        message: `Los pagos deben sumar exactamente el precio del plan (${planPrice}).`,
      })
    }
    const hasCurrentAccount = payments.some((p) => p.payment_method === "current_account")
    const hasCashPayment = payments.some((p) => ["cash", "transfer", "credit_card"].includes(p.payment_method))
    if (hasCashPayment) {
      const [activeSessions] = await connection.query("SELECT id FROM cash_sessions WHERE status = 'open' LIMIT 1")
      if (activeSessions.length === 0) {
        await connection.rollback()
        return res.status(400).json({
          success: false,
          message: "No hay una sesión de caja abierta. Debe abrir caja primero.",
        })
      }
    }

    // Obtener instructores del plan
    const [planInstructors] = await connection.query(
      "SELECT instructor_id FROM plan_instructors WHERE plan_id = ?",
      [plan_id],
    )
    const planInstructorIds = planInstructors.map((r) => r.instructor_id)
    const instructorCount = planInstructorIds.length

    // Determinar instructor_id final
    let finalInstructorId = null
    if (instructorCount === 0) {
      finalInstructorId = null
    } else if (instructorCount === 1) {
      const provided = instructorIdParam != null && instructorIdParam !== ""
      finalInstructorId = provided ? Number(instructorIdParam) : planInstructorIds[0]
      if (finalInstructorId && !planInstructorIds.includes(finalInstructorId)) {
        await connection.rollback()
        return res.status(400).json({
          success: false,
          message: "El instructor no pertenece a este plan",
        })
      }
      if (!finalInstructorId) finalInstructorId = planInstructorIds[0]
    } else {
      if (instructorIdParam == null || instructorIdParam === "") {
        await connection.rollback()
        return res.status(400).json({
          success: false,
          message: "Debe seleccionar un instructor para este plan",
        })
      }
      finalInstructorId = Number(instructorIdParam)
      if (!planInstructorIds.includes(finalInstructorId)) {
        await connection.rollback()
        return res.status(400).json({
          success: false,
          message: "El instructor no pertenece a este plan",
        })
      }
    }

    // Calcular fecha de fin
    const startDate = new Date(start_date)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + plan.duration_days)

    const membershipPaymentMethod = payments.length === 1 ? payments[0].payment_method : "combined"
    const payment_status = hasCurrentAccount ? "pending" : "paid"
    const paidAt = hasCurrentAccount ? null : new Date()

    const [membershipResult] = await connection.query(
      `INSERT INTO memberships 
       (client_id, plan_id, instructor_id, start_date, end_date, payment_method, payment_status, paid_at, status, notes, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      [
        client_id,
        plan_id,
        finalInstructorId,
        start_date,
        endDate.toISOString().split("T")[0],
        membershipPaymentMethod,
        payment_status,
        paidAt,
        notes || null,
        created_by,
      ],
    )

    const membership_id = membershipResult.insertId
    let firstCashMovementId = null
    const [activeSessions] = await connection.query("SELECT id FROM cash_sessions WHERE status = 'open' LIMIT 1")
    const cash_session_id = activeSessions.length > 0 ? activeSessions[0].id : null

    for (const p of payments) {
      let cashMovementId = null
      if (p.payment_method === "current_account") {
        const [lastMovement] = await connection.query(
          `SELECT balance FROM current_account WHERE client_id = ? ORDER BY created_at DESC LIMIT 1`,
          [client_id],
        )
        const currentBalance = lastMovement.length > 0 ? Number(lastMovement[0].balance) : 0
        const newBalance = Math.round((currentBalance + p.amount) * 100) / 100
        await connection.query(
          `INSERT INTO current_account (client_id, membership_id, type, amount, description, balance, created_by)
           VALUES (?, ?, 'debit', ?, ?, ?, ?)`,
          [client_id, membership_id, p.amount, `Membresía - ${plan.name}`, newBalance, created_by],
        )
      } else if (cash_session_id && p.amount > 0) {
        const [movementResult] = await connection.query(
          `INSERT INTO cash_movements (cash_session_id, type, payment_method, amount, description, created_by)
           VALUES (?, 'membership_payment', ?, ?, ?, ?)`,
          [cash_session_id, p.payment_method, p.amount, `Pago de membresía - ${plan.name}`, created_by],
        )
        cashMovementId = movementResult.insertId
        if (!firstCashMovementId) firstCashMovementId = cashMovementId
      }
      await connection.query(
        `INSERT INTO membership_payments (membership_id, payment_method, amount, cash_movement_id) VALUES (?, ?, ?, ?)`,
        [membership_id, p.payment_method, p.amount, cashMovementId],
      )
    }
    if (firstCashMovementId) {
      await connection.query("UPDATE memberships SET cash_movement_id = ? WHERE id = ?", [firstCashMovementId, membership_id])
    }

    // Plan de 1 día: registrar entrada automáticamente (es un solo uso)
    if (plan.duration_days === 1) {
      await connection.query(
        `INSERT INTO client_entries (client_id, membership_id, entered_at, created_by)
         VALUES (?, ?, NOW(), ?)`,
        [client_id, membership_id, created_by],
      )
      console.log("[v0] Entrada automática registrada (plan 1 día)")
    }

    // Obtener membresía completa
    const [newMembership] = await connection.query(
      `SELECT 
        m.*,
        c.name as client_name,
        c.dni as client_dni,
        p.name as plan_name,
        p.price as plan_price,
        u.name as created_by_name,
        i.name as instructor_name
      FROM memberships m
      INNER JOIN clients c ON m.client_id = c.id
      INNER JOIN plans p ON m.plan_id = p.id
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN instructors i ON m.instructor_id = i.id
      WHERE m.id = ?`,
      [membership_id],
    )

    await connection.commit()
    console.log("[v0] Membresía creada exitosamente:", membership_id)

    res.status(201).json({
      success: true,
      message: "Membresía creada correctamente",
      data: newMembership[0],
    })
  } catch (error) {
    await connection.rollback()
    console.error("[v0] Error al crear membresía:", error)
    res.status(500).json({
      success: false,
      message: "Error al crear membresía",
      error: error.message,
    })
  } finally {
    connection.release()
  }
}

export const updateMembership = async (req, res) => {
  try {
    const { id } = req.params
    const { status, payment_status, notes } = req.body

    const [result] = await pool.query("UPDATE memberships SET status = ?, payment_status = ?, notes = ? WHERE id = ?", [
      status,
      payment_status,
      notes,
      id,
    ])

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Membresía no encontrada",
      })
    }

    const [updatedMembership] = await pool.query(
      `
      SELECT 
        m.*,
        c.name as client_name,
        p.name as plan_name,
        p.price as plan_price
      FROM memberships m
      INNER JOIN clients c ON m.client_id = c.id
      INNER JOIN plans p ON m.plan_id = p.id
      WHERE m.id = ?
    `,
      [id],
    )

    res.json({
      success: true,
      message: "Membresía actualizada correctamente",
      data: updatedMembership[0],
    })
  } catch (error) {
    console.error("Error al actualizar membresía:", error)
    res.status(500).json({
      success: false,
      message: "Error al actualizar membresía",
    })
  }
}

export const cancelMembership = async (req, res) => {
  const connection = await pool.getConnection()

  try {
    const { id } = req.params
    const created_by = req.user.id

    await connection.beginTransaction()

    // Sincronizar vencidas para no cancelar una que ya figura como activa pero venció
    await syncExpiredMemberships()

    // Obtener membresía con datos necesarios para revertir
    const [rows] = await connection.query(
      `SELECT m.id, m.client_id, m.plan_id, m.status, m.payment_method, m.cash_movement_id,
              c.name as client_name, p.name as plan_name, p.price as plan_price
       FROM memberships m
       INNER JOIN clients c ON c.id = m.client_id
       INNER JOIN plans p ON p.id = m.plan_id
       WHERE m.id = ?`,
      [id],
    )

    if (rows.length === 0) {
      await connection.rollback()
      connection.release()
      return res.status(404).json({
        success: false,
        message: "Membresía no encontrada",
      })
    }

    const membership = rows[0]
    if (membership.status !== "active") {
      await connection.rollback()
      connection.release()
      return res.status(400).json({
        success: false,
        message:
          membership.status === "expired"
            ? "No se puede cancelar: la membresía ya está vencida."
            : "No se puede cancelar: la membresía ya está cancelada.",
      })
    }

    let affectsCash = false
    let affectsCurrentAccount = false

    const [paymentRows] = await connection.query(
      "SELECT payment_method, amount, cash_movement_id FROM membership_payments WHERE membership_id = ?",
      [id],
    )

    if (paymentRows.length > 0) {
      for (const row of paymentRows) {
        if (row.payment_method === "current_account" && Number(row.amount) > 0) {
          const [lastMovement] = await connection.query(
            `SELECT balance FROM current_account WHERE client_id = ? ORDER BY created_at DESC LIMIT 1`,
            [membership.client_id],
          )
          const currentBalance = lastMovement.length > 0 ? Number(lastMovement[0].balance) : 0
          const newBalance = Math.round((currentBalance - Number(row.amount)) * 100) / 100
          await connection.query(
            `INSERT INTO current_account (client_id, membership_id, type, amount, description, balance, created_by)
             VALUES (?, ?, 'credit', ?, ?, ?, ?)`,
            [
              membership.client_id,
              id,
              Number(row.amount),
              `Cancelación membresía - ${membership.plan_name}`,
              newBalance,
              created_by,
            ],
          )
          affectsCurrentAccount = true
        }
        if (row.cash_movement_id) {
          const [movements] = await connection.query(
            "SELECT amount, payment_method, cash_session_id FROM cash_movements WHERE id = ?",
            [row.cash_movement_id],
          )
          if (movements.length > 0) {
            const [sessions] = await connection.query(
              "SELECT id, status FROM cash_sessions WHERE id = ?",
              [movements[0].cash_session_id],
            )
            if (sessions.length > 0 && sessions[0].status === "open") {
              await connection.query(
                `INSERT INTO cash_movements (cash_session_id, type, payment_method, amount, description, created_by)
                 VALUES (?, 'expense', ?, ?, ?, ?)`,
                [
                  movements[0].cash_session_id,
                  movements[0].payment_method || "cash",
                  Number(movements[0].amount),
                  `Cancelación membresía #${id} - ${membership.client_name} - ${membership.plan_name}`,
                  created_by,
                ],
              )
              affectsCash = true
            }
          }
        }
      }
    } else {
      if (membership.payment_method === "current_account") {
        const planPrice = Number.parseFloat(membership.plan_price)
        const [lastMovement] = await connection.query(
          `SELECT balance FROM current_account WHERE client_id = ? ORDER BY created_at DESC LIMIT 1`,
          [membership.client_id],
        )
        const currentBalance = lastMovement.length > 0 ? Number.parseFloat(lastMovement[0].balance) : 0
        const newBalance = currentBalance - planPrice
        await connection.query(
          `INSERT INTO current_account (client_id, membership_id, type, amount, description, balance, created_by)
           VALUES (?, ?, 'credit', ?, ?, ?, ?)`,
          [membership.client_id, id, planPrice, `Cancelación membresía - ${membership.plan_name}`, newBalance, created_by],
        )
        affectsCurrentAccount = true
      }
      if (membership.cash_movement_id) {
        const [movements] = await connection.query(
          "SELECT amount, payment_method, cash_session_id FROM cash_movements WHERE id = ?",
          [membership.cash_movement_id],
        )
        if (movements.length > 0) {
          const [sessions] = await connection.query(
            "SELECT id, status FROM cash_sessions WHERE id = ?",
            [movements[0].cash_session_id],
          )
          if (sessions.length > 0 && sessions[0].status === "open") {
            await connection.query(
              `INSERT INTO cash_movements (cash_session_id, type, payment_method, amount, description, created_by)
               VALUES (?, 'expense', ?, ?, ?, ?)`,
              [
                movements[0].cash_session_id,
                movements[0].payment_method || "cash",
                Number(movements[0].amount),
                `Cancelación membresía #${id} - ${membership.client_name} - ${membership.plan_name}`,
                created_by,
              ],
            )
            affectsCash = true
          }
        }
      }
    }

    // 3) Marcar membresía como cancelada
    await connection.query(
      "UPDATE memberships SET status = 'cancelled' WHERE id = ?",
      [id],
    )

    await connection.commit()
    connection.release()

    res.json({
      success: true,
      message: "Membresía cancelada correctamente",
      data: {
        affectsCash,
        affectsCurrentAccount,
      },
    })
  } catch (error) {
    await connection.rollback()
    connection.release()
    console.error("Error al cancelar membresía:", error)
    res.status(500).json({
      success: false,
      message: "Error al cancelar membresía",
      error: error.message,
    })
  }
}

// Endpoint explícito para sincronizar vencidas (útil para cron o llamada manual)
export const updateExpiredMemberships = async (req, res) => {
  try {
    const result = await syncExpiredMemberships()
    const affectedRows = result?.affectedRows ?? 0

    res.json({
      success: true,
      message: affectedRows
        ? `${affectedRows} membresía(s) actualizada(s) a expirada(s)`
        : "No había membresías pendientes de marcar como expiradas",
      affectedRows,
    })
  } catch (error) {
    console.error("Error al actualizar membresías expiradas:", error)
    res.status(500).json({
      success: false,
      message: "Error al actualizar membresías expiradas",
    })
  }
}

// Registra que se envió el recordatorio por WhatsApp (5, 4, 3, 2, 1 días o vence hoy = 0)
export const recordMembershipReminder = async (req, res) => {
  try {
    const { id } = req.params
    const { days_remaining: daysRemaining } = req.body

    const validDays = [0, 1, 2, 3, 4, 5]
    if (!validDays.includes(Number(daysRemaining))) {
      return res.status(400).json({
        success: false,
        message: "days_remaining debe ser 0, 1, 2, 3, 4 o 5",
      })
    }

    const [rows] = await pool.query(
      "SELECT id, reminder_sent_days FROM memberships WHERE id = ? AND status = 'active' AND start_date <= CURDATE() AND end_date >= CURDATE()",
      [id],
    )
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Membresía no encontrada o no activa",
      })
    }

    const current = (rows[0].reminder_sent_days || "").toString().trim()
    const sentSet = new Set(
      current
        ? current.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n))
        : [],
    )
    sentSet.add(Number(daysRemaining))
    const newValue = [...sentSet].sort((a, b) => b - a).join(",")

    await pool.query("UPDATE memberships SET reminder_sent_days = ? WHERE id = ?", [newValue, id])

    res.json({
      success: true,
      message: "Recordatorio registrado",
    })
  } catch (error) {
    console.error("Error al registrar recordatorio:", error)
    res.status(500).json({
      success: false,
      message: "Error al registrar recordatorio",
    })
  }
}
