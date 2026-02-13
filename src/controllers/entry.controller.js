import pool from "../config/database.js"

const COOLDOWN_MINUTES = 30

/**
 * Registra una entrada (ingreso) de un cliente al gimnasio.
 * Requiere: membresía activa, cooldown de 30 min desde la última entrada del cliente.
 */
export const registerEntry = async (req, res) => {
  try {
    const { clientId } = req.params
    const created_by = req.user.id

    const [clients] = await pool.query("SELECT id FROM clients WHERE id = ?", [clientId])
    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Cliente no encontrado",
      })
    }

    const [activeMemberships] = await pool.query(
      `SELECT m.id as membership_id
       FROM memberships m
       WHERE m.client_id = ? AND m.status = 'active' AND m.start_date <= CURDATE() AND m.end_date >= CURDATE()
       ORDER BY m.end_date DESC
       LIMIT 1`,
      [clientId],
    )
    if (activeMemberships.length === 0) {
      return res.status(400).json({
        success: false,
        message: "El cliente no tiene una membresía activa.",
      })
    }
    const membership_id = activeMemberships[0].membership_id

    const [lastEntry] = await pool.query(
      `SELECT entered_at FROM client_entries
       WHERE client_id = ?
       ORDER BY entered_at DESC
       LIMIT 1`,
      [clientId],
    )
    if (lastEntry.length > 0) {
      const lastEnteredAt = new Date(lastEntry[0].entered_at)
      const now = new Date()
      const diffMs = now - lastEnteredAt
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      if (diffMinutes < COOLDOWN_MINUTES) {
        const nextAllowedAt = new Date(lastEnteredAt.getTime() + COOLDOWN_MINUTES * 60 * 1000)
        const timeStr = nextAllowedAt.toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
        })
        return res.status(400).json({
          success: false,
          message: `Debe esperar ${COOLDOWN_MINUTES} minutos entre entradas. Podrá registrar otra entrada a las ${timeStr}.`,
        })
      }
    }

    await pool.query(
      `INSERT INTO client_entries (client_id, membership_id, entered_at, created_by)
       VALUES (?, ?, NOW(), ?)`,
      [clientId, membership_id, created_by],
    )

    res.status(201).json({
      success: true,
      message: "Entrada registrada correctamente",
    })
  } catch (error) {
    console.error("Error al registrar entrada:", error)
    res.status(500).json({
      success: false,
      message: "Error al registrar la entrada",
    })
  }
}

/**
 * Lista las entradas de un cliente con paginación.
 */
export const getEntriesByClient = async (req, res) => {
  try {
    const { clientId } = req.params
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10))
    const offset = (page - 1) * limit

    const [clients] = await pool.query("SELECT id FROM clients WHERE id = ?", [clientId])
    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Cliente no encontrado",
      })
    }

    const [countResult] = await pool.query(
      "SELECT COUNT(*) as total FROM client_entries WHERE client_id = ?",
      [clientId],
    )
    const total = countResult[0]?.total ?? 0
    const totalPages = Math.ceil(total / limit) || 1

    const [entries] = await pool.query(
      `SELECT ce.id, ce.entered_at, ce.created_at, p.name as plan_name, m.end_date as membership_end_date
       FROM client_entries ce
       INNER JOIN memberships m ON m.id = ce.membership_id
       INNER JOIN plans p ON p.id = m.plan_id
       WHERE ce.client_id = ?
       ORDER BY ce.entered_at DESC
       LIMIT ? OFFSET ?`,
      [clientId, limit, offset],
    )

    res.json({
      success: true,
      data: entries,
      pagination: { page, limit, total, totalPages },
    })
  } catch (error) {
    console.error("Error al obtener entradas del cliente:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener entradas",
    })
  }
}
