import pool from "../config/database.js"

// Obtener sesión activa
export const getActiveSession = async (req, res) => {
  try {
    console.log("[v0] Getting active cash session")

    const [sessions] = await pool.query(
      `SELECT cs.*, u.username, u.name as user_name 
       FROM cash_sessions cs
       JOIN users u ON cs.user_id = u.id
       WHERE cs.status = 'open'
       ORDER BY cs.opened_at DESC
       LIMIT 1`,
    )

    if (sessions.length === 0) {
      return res.json({
        success: true,
        message: "No hay sesión activa",
        data: null,
      })
    }

    // Obtener movimientos de la sesión activa
    const [movements] = await pool.query(
      `SELECT cm.*, u.username as created_by_username, u.name as created_by_name
       FROM cash_movements cm
       JOIN users u ON cm.created_by = u.id
       WHERE cm.cash_session_id = ?
       ORDER BY cm.created_at DESC`,
      [sessions[0].id],
    )

    const sessionData = {
      ...sessions[0],
      movements,
    }

    console.log("[v0] Active session found:", sessionData.id)

    res.json({
      success: true,
      message: "Sesión activa obtenida",
      data: sessionData,
    })
  } catch (error) {
    console.error("[v0] Error getting active session:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener sesión activa",
      error: error.message,
    })
  }
}

// Abrir caja
export const openCashSession = async (req, res) => {
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()
    console.log("[v0] Opening cash session")

    const { opening_amount, notes } = req.body
    const user_id = req.user.id

    // Verificar que no haya una sesión abierta
    const [activeSessions] = await connection.query("SELECT id FROM cash_sessions WHERE status = 'open' LIMIT 1")

    if (activeSessions.length > 0) {
      await connection.rollback()
      return res.status(400).json({
        success: false,
        message: "Ya existe una sesión de caja abierta",
      })
    }

    // Crear nueva sesión
    const [result] = await connection.query(
      `INSERT INTO cash_sessions (user_id, opening_amount, notes) 
       VALUES (?, ?, ?)`,
      [user_id, opening_amount || 0, notes || null],
    )

    // Obtener la sesión creada
    const [newSession] = await connection.query(
      `SELECT cs.*, u.username, u.name as user_name 
       FROM cash_sessions cs
       JOIN users u ON cs.user_id = u.id
       WHERE cs.id = ?`,
      [result.insertId],
    )

    await connection.commit()
    console.log("[v0] Cash session opened:", result.insertId)

    res.json({
      success: true,
      message: "Caja abierta exitosamente",
      data: newSession[0],
    })
  } catch (error) {
    await connection.rollback()
    console.error("[v0] Error opening cash session:", error)
    res.status(500).json({
      success: false,
      message: "Error al abrir caja",
      error: error.message,
    })
  } finally {
    connection.release()
  }
}

// Cerrar caja
export const closeCashSession = async (req, res) => {
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()
    console.log("[v0] Closing cash session")

    const { closing_amount, closing_cash, closing_transfer, closing_card, notes } = req.body
    const sessionId = req.params.id

    const cash = closing_cash != null ? Number.parseFloat(closing_cash) : null
    const transfer = closing_transfer != null ? Number.parseFloat(closing_transfer) : null
    const card = closing_card != null ? Number.parseFloat(closing_card) : null
    const totalFromMethods = [cash, transfer, card].filter((n) => n != null && !Number.isNaN(n)).reduce((s, n) => s + n, 0)
    const finalClosingAmount =
      totalFromMethods > 0 ? totalFromMethods : closing_amount != null ? Number.parseFloat(closing_amount) : null

    if (finalClosingAmount == null || Number.isNaN(finalClosingAmount)) {
      await connection.rollback()
      return res.status(400).json({
        success: false,
        message: "Debe indicar el monto de cierre (total o desglose por método)",
      })
    }

    // Verificar que la sesión existe y está abierta
    const [sessions] = await connection.query("SELECT * FROM cash_sessions WHERE id = ? AND status = 'open'", [
      sessionId,
    ])

    if (sessions.length === 0) {
      await connection.rollback()
      return res.status(404).json({
        success: false,
        message: "Sesión no encontrada o ya está cerrada",
      })
    }

    // Calcular el total esperado
    const [movements] = await connection.query(
      `SELECT 
        SUM(CASE WHEN type IN ('income', 'membership_payment', 'sale') THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense
       FROM cash_movements 
       WHERE cash_session_id = ?`,
      [sessionId],
    )

    const totalIncome = Number.parseFloat(movements[0].total_income) || 0
    const totalExpense = Number.parseFloat(movements[0].total_expense) || 0
    const openingAmount = Number.parseFloat(sessions[0].opening_amount)
    const expectedAmount = openingAmount + totalIncome - totalExpense
    const difference = finalClosingAmount - expectedAmount

    // Cerrar sesión (incluye montos por método si se enviaron)
    await connection.query(
      `UPDATE cash_sessions 
       SET closing_amount = ?, closing_cash = ?, closing_transfer = ?, closing_card = ?,
           expected_amount = ?, difference = ?, 
           status = 'closed', closed_at = NOW(), notes = ?
       WHERE id = ?`,
      [
        finalClosingAmount,
        cash ?? null,
        transfer ?? null,
        card ?? null,
        expectedAmount,
        difference,
        notes || sessions[0].notes,
        sessionId,
      ],
    )

    // Obtener sesión actualizada
    const [closedSession] = await connection.query(
      `SELECT cs.*, u.username, u.name as user_name 
       FROM cash_sessions cs
       JOIN users u ON cs.user_id = u.id
       WHERE cs.id = ?`,
      [sessionId],
    )

    await connection.commit()
    console.log("[v0] Cash session closed:", sessionId)

    res.json({
      success: true,
      message: "Caja cerrada exitosamente",
      data: closedSession[0],
    })
  } catch (error) {
    await connection.rollback()
    console.error("[v0] Error closing cash session:", error)
    res.status(500).json({
      success: false,
      message: "Error al cerrar caja",
      error: error.message,
    })
  } finally {
    connection.release()
  }
}

// Registrar movimiento de caja
export const createMovement = async (req, res) => {
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()
    console.log("[v0] Creating cash movement")

    const { type, payment_method, amount, description, reference } = req.body
    const created_by = req.user.id

    // Verificar que haya una sesión abierta
    const [activeSessions] = await connection.query("SELECT id FROM cash_sessions WHERE status = 'open' LIMIT 1")

    if (activeSessions.length === 0) {
      await connection.rollback()
      return res.status(400).json({
        success: false,
        message: "No hay una sesión de caja abierta",
      })
    }

    const cash_session_id = activeSessions[0].id

    // Crear movimiento
    const [result] = await connection.query(
      `INSERT INTO cash_movements 
       (cash_session_id, type, payment_method, amount, description, reference, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [cash_session_id, type, payment_method, amount, description, reference || null, created_by],
    )

    // Obtener movimiento creado
    const [newMovement] = await connection.query(
      `SELECT cm.*, u.username as created_by_username, u.name as created_by_name
       FROM cash_movements cm
       JOIN users u ON cm.created_by = u.id
       WHERE cm.id = ?`,
      [result.insertId],
    )

    await connection.commit()
    console.log("[v0] Cash movement created:", result.insertId)

    res.json({
      success: true,
      message: "Movimiento registrado exitosamente",
      data: newMovement[0],
    })
  } catch (error) {
    await connection.rollback()
    console.error("[v0] Error creating movement:", error)
    res.status(500).json({
      success: false,
      message: "Error al registrar movimiento",
      error: error.message,
    })
  } finally {
    connection.release()
  }
}

// Obtener historial de sesiones (solo cerradas)
export const getCashSessions = async (req, res) => {
  try {
    console.log("[v0] Getting cash sessions history")

    const [sessions] = await pool.query(
      `SELECT cs.*, u.username, u.name as user_name,
        (SELECT COUNT(*) FROM cash_movements WHERE cash_session_id = cs.id) as movements_count,
        (SELECT COALESCE(SUM(CASE WHEN cm.type IN ('income', 'membership_payment', 'sale') THEN cm.amount ELSE 0 END), 0)
         FROM cash_movements cm WHERE cm.cash_session_id = cs.id) as total_income,
        (SELECT COALESCE(SUM(CASE WHEN cm.type = 'expense' THEN cm.amount ELSE 0 END), 0)
         FROM cash_movements cm WHERE cm.cash_session_id = cs.id) as total_expenses
       FROM cash_sessions cs
       JOIN users u ON cs.user_id = u.id
       WHERE cs.status = 'closed'
       ORDER BY cs.closed_at DESC, cs.opened_at DESC`,
    )

    console.log("[v0] Cash sessions retrieved:", sessions.length)

    res.json({
      success: true,
      message: "Historial de sesiones obtenido",
      data: sessions,
    })
  } catch (error) {
    console.error("[v0] Error getting sessions:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener historial",
      error: error.message,
    })
  }
}

// Obtener detalle de sesión
export const getCashSessionDetail = async (req, res) => {
  try {
    console.log("[v0] Getting cash session detail")
    const sessionId = req.params.id

    // Obtener sesión
    const [sessions] = await pool.query(
      `SELECT cs.*, u.username, u.name as user_name 
       FROM cash_sessions cs
       JOIN users u ON cs.user_id = u.id
       WHERE cs.id = ?`,
      [sessionId],
    )

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Sesión no encontrada",
      })
    }

    // Totales desde movimientos
    const [totals] = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN type IN ('income', 'membership_payment', 'sale') THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses
       FROM cash_movements WHERE cash_session_id = ?`,
      [sessionId],
    )

    // Obtener movimientos (cash_movements no tiene membership_id, solo descripción)
    const [movements] = await pool.query(
      `SELECT cm.*, u.username as created_by_username, u.name as created_by_name
       FROM cash_movements cm
       JOIN users u ON cm.created_by = u.id
       WHERE cm.cash_session_id = ?
       ORDER BY cm.created_at DESC`,
      [sessionId],
    )

    const totalIncome = Number(totals[0]?.total_income) || 0
    const totalExpenses = Number(totals[0]?.total_expenses) || 0

    const sessionData = {
      ...sessions[0],
      total_income: totalIncome,
      total_expenses: totalExpenses,
      movements,
    }

    console.log("[v0] Session detail retrieved:", sessionId)

    res.json({
      success: true,
      message: "Detalle de sesión obtenido",
      data: sessionData,
    })
  } catch (error) {
    console.error("[v0] Error getting session detail:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener detalle",
      error: error.message,
    })
  }
}

export const getIncomeByPaymentMethod = async (req, res) => {
  try {
    console.log("[v0] Getting income breakdown by payment method")

    // Obtener sesión activa
    const [sessions] = await pool.query(
      `SELECT id FROM cash_sessions 
       WHERE status = 'open' 
       ORDER BY opened_at DESC 
       LIMIT 1`,
    )

    if (sessions.length === 0) {
      return res.json({
        success: true,
        message: "No hay sesión activa",
        data: null,
      })
    }

    const sessionId = sessions[0].id

    // Obtener ingresos por método de pago
    const [breakdown] = await pool.query(
      `SELECT 
        payment_method,
        SUM(amount) as total
       FROM cash_movements
       WHERE cash_session_id = ? 
         AND type IN ('income', 'membership_payment', 'sale')
         AND payment_method IS NOT NULL
       GROUP BY payment_method`,
      [sessionId],
    )

    console.log("[v0] Income breakdown:", breakdown)

    res.json({
      success: true,
      message: "Desglose de ingresos obtenido",
      data: breakdown,
    })
  } catch (error) {
    console.error("[v0] Error getting income breakdown:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener desglose de ingresos",
      error: error.message,
    })
  }
}
