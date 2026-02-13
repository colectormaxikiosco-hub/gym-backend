import pool from "../config/database.js"

export const getAllSales = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10))
    const offset = (page - 1) * limit
    const dateFrom = (req.query.date_from || "").trim()
    const dateTo = (req.query.date_to || "").trim()
    const paymentMethod = (req.query.payment_method || "").trim()
    const status = (req.query.status || "").trim()

    const whereParts = []
    const params = []
    if (dateFrom) {
      whereParts.push(" AND DATE(s.created_at) >= ?")
      params.push(dateFrom)
    }
    if (dateTo) {
      whereParts.push(" AND DATE(s.created_at) <= ?")
      params.push(dateTo)
    }
    if (paymentMethod && ["cash", "transfer", "credit_card", "current_account"].includes(paymentMethod)) {
      whereParts.push(" AND s.payment_method = ?")
      params.push(paymentMethod)
    }
    if (status && ["completed", "cancelled"].includes(status)) {
      whereParts.push(" AND s.status = ?")
      params.push(status)
    }
    const whereClause = whereParts.join("")

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM sales s WHERE 1=1 ${whereClause}`,
      params
    )
    const total = countResult[0]?.total ?? 0

    const sql = `
      SELECT s.*, u.name as user_name, c.name as client_name
      FROM sales s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN clients c ON c.id = s.client_id
      WHERE 1=1 ${whereClause}
      ORDER BY s.created_at DESC LIMIT ? OFFSET ?
    `
    const [rows] = await pool.query(sql, [...params, limit, offset])

    const totalPages = Math.ceil(total / limit) || 1
    res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total, totalPages },
    })
  } catch (error) {
    console.error("Error al obtener ventas:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener ventas",
    })
  }
}

export const getSaleById = async (req, res) => {
  try {
    const { id } = req.params
    const [sales] = await pool.query(
      `SELECT s.*, u.name as user_name, c.name as client_name
       FROM sales s
       LEFT JOIN users u ON u.id = s.user_id
       LEFT JOIN clients c ON c.id = s.client_id
       WHERE s.id = ?`,
      [id]
    )
    if (sales.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Venta no encontrada",
      })
    }
    const [items] = await pool.query(
      "SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id",
      [id]
    )
    const sale = { ...sales[0], items }
    res.json({
      success: true,
      data: sale,
    })
  } catch (error) {
    console.error("Error al obtener venta:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener venta",
    })
  }
}

export const createSale = async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const { items, payment_method, discount = 0, client_id = null, notes = null } = req.body
    const userId = req.user.id

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "La venta debe tener al menos un producto",
      })
    }
    if (!payment_method || !["cash", "transfer", "credit_card", "current_account"].includes(payment_method)) {
      return res.status(400).json({
        success: false,
        message: "Método de pago inválido",
      })
    }
    if (payment_method === "current_account") {
      if (!client_id) {
        return res.status(400).json({
          success: false,
          message: "Para venta a cuenta corriente debe indicar el cliente",
        })
      }
      const [clientRow] = await connection.query(
        "SELECT id FROM clients WHERE id = ? AND active = 1",
        [client_id]
      )
      if (clientRow.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Cliente no encontrado o inactivo",
        })
      }
    }

    await connection.beginTransaction()

    const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))]
    if (productIds.length === 0) {
      await connection.rollback()
      return res.status(400).json({
        success: false,
        message: "Items inválidos",
      })
    }

    const placeholders = productIds.map(() => "?").join(",")
    const [products] = await connection.query(
      `SELECT id, name, code, sale_price, stock, unit FROM products WHERE id IN (${placeholders}) AND active = 1`,
      productIds
    )
    const productMap = {}
    products.forEach((p) => {
      productMap[p.id] = p
    })

    let subtotal = 0
    const saleItemsToInsert = []
    const stockUpdates = []

    for (const item of items) {
      const productId = item.product_id
      const qty = Number(item.quantity)
      if (!productId || isNaN(qty) || qty <= 0) continue
      const product = productMap[productId]
      if (!product) {
        await connection.rollback()
        return res.status(400).json({
          success: false,
          message: `Producto no encontrado o inactivo: ID ${productId}`,
        })
      }
      const available = Number(product.stock)
      if (available < qty) {
        await connection.rollback()
        return res.status(400).json({
          success: false,
          message: `Stock insuficiente para "${product.name}". Disponible: ${available} ${product.unit}`,
        })
      }
      const unitPrice = Number(product.sale_price)
      const lineSubtotal = Math.round(unitPrice * qty * 100) / 100
      subtotal += lineSubtotal
      saleItemsToInsert.push({
        product_id: productId,
        product_name: product.name,
        product_code: product.code,
        quantity: qty,
        unit: product.unit,
        unit_price: unitPrice,
        subtotal: lineSubtotal,
      })
      stockUpdates.push({ product_id: productId, qty, product })
    }

    const discountAmount = Math.max(0, Number(discount) || 0)
    const total = Math.round((subtotal - discountAmount) * 100) / 100

    let cashSessionId = null
    const [activeSession] = await connection.query(
      "SELECT id FROM cash_sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1"
    )
    if (activeSession.length > 0) cashSessionId = activeSession[0].id

    const [saleResult] = await connection.query(
      `INSERT INTO sales (user_id, client_id, cash_session_id, payment_method, subtotal, discount, total, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?)`,
      [userId, client_id || null, cashSessionId, payment_method, subtotal, discountAmount, total, notes?.trim() || null]
    )
    const saleId = saleResult.insertId

    for (const it of saleItemsToInsert) {
      await connection.query(
        `INSERT INTO sale_items (sale_id, product_id, product_name, product_code, quantity, unit, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [saleId, it.product_id, it.product_name, it.product_code, it.quantity, it.unit, it.unit_price, it.subtotal]
      )
    }

    for (const { product_id, qty, product } of stockUpdates) {
      const delta = -qty
      await connection.query(
        "INSERT INTO stock_movements (product_id, type, quantity, notes, created_by) VALUES (?, 'salida', ?, ?, ?)",
        [product_id, delta, `Venta #${saleId}`, userId]
      )
      const newStock = Number(product.stock) - qty
      await connection.query("UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
        newStock,
        product_id,
      ])
    }

    let cashMovementId = null
    if (["cash", "transfer", "credit_card"].includes(payment_method) && cashSessionId && total > 0) {
      const [movResult] = await connection.query(
        `INSERT INTO cash_movements (cash_session_id, type, payment_method, amount, description, created_by)
         VALUES (?, 'sale', ?, ?, ?, ?)`,
        [cashSessionId, payment_method, total, `Venta #${saleId}`, userId]
      )
      cashMovementId = movResult.insertId
      await connection.query("UPDATE sales SET cash_movement_id = ? WHERE id = ?", [cashMovementId, saleId])
    }

    if (payment_method === "current_account" && client_id && total > 0) {
      const [lastMovement] = await connection.query(
        `SELECT balance FROM current_account WHERE client_id = ? ORDER BY created_at DESC LIMIT 1`,
        [client_id]
      )
      const currentBalance = lastMovement.length > 0 ? Number(lastMovement[0].balance) : 0
      const newBalance = Math.round((currentBalance + total) * 100) / 100
      await connection.query(
        `INSERT INTO current_account (client_id, type, amount, description, balance, created_by)
         VALUES (?, 'debit', ?, ?, ?, ?)`,
        [client_id, total, `Venta #${saleId}`, newBalance, userId]
      )
    }

    await connection.commit()

    const [newSale] = await connection.query(
      `SELECT s.*, u.name as user_name FROM sales s LEFT JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
      [saleId]
    )
    const [newItems] = await connection.query("SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id", [saleId])
    const saleData = { ...newSale[0], items: newItems }

    res.status(201).json({
      success: true,
      message: "Venta registrada correctamente",
      data: saleData,
    })
  } catch (error) {
    await connection.rollback()
    console.error("Error al crear venta:", error)
    res.status(500).json({
      success: false,
      message: error.message || "Error al registrar la venta",
    })
  } finally {
    connection.release()
  }
}

/**
 * Cancelar una venta. Solo permitido si la venta pertenece a la sesión de caja actual (abierta).
 * Revierte: stock de productos, movimiento en caja (si aplica), cuenta corriente (si aplica).
 */
export const cancelSale = async (req, res) => {
  const connection = await pool.getConnection()

  try {
    const { id } = req.params
    const userId = req.user.id

    await connection.beginTransaction()

    const [sales] = await connection.query(
      `SELECT s.id, s.cash_session_id, s.cash_movement_id, s.payment_method, s.total, s.status, s.client_id
       FROM sales s WHERE s.id = ?`,
      [id]
    )

    if (sales.length === 0) {
      await connection.rollback()
      connection.release()
      return res.status(404).json({
        success: false,
        message: "Venta no encontrada",
      })
    }

    const sale = sales[0]
    if (sale.status === "cancelled") {
      await connection.rollback()
      connection.release()
      return res.status(400).json({
        success: false,
        message: "La venta ya está cancelada.",
      })
    }

    const [openSessions] = await connection.query(
      "SELECT id FROM cash_sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1"
    )

    if (openSessions.length === 0) {
      await connection.rollback()
      connection.release()
      return res.status(400).json({
        success: false,
        message: "No hay sesión de caja abierta. No se puede cancelar ventas.",
      })
    }

    const currentSessionId = openSessions[0].id
    if (sale.cash_session_id !== currentSessionId) {
      await connection.rollback()
      connection.release()
      return res.status(400).json({
        success: false,
        message:
          "Solo se pueden cancelar ventas de la sesión de caja actual. Esta venta corresponde a una sesión ya cerrada.",
      })
    }

    const [items] = await connection.query(
      "SELECT product_id, quantity FROM sale_items WHERE sale_id = ?",
      [id]
    )

    for (const item of items) {
      const qty = Number(item.quantity)
      await connection.query(
        "INSERT INTO stock_movements (product_id, type, quantity, notes, created_by) VALUES (?, 'entrada', ?, ?, ?)",
        [item.product_id, qty, `Cancelación venta #${id}`, userId]
      )
      await connection.query(
        "UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [qty, item.product_id]
      )
    }

    if (sale.cash_movement_id) {
      const [movements] = await connection.query(
        "SELECT amount, payment_method FROM cash_movements WHERE id = ?",
        [sale.cash_movement_id]
      )
      if (movements.length > 0) {
        const amount = Number(movements[0].amount)
        const paymentMethod = movements[0].payment_method || "cash"
        await connection.query(
          `INSERT INTO cash_movements (cash_session_id, type, payment_method, amount, description, created_by)
           VALUES (?, 'expense', ?, ?, ?, ?)`,
          [
            currentSessionId,
            paymentMethod,
            amount,
            `Cancelación venta #${id}`,
            userId,
          ]
        )
      }
    }

    if (sale.payment_method === "current_account" && sale.client_id && sale.total > 0) {
      const [lastMovement] = await connection.query(
        `SELECT balance FROM current_account WHERE client_id = ? ORDER BY created_at DESC LIMIT 1`,
        [sale.client_id]
      )
      const currentBalance = lastMovement.length > 0 ? Number(lastMovement[0].balance) : 0
      const newBalance = Math.round((currentBalance - Number(sale.total)) * 100) / 100
      await connection.query(
        `INSERT INTO current_account (client_id, type, amount, description, balance, created_by)
         VALUES (?, 'credit', ?, ?, ?, ?)`,
        [sale.client_id, Number(sale.total), `Cancelación venta #${id}`, newBalance, userId]
      )
    }

    await connection.query("UPDATE sales SET status = 'cancelled' WHERE id = ?", [id])

    await connection.commit()
    connection.release()

    res.json({
      success: true,
      message: "Venta cancelada correctamente. Se revirtió stock y se descontó el monto de la caja.",
      data: { id: Number(id) },
    })
  } catch (error) {
    await connection.rollback()
    connection.release()
    console.error("Error al cancelar venta:", error)
    res.status(500).json({
      success: false,
      message: error.message || "Error al cancelar la venta",
    })
  }
}
