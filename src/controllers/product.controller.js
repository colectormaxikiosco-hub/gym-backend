import pool from "../config/database.js"

export const getAllProducts = async (req, res) => {
  try {
    const { search, category } = req.query
    let sql = "SELECT * FROM products WHERE active = TRUE"
    const params = []

    if (search && search.trim()) {
      sql += " AND (name LIKE ? OR code LIKE ? OR description LIKE ?)"
      const term = `%${search.trim()}%`
      params.push(term, term, term)
    }
    if (category && category.trim()) {
      sql += " AND category = ?"
      params.push(category.trim())
    }

    sql += " ORDER BY name ASC"
    const [rows] = await pool.query(sql, params)
    res.json({
      success: true,
      message: "Productos obtenidos correctamente",
      data: rows,
    })
  } catch (error) {
    console.error("Error al obtener productos:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener productos",
    })
  }
}

/**
 * Alertas de stock: productos sin stock, bajo mínimo o cerca del mínimo.
 * Query: type = 'out' | 'low' | 'near' | 'all' (opcional), search, category.
 */
export const getProductAlerts = async (req, res) => {
  try {
    const { search, category, type: alertType } = req.query
    let sql = "SELECT * FROM products WHERE active = TRUE"
    const params = []

    if (search && search.trim()) {
      sql += " AND (name LIKE ? OR code LIKE ? OR description LIKE ?)"
      const term = `%${search.trim()}%`
      params.push(term, term, term)
    }
    if (category && category.trim()) {
      sql += " AND category = ?"
      params.push(category.trim())
    }

    sql += " ORDER BY name ASC"
    const [rows] = await pool.query(sql, params)

    const outOfStock = []
    const lowStock = []
    const nearMin = []

    const NEAR_FACTOR = 1.2 // "cerca del mínimo" = stock entre min_stock y min_stock * 1.2

    for (const p of rows) {
      const stock = Number(p.stock)
      const minStock = Number(p.min_stock) || 0

      if (stock <= 0) {
        outOfStock.push({ ...p, alert_type: "out" })
      } else if (minStock > 0 && stock < minStock) {
        lowStock.push({ ...p, alert_type: "low" })
      } else if (minStock > 0 && stock >= minStock && stock < minStock * NEAR_FACTOR) {
        nearMin.push({ ...p, alert_type: "near" })
      }
    }

    const only = alertType && ["out", "low", "near"].includes(String(alertType).toLowerCase())
    if (only) {
      const map = { out: outOfStock, low: lowStock, near: nearMin }
      return res.json({
        success: true,
        data: map[alertType] || [],
        counts: { out: outOfStock.length, low: lowStock.length, near: nearMin.length },
      })
    }

    res.json({
      success: true,
      data: {
        outOfStock,
        lowStock,
        nearMin,
      },
      counts: {
        out: outOfStock.length,
        low: lowStock.length,
        near: nearMin.length,
      },
    })
  } catch (error) {
    console.error("Error al obtener alertas de productos:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener alertas de stock",
    })
  }
}

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params
    const [rows] = await pool.query("SELECT * FROM products WHERE id = ?", [id])
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Producto no encontrado",
      })
    }
    res.json({
      success: true,
      data: rows[0],
    })
  } catch (error) {
    console.error("Error al obtener producto:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener producto",
    })
  }
}

export const createProduct = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      category,
      sale_price,
      cost_price,
      stock_inicial,
      min_stock,
      unit,
    } = req.body

    const stock = Number(stock_inicial) >= 0 ? Number(stock_inicial) : 0
    const minStock = Number(min_stock) >= 0 ? Number(min_stock) : 0
    const salePrice = Number(sale_price) >= 0 ? Number(sale_price) : 0
    const costPrice = Number(cost_price) >= 0 ? Number(cost_price) : 0

    const [result] = await pool.query(
      `INSERT INTO products (name, code, description, category, sale_price, cost_price, stock, min_stock, unit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name?.trim() || "",
        code?.trim().toUpperCase() || "",
        description?.trim() || null,
        category?.trim() || null,
        salePrice,
        costPrice,
        stock,
        minStock,
        unit === "kg" ? "kg" : "unidad",
      ]
    )
    const productId = result.insertId
    const [newProduct] = await pool.query("SELECT * FROM products WHERE id = ?", [productId])

    if (stock > 0) {
      await pool.query(
        "INSERT INTO stock_movements (product_id, type, quantity, notes, created_by) VALUES (?, 'entrada', ?, ?, ?)",
        [productId, stock, "Stock inicial", req.user.id]
      )
    }

    res.status(201).json({
      success: true,
      message: "Producto creado correctamente",
      data: newProduct[0],
    })
  } catch (error) {
    console.error("Error al crear producto:", error)
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        success: false,
        message: "Ya existe un producto con ese código",
      })
    }
    res.status(500).json({
      success: false,
      message: "Error al crear producto",
    })
  }
}

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params
    const {
      name,
      code,
      description,
      category,
      sale_price,
      cost_price,
      min_stock,
      unit,
    } = req.body
    // No permitimos actualizar stock desde aquí; solo con movimientos

    const minStock = Number(min_stock) >= 0 ? Number(min_stock) : 0
    const salePrice = Number(sale_price) >= 0 ? Number(sale_price) : 0
    const costPrice = Number(cost_price) >= 0 ? Number(cost_price) : 0

    const [result] = await pool.query(
      `UPDATE products SET name = ?, code = ?, description = ?, category = ?, sale_price = ?, cost_price = ?, min_stock = ?, unit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [
        name?.trim() || "",
        code?.trim().toUpperCase() || "",
        description?.trim() || null,
        category?.trim() || null,
        salePrice,
        costPrice,
        minStock,
        unit === "kg" ? "kg" : "unidad",
        id,
      ]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Producto no encontrado",
      })
    }
    const [updated] = await pool.query("SELECT * FROM products WHERE id = ?", [id])
    res.json({
      success: true,
      message: "Producto actualizado correctamente",
      data: updated[0],
    })
  } catch (error) {
    console.error("Error al actualizar producto:", error)
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        success: false,
        message: "Ya existe otro producto con ese código",
      })
    }
    res.status(500).json({
      success: false,
      message: "Error al actualizar producto",
    })
  }
}

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params

    const [product] = await pool.query("SELECT id FROM products WHERE id = ?", [id])
    if (product.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Producto no encontrado",
      })
    }

    const [sales] = await pool.query(
      "SELECT id FROM sale_items WHERE product_id = ? LIMIT 1",
      [id]
    )
    if (sales.length > 0) {
      return res.status(400).json({
        success: false,
        message: "No se puede eliminar el producto porque tiene ventas asociadas. Solo se pueden eliminar productos sin ventas.",
      })
    }

    // Borrar primero los movimientos de stock para evitar error de FK (RESTRICT)
    await pool.query("DELETE FROM stock_movements WHERE product_id = ?", [id])
    await pool.query("DELETE FROM products WHERE id = ?", [id])
    res.json({
      success: true,
      message: "Producto eliminado correctamente",
    })
  } catch (error) {
    console.error("Error al eliminar producto:", error)
    res.status(500).json({
      success: false,
      message: "Error al eliminar producto",
    })
  }
}

export const getMovementsByProductId = async (req, res) => {
  try {
    const { productId } = req.params
    const [rows] = await pool.query(
      `SELECT sm.*, u.name as created_by_name
       FROM stock_movements sm
       LEFT JOIN users u ON u.id = sm.created_by
       WHERE sm.product_id = ?
       ORDER BY sm.created_at DESC`,
      [productId]
    )
    res.json({
      success: true,
      data: rows,
    })
  } catch (error) {
    console.error("Error al obtener movimientos del producto:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener movimientos",
    })
  }
}

export const getAllMovements = async (req, res) => {
  try {
    const { search, type, product_id } = req.query
    let sql = `
      SELECT sm.*, p.name as product_name, p.code as product_code, p.unit as product_unit, u.name as created_by_name
      FROM stock_movements sm
      INNER JOIN products p ON p.id = sm.product_id
      LEFT JOIN users u ON u.id = sm.created_by
      WHERE p.active = TRUE
    `
    const params = []

    if (search && search.trim()) {
      sql += " AND (p.name LIKE ? OR p.code LIKE ?)"
      const term = `%${search.trim()}%`
      params.push(term, term)
    }
    if (type && ["entrada", "salida", "ajuste"].includes(type)) {
      sql += " AND sm.type = ?"
      params.push(type)
    }
    if (product_id && product_id.trim()) {
      sql += " AND sm.product_id = ?"
      params.push(product_id.trim())
    }

    sql += " ORDER BY sm.created_at DESC"
    const [rows] = await pool.query(sql, params)
    res.json({
      success: true,
      data: rows,
    })
  } catch (error) {
    console.error("Error al obtener movimientos:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener movimientos",
    })
  }
}

export const createStockMovement = async (req, res) => {
  try {
    const { product_id, type, quantity, notes } = req.body
    const userId = req.user.id

    const [products] = await pool.query("SELECT id, stock FROM products WHERE id = ? AND active = TRUE", [product_id])
    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Producto no encontrado",
      })
    }

    const currentStock = Number(products[0].stock)
    let delta = Number(quantity)
    if (isNaN(delta) || delta === 0) {
      return res.status(400).json({
        success: false,
        message: "La cantidad debe ser distinta de cero",
      })
    }

    if (type === "entrada") {
      if (delta < 0) delta = -delta
    } else if (type === "salida") {
      if (delta > 0) delta = -delta
      if (currentStock + delta < 0) {
        return res.status(400).json({
          success: false,
          message: "Stock insuficiente. No se puede registrar esta salida.",
        })
      }
    } else if (type === "ajuste") {
      // ajuste: delta puede ser + o -; el usuario indica la diferencia
      if (currentStock + delta < 0) {
        return res.status(400).json({
          success: false,
          message: "El stock resultante no puede ser negativo",
        })
      }
    }

    await pool.query(
      "INSERT INTO stock_movements (product_id, type, quantity, notes, created_by) VALUES (?, ?, ?, ?, ?)",
      [product_id, type, delta, notes?.trim() || null, userId]
    )
    const newStock = currentStock + delta
    await pool.query("UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
      newStock,
      product_id,
    ])

    const [movement] = await pool.query(
      `SELECT sm.*, u.name as created_by_name FROM stock_movements sm LEFT JOIN users u ON u.id = sm.created_by WHERE sm.product_id = ? ORDER BY sm.id DESC LIMIT 1`,
      [product_id]
    )

    res.status(201).json({
      success: true,
      message: "Movimiento registrado correctamente",
      data: { ...movement[0], new_stock: newStock },
    })
  } catch (error) {
    console.error("Error al crear movimiento:", error)
    res.status(500).json({
      success: false,
      message: "Error al registrar movimiento",
    })
  }
}
