import pool from "../config/database.js"

/**
 * Reportes de membresías: planes más usados, instructores con más membresías,
 * clientes con más entradas. Filtros: dateFrom, dateTo, plan_id, instructor_id.
 */
export const getMembershipReports = async (req, res) => {
  try {
    const dateFrom = req.query.dateFrom || null
    const dateTo = req.query.dateTo || null
    const planId = req.query.plan_id || null
    const instructorId = req.query.instructor_id || null

    const conditions = []
    const params = []

    if (dateFrom) {
      conditions.push("m.created_at >= ?")
      params.push(dateFrom)
    }
    if (dateTo) {
      conditions.push("m.created_at <= ?")
      params.push(dateTo + " 23:59:59")
    }
    if (planId) {
      conditions.push("m.plan_id = ?")
      params.push(planId)
    }
    if (instructorId) {
      conditions.push("m.instructor_id = ?")
      params.push(instructorId)
    }

    const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : ""

    // Planes más contratados (por cantidad de membresías en el período)
    const [byPlan] = await pool.query(
      `SELECT p.id as plan_id, p.name as plan_name, COUNT(m.id) as count
       FROM memberships m
       INNER JOIN plans p ON p.id = m.plan_id
       ${whereClause}
       GROUP BY p.id, p.name
       ORDER BY count DESC`,
      params,
    )

    // Instructores con más membresías (en el período)
    const [byInstructor] = await pool.query(
      `SELECT i.id as instructor_id, i.name as instructor_name, COUNT(m.id) as count
       FROM memberships m
       INNER JOIN instructors i ON i.id = m.instructor_id
       ${whereClause}
       GROUP BY i.id, i.name
       ORDER BY count DESC`,
      params,
    )

    // Instructores con más membresías incluyendo NULL (sin instructor asignado)
    const [byInstructorWithNull] = await pool.query(
      `SELECT m.instructor_id as instructor_id,
              COALESCE(i.name, 'Sin asignar') as instructor_name,
              COUNT(m.id) as count
       FROM memberships m
       LEFT JOIN instructors i ON i.id = m.instructor_id
       ${whereClause}
       GROUP BY m.instructor_id, COALESCE(i.name, 'Sin asignar')
       ORDER BY count DESC`,
      params,
    )

    const entryConditions = []
    const entryParams = []
    if (dateFrom) {
      entryConditions.push("ce.entered_at >= ?")
      entryParams.push(dateFrom)
    }
    if (dateTo) {
      entryConditions.push("ce.entered_at <= ?")
      entryParams.push(dateTo + " 23:59:59")
    }
    const entryWhere = entryConditions.length > 0 ? "WHERE " + entryConditions.join(" AND ") : ""

    // Clientes con más entradas (en el período)
    const [byClientEntries] = await pool.query(
      `SELECT c.id as client_id, c.name as client_name, COUNT(ce.id) as entries_count
       FROM client_entries ce
       INNER JOIN clients c ON c.id = ce.client_id
       ${entryWhere}
       GROUP BY c.id, c.name
       ORDER BY entries_count DESC
       LIMIT 100`,
      entryParams,
    )

    // Resumen: total membresías en el período (con filtros)
    const [countMemberships] = await pool.query(
      `SELECT COUNT(*) as total FROM memberships m ${whereClause}`,
      params,
    )
    const totalMembershipsInPeriod = Number(countMemberships[0]?.total) || 0

    // Membresías activas totales (sin filtro de fechas)
    const [countActive] = await pool.query(
      "SELECT COUNT(*) as total FROM memberships WHERE status = 'active' AND start_date <= CURDATE() AND end_date >= CURDATE()",
    )
    const activeMembershipsTotal = Number(countActive[0]?.total) || 0

    // Total entradas en el período
    const [countEntries] = await pool.query(
      `SELECT COUNT(*) as total FROM client_entries ce ${entryWhere}`,
      entryParams,
    )
    const totalEntriesInPeriod = Number(countEntries[0]?.total) || 0

    // Datos para gráficos: membresías creadas por mes (últimos 12 meses)
    const [membershipsPerMonth] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
       FROM memberships
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month ASC`,
    )

    // Entradas por mes (últimos 12 meses)
    const [entriesPerMonth] = await pool.query(
      `SELECT DATE_FORMAT(entered_at, '%Y-%m') as month, COUNT(*) as count
       FROM client_entries
       WHERE entered_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY DATE_FORMAT(entered_at, '%Y-%m')
       ORDER BY month ASC`,
    )

    // Membresías por estado en el período (para gráfico/desglose)
    const [byStatus] = await pool.query(
      `SELECT status, COUNT(*) as count
       FROM memberships m
       ${whereClause}
       GROUP BY status
       ORDER BY count DESC`,
      params,
    )

    const clientsWithEntries = byClientEntries.length
    const avgEntriesPerClient =
      clientsWithEntries > 0 && totalEntriesInPeriod > 0
        ? Number((totalEntriesInPeriod / clientsWithEntries).toFixed(1))
        : 0

    res.json({
      success: true,
      message: "Reportes obtenidos",
      data: {
        by_plan: byPlan,
        by_instructor: byInstructorWithNull,
        by_client_entries: byClientEntries,
        by_status: byStatus,
        summary: {
          total_memberships_in_period: totalMembershipsInPeriod,
          active_memberships_total: activeMembershipsTotal,
          total_entries_in_period: totalEntriesInPeriod,
          avg_entries_per_client: avgEntriesPerClient,
        },
        chart_memberships_per_month: membershipsPerMonth,
        chart_entries_per_month: entriesPerMonth,
      },
    })
  } catch (error) {
    console.error("[reports] Error getMembershipReports:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener reportes",
      error: error.message,
    })
  }
}

/**
 * Reportes de ventas: productos más vendidos, por método de pago, por cliente,
 * ingresos y cantidad de ventas. Filtros: dateFrom, dateTo, payment_method, status.
 */
export const getSalesReports = async (req, res) => {
  try {
    const dateFrom = req.query.dateFrom || null
    const dateTo = req.query.dateTo || null
    const paymentMethod = req.query.payment_method || null
    const statusFilter = req.query.status || "completed"

    const conditions = []
    const params = []
    if (statusFilter) {
      conditions.push("s.status = ?")
      params.push(statusFilter)
    }

    if (dateFrom) {
      conditions.push("s.created_at >= ?")
      params.push(dateFrom)
    }
    if (dateTo) {
      conditions.push("s.created_at <= ?")
      params.push(dateTo + " 23:59:59")
    }
    if (paymentMethod) {
      conditions.push("s.payment_method = ?")
      params.push(paymentMethod)
    }

    const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : ""

    // Productos más vendidos (cantidad y monto)
    const [byProduct] = await pool.query(
      `SELECT si.product_id, si.product_name, si.product_code,
              SUM(si.quantity) as total_quantity,
              SUM(si.subtotal) as total_revenue,
              COUNT(DISTINCT s.id) as sales_count
       FROM sale_items si
       INNER JOIN sales s ON s.id = si.sale_id
       ${whereClause}
       GROUP BY si.product_id, si.product_name, si.product_code
       ORDER BY total_quantity DESC
       LIMIT 100`,
      params,
    )

    // Ventas por método de pago
    const [byPaymentMethod] = await pool.query(
      `SELECT s.payment_method, COUNT(s.id) as count, COALESCE(SUM(s.total), 0) as total_revenue
       FROM sales s
       ${whereClause}
       GROUP BY s.payment_method
       ORDER BY total_revenue DESC`,
      params,
    )

    // Clientes con más compras (por monto total)
    const clientWhere = whereClause ? whereClause + " AND s.client_id IS NOT NULL" : "WHERE s.client_id IS NOT NULL"
    const [byClient] = await pool.query(
      `SELECT c.id as client_id, c.name as client_name,
              COUNT(s.id) as sales_count,
              COALESCE(SUM(s.total), 0) as total_revenue
       FROM sales s
       INNER JOIN clients c ON c.id = s.client_id
       ${clientWhere}
       GROUP BY c.id, c.name
       ORDER BY total_revenue DESC
       LIMIT 100`,
      params,
    )

    // Resumen
    const [summaryRows] = await pool.query(
      `SELECT
         COUNT(*) as total_sales,
         COALESCE(SUM(total), 0) as total_revenue,
         COALESCE(SUM(discount), 0) as total_discount
       FROM sales s
       ${whereClause}`,
      params,
    )
    const summary = summaryRows[0] || {}
    const totalSales = Number(summary.total_sales) || 0
    const totalRevenue = Number(summary.total_revenue) || 0
    const totalDiscount = Number(summary.total_discount) || 0

    // Por estado (completed vs cancelled) en el período con mismas fechas
    const statusConditions = []
    const statusParams = []
    if (dateFrom) {
      statusConditions.push("created_at >= ?")
      statusParams.push(dateFrom)
    }
    if (dateTo) {
      statusConditions.push("created_at <= ?")
      statusParams.push(dateTo + " 23:59:59")
    }
    const statusWhere =
      statusConditions.length > 0 ? "WHERE " + statusConditions.join(" AND ") : ""
    const [byStatus] = await pool.query(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(total), 0) as total_revenue
       FROM sales
       ${statusWhere}
       GROUP BY status
       ORDER BY count DESC`,
      statusParams,
    )

    // Gráficos: ventas e ingresos por mes (últimos 12 meses)
    const [salesPerMonth] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') as month,
              COUNT(*) as count,
              COALESCE(SUM(total), 0) as revenue
       FROM sales
       WHERE status = 'completed' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month ASC`,
    )

    res.json({
      success: true,
      message: "Reportes de ventas obtenidos",
      data: {
        by_product: byProduct,
        by_payment_method: byPaymentMethod,
        by_client: byClient,
        by_status: byStatus,
        summary: {
          total_sales: totalSales,
          total_revenue: totalRevenue,
          total_discount: totalDiscount,
        },
        chart_sales_per_month: salesPerMonth,
      },
    })
  } catch (error) {
    console.error("[reports] Error getSalesReports:", error)
    res.status(500).json({
      success: false,
      message: "Error al obtener reportes de ventas",
      error: error.message,
    })
  }
}
