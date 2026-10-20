import pool from "../config/database.js"

const EPS = 0.0005

const resultFromDiff = (diff) => {
  if (Math.abs(diff) < EPS) return "ok"
  if (diff < 0) return "faltante"
  return "sobrante"
}

const mapControlRow = (row) => {
  if (!row) return null
  return {
    id: row.id,
    cash_session_id: row.cash_session_id,
    status: row.status,
    performed_by: row.performed_by,
    performed_by_name: row.performed_by_name || null,
    skipped_by: row.skipped_by,
    skipped_by_name: row.skipped_by_name || null,
    notes: row.notes,
    products_count: Number(row.products_count) || 0,
    ok_count: Number(row.ok_count) || 0,
    shortage_count: Number(row.shortage_count) || 0,
    surplus_count: Number(row.surplus_count) || 0,
    completed_at: row.completed_at,
    skipped_at: row.skipped_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    session_opened_at: row.session_opened_at || null,
    session_closed_at: row.session_closed_at || null,
    session_status: row.session_status || null,
    session_user_name: row.session_user_name || null,
  }
}

/** Asegura que exista un control pending para la sesión abierta. */
export const ensureControlForSession = async (connectionOrPool, cashSessionId) => {
  const db = connectionOrPool
  const [existing] = await db.query("SELECT id FROM stock_controls WHERE cash_session_id = ? LIMIT 1", [
    cashSessionId,
  ])
  if (existing.length > 0) return existing[0].id

  const [result] = await db.query("INSERT INTO stock_controls (cash_session_id, status) VALUES (?, 'pending')", [
    cashSessionId,
  ])
  return result.insertId
}

const fetchControlById = async (id) => {
  const [rows] = await pool.query(
    `SELECT sc.*,
            up.name AS performed_by_name,
            usk.name AS skipped_by_name,
            cs.opened_at AS session_opened_at,
            cs.closed_at AS session_closed_at,
            cs.status AS session_status,
            u.name AS session_user_name
     FROM stock_controls sc
     JOIN cash_sessions cs ON cs.id = sc.cash_session_id
     JOIN users u ON u.id = cs.user_id
     LEFT JOIN users up ON up.id = sc.performed_by
     LEFT JOIN users usk ON usk.id = sc.skipped_by
     WHERE sc.id = ?`,
    [id],
  )
  return rows[0] || null
}

const fetchItems = async (controlId, resultFilter) => {
  let sql = `SELECT * FROM stock_control_items WHERE stock_control_id = ?`
  const params = [controlId]
  if (resultFilter && ["ok", "faltante", "sobrante"].includes(resultFilter)) {
    sql += " AND result = ?"
    params.push(resultFilter)
  }
  sql += " ORDER BY product_name ASC"
  const [rows] = await pool.query(sql, params)
  return rows
}

export const getCurrentStockControl = async (req, res) => {
  try {
    const [sessions] = await pool.query(
      `SELECT id FROM cash_sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1`,
    )
    if (sessions.length === 0) {
      return res.json({
        success: true,
        message: "No hay sesión de caja abierta",
        data: null,
      })
    }

    const sessionId = sessions[0].id
    await ensureControlForSession(pool, sessionId)
    const [rows] = await pool.query(
      `SELECT sc.*,
              up.name AS performed_by_name,
              usk.name AS skipped_by_name,
              cs.opened_at AS session_opened_at,
              cs.closed_at AS session_closed_at,
              cs.status AS session_status,
              u.name AS session_user_name
       FROM stock_controls sc
       JOIN cash_sessions cs ON cs.id = sc.cash_session_id
       JOIN users u ON u.id = cs.user_id
       LEFT JOIN users up ON up.id = sc.performed_by
       LEFT JOIN users usk ON usk.id = sc.skipped_by
       WHERE sc.cash_session_id = ?
       LIMIT 1`,
      [sessionId],
    )

    const control = mapControlRow(rows[0])
    let items = []
    if (control && control.status === "completed") {
      items = await fetchItems(control.id, null)
    }

    res.json({
      success: true,
      data: control ? { ...control, items } : null,
    })
  } catch (error) {
    console.error("Error al obtener control de stock actual:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener control de stock",
    })
  }
}

export const saveCurrentStockControl = async (req, res) => {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    const userId = req.user.id
    const { items, notes } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      await connection.rollback()
      return res.status(400).json({
        success: false,
        message: "Debés controlar al menos un producto para guardar el control",
      })
    }

    const [sessions] = await connection.query(
      `SELECT id FROM cash_sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1`,
    )
    if (sessions.length === 0) {
      await connection.rollback()
      return res.status(400).json({
        success: false,
        message: "No hay una sesión de caja abierta. Abrí caja para realizar el control.",
      })
    }

    const sessionId = sessions[0].id
    const controlId = await ensureControlForSession(connection, sessionId)

    const [controls] = await connection.query("SELECT * FROM stock_controls WHERE id = ? FOR UPDATE", [controlId])
    if (controls.length === 0) {
      await connection.rollback()
      return res.status(404).json({
        success: false,
        message: "Control de stock no encontrado",
      })
    }

    const seen = new Set()
    const normalized = []

    for (const raw of items) {
      const productId = Number(raw.product_id)
      if (!productId || seen.has(productId)) continue
      seen.add(productId)

      const counted = Number(raw.counted_stock)
      if (Number.isNaN(counted) || counted < 0) {
        await connection.rollback()
        return res.status(400).json({
          success: false,
          message: "La cantidad contada debe ser un número mayor o igual a 0",
        })
      }

      const [products] = await connection.query(
        "SELECT id, name, code, unit, stock, active FROM products WHERE id = ?",
        [productId],
      )
      if (products.length === 0) {
        await connection.rollback()
        return res.status(404).json({
          success: false,
          message: `Producto #${productId} no encontrado`,
        })
      }
      if (!products[0].active) {
        await connection.rollback()
        return res.status(400).json({
          success: false,
          message: `El producto "${products[0].name}" está desactivado y no se puede controlar`,
        })
      }

      const systemStock = Number(products[0].stock)
      const difference = counted - systemStock
      const result = resultFromDiff(difference)

      normalized.push({
        product_id: productId,
        product_name: products[0].name,
        product_code: products[0].code,
        unit: products[0].unit || "unidad",
        system_stock: systemStock,
        counted_stock: counted,
        difference,
        result,
      })
    }

    if (normalized.length === 0) {
      await connection.rollback()
      return res.status(400).json({
        success: false,
        message: "Debés controlar al menos un producto válido",
      })
    }

    await connection.query("DELETE FROM stock_control_items WHERE stock_control_id = ?", [controlId])

    let okCount = 0
    let shortageCount = 0
    let surplusCount = 0

    for (const item of normalized) {
      if (item.result === "ok") okCount += 1
      else if (item.result === "faltante") shortageCount += 1
      else surplusCount += 1

      await connection.query(
        `INSERT INTO stock_control_items
          (stock_control_id, product_id, product_name, product_code, unit, system_stock, counted_stock, difference, result)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          controlId,
          item.product_id,
          item.product_name,
          item.product_code,
          item.unit,
          item.system_stock,
          item.counted_stock,
          item.difference,
          item.result,
        ],
      )
    }

    await connection.query(
      `UPDATE stock_controls
       SET status = 'completed',
           performed_by = ?,
           skipped_by = NULL,
           skipped_at = NULL,
           notes = ?,
           products_count = ?,
           ok_count = ?,
           shortage_count = ?,
           surplus_count = ?,
           completed_at = NOW(),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        userId,
        notes?.trim() || null,
        normalized.length,
        okCount,
        shortageCount,
        surplusCount,
        controlId,
      ],
    )

    await connection.commit()

    const control = mapControlRow(await fetchControlById(controlId))
    const savedItems = await fetchItems(controlId, null)

    res.json({
      success: true,
      message: "Control de stock guardado correctamente",
      data: { ...control, items: savedItems },
    })
  } catch (error) {
    await connection.rollback()
    console.error("Error al guardar control de stock:", error)
    res.status(500).json({
      success: false,
      message: "Error al guardar control de stock",
    })
  } finally {
    connection.release()
  }
}

export const skipCurrentStockControl = async (req, res) => {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const userId = req.user.id
    const notes = req.body?.notes?.trim() || null

    const [sessions] = await connection.query(
      `SELECT id FROM cash_sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1`,
    )
    if (sessions.length === 0) {
      await connection.rollback()
      return res.status(400).json({
        success: false,
        message: "No hay una sesión de caja abierta",
      })
    }

    const sessionId = sessions[0].id
    const controlId = await ensureControlForSession(connection, sessionId)

    const [controls] = await connection.query("SELECT status FROM stock_controls WHERE id = ? FOR UPDATE", [
      controlId,
    ])
    if (controls[0]?.status === "completed") {
      await connection.rollback()
      return res.status(400).json({
        success: false,
        message: "El control de stock ya fue realizado. No se puede marcar como omitido.",
      })
    }

    await connection.query(
      `UPDATE stock_controls
       SET status = 'skipped',
           skipped_by = ?,
           skipped_at = NOW(),
           notes = COALESCE(?, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [userId, notes, controlId],
    )

    await connection.commit()

    const control = mapControlRow(await fetchControlById(controlId))
    res.json({
      success: true,
      message: "Quedó asentado que no se realizó el control de stock en este turno",
      data: control,
    })
  } catch (error) {
    await connection.rollback()
    console.error("Error al omitir control de stock:", error)
    res.status(500).json({
      success: false,
      message: "Error al omitir control de stock",
    })
  } finally {
    connection.release()
  }
}

export const getStockControls = async (req, res) => {
  try {
    const { status, search, page: pageRaw, limit: limitRaw } = req.query
    const page = Math.max(1, Number.parseInt(pageRaw, 10) || 1)
    const limit = Math.min(100, Math.max(1, Number.parseInt(limitRaw, 10) || 20))
    const offset = (page - 1) * limit

    let where = " WHERE 1=1"
    const params = []

    if (status && ["pending", "completed", "skipped"].includes(String(status))) {
      where += " AND sc.status = ?"
      params.push(status)
    }
    if (search && String(search).trim()) {
      where += " AND (u.name LIKE ? OR up.name LIKE ? OR CAST(sc.cash_session_id AS CHAR) LIKE ?)"
      const term = `%${String(search).trim()}%`
      params.push(term, term, term)
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM stock_controls sc
       JOIN cash_sessions cs ON cs.id = sc.cash_session_id
       JOIN users u ON u.id = cs.user_id
       LEFT JOIN users up ON up.id = sc.performed_by
       ${where}`,
      params,
    )
    const total = Number(countRows[0]?.total) || 0

    const [rows] = await pool.query(
      `SELECT sc.*,
              up.name AS performed_by_name,
              usk.name AS skipped_by_name,
              cs.opened_at AS session_opened_at,
              cs.closed_at AS session_closed_at,
              cs.status AS session_status,
              u.name AS session_user_name
       FROM stock_controls sc
       JOIN cash_sessions cs ON cs.id = sc.cash_session_id
       JOIN users u ON u.id = cs.user_id
       LEFT JOIN users up ON up.id = sc.performed_by
       LEFT JOIN users usk ON usk.id = sc.skipped_by
       ${where}
       ORDER BY COALESCE(sc.completed_at, sc.skipped_at, sc.created_at) DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    )

    res.json({
      success: true,
      data: rows.map(mapControlRow),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    })
  } catch (error) {
    console.error("Error al listar controles de stock:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener historial de controles",
    })
  }
}

export const getStockControlById = async (req, res) => {
  try {
    const { id } = req.params
    const { result } = req.query
    const row = await fetchControlById(id)
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Control de stock no encontrado",
      })
    }

    const control = mapControlRow(row)
    const items = await fetchItems(control.id, result || null)

    res.json({
      success: true,
      data: { ...control, items },
    })
  } catch (error) {
    console.error("Error al obtener control de stock:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener control de stock",
    })
  }
}

export const getStockControlBySession = async (req, res) => {
  try {
    const { cashSessionId } = req.params
    const [rows] = await pool.query(
      `SELECT sc.*,
              up.name AS performed_by_name,
              usk.name AS skipped_by_name,
              cs.opened_at AS session_opened_at,
              cs.closed_at AS session_closed_at,
              cs.status AS session_status,
              u.name AS session_user_name
       FROM stock_controls sc
       JOIN cash_sessions cs ON cs.id = sc.cash_session_id
       JOIN users u ON u.id = cs.user_id
       LEFT JOIN users up ON up.id = sc.performed_by
       LEFT JOIN users usk ON usk.id = sc.skipped_by
       WHERE sc.cash_session_id = ?
       LIMIT 1`,
      [cashSessionId],
    )

    if (rows.length === 0) {
      return res.json({
        success: true,
        data: null,
      })
    }

    const control = mapControlRow(rows[0])
    const items = control.status === "completed" ? await fetchItems(control.id, null) : []

    res.json({
      success: true,
      data: { ...control, items },
    })
  } catch (error) {
    console.error("Error al obtener control por sesión:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener control de stock de la sesión",
    })
  }
}
