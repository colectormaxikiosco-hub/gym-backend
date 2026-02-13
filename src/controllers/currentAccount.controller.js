import pool from "../config/database.js"

// Obtener cuenta corriente de un cliente con saldo actual
export const getClientCurrentAccount = async (req, res) => {
  try {
    const { clientId } = req.params

    console.log("[v0] Obteniendo cuenta corriente del cliente:", clientId)

    // Obtener todos los movimientos
    const [movements] = await pool.query(
      `SELECT 
        ca.*,
        u.username as created_by_name,
        m.start_date as membership_date,
        p.name as plan_name
      FROM current_account ca
      LEFT JOIN users u ON ca.created_by = u.id
      LEFT JOIN memberships m ON ca.membership_id = m.id
      LEFT JOIN plans p ON m.plan_id = p.id
      WHERE ca.client_id = ?
      ORDER BY ca.created_at DESC`,
      [clientId],
    )

    // Calcular saldo actual
    const balance = movements.length > 0 ? movements[0].balance : 0

    console.log("[v0] Movimientos encontrados:", movements.length, "Saldo:", balance)

    res.json({
      success: true,
      data: {
        movements,
        balance,
      },
    })
  } catch (error) {
    console.error("[v0] Error al obtener cuenta corriente:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener cuenta corriente",
    })
  }
}

// Registrar un pago de cuenta corriente (abono)
export const registerPayment = async (req, res) => {
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const { clientId } = req.params
    const { amount, payment_method, description } = req.body
    const userId = req.user.id

    console.log("[v0] Registrando pago de cuenta corriente:", { clientId, amount, payment_method })

    // Validar que haya una caja abierta
    const [openSession] = await connection.query(
      `SELECT id, opening_amount FROM cash_sessions 
       WHERE status = 'open' 
       ORDER BY opened_at DESC 
       LIMIT 1`,
    )

    if (openSession.length === 0) {
      await connection.rollback()
      return res.status(400).json({
        success: false,
        message: "No hay una sesión de caja abierta",
      })
    }

    const sessionId = openSession[0].id

    // Obtener saldo actual
    const [lastMovement] = await connection.query(
      `SELECT balance FROM current_account 
       WHERE client_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [clientId],
    )

    const currentBalance = lastMovement.length > 0 ? Number.parseFloat(lastMovement[0].balance) : 0
    const newBalance = currentBalance - Number.parseFloat(amount)

    // Registrar crédito en cuenta corriente
    const [result] = await connection.query(
      `INSERT INTO current_account 
       (client_id, type, amount, description, payment_method, balance, created_by)
       VALUES (?, 'credit', ?, ?, ?, ?, ?)`,
      [clientId, amount, description || "Pago de cuenta corriente", payment_method, newBalance, userId],
    )

    // Registrar movimiento en caja usando solo las columnas existentes
    const [cashMovement] = await connection.query(
      `INSERT INTO cash_movements 
       (cash_session_id, type, amount, payment_method, description, reference, created_by)
       VALUES (?, 'income', ?, ?, ?, ?, ?)`,
      [
        sessionId,
        amount,
        payment_method,
        description || "Pago de cuenta corriente",
        `cuenta_corriente_${result.insertId}`,
        userId,
      ],
    )

    // Vincular movimiento de caja con cuenta corriente
    await connection.query(`UPDATE current_account SET cash_movement_id = ? WHERE id = ?`, [
      cashMovement.insertId,
      result.insertId,
    ])

    await connection.commit()

    console.log("[v0] Pago registrado exitosamente")

    res.json({
      success: true,
      message: "Pago registrado exitosamente",
      data: { id: result.insertId, newBalance },
    })
  } catch (error) {
    await connection.rollback()
    console.error("[v0] Error al registrar pago:", error)
    res.status(500).json({
      success: false,
      message: "Error al registrar pago",
    })
  } finally {
    connection.release()
  }
}

// Obtener resumen de cuenta corriente (total deudas pendientes)
export const getCurrentAccountSummary = async (req, res) => {
  try {
    const [summary] = await pool.query(
      `SELECT 
        c.id,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        COALESCE(
          (SELECT balance 
           FROM current_account 
           WHERE client_id = c.id 
           ORDER BY created_at DESC 
           LIMIT 1), 
          0
        ) as balance
      FROM clients c
      HAVING balance > 0
      ORDER BY balance DESC`,
    )

    res.json({
      success: true,
      data: summary,
    })
  } catch (error) {
    console.error("[v0] Error al obtener resumen:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener resumen de cuenta corriente",
    })
  }
}
