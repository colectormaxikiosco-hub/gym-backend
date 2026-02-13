import { validationResult } from "express-validator"

export const validate = (req, res, next) => {
  const errors = validationResult(req)

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Errores de validación",
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    })
  }

  next()
}

export const validateUpdateProfile = (req, res, next) => {
  const { username, name, email } = req.body

  if (!username || username.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "El nombre de usuario es requerido",
    })
  }

  if (!name || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "El nombre es requerido",
    })
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      success: false,
      message: "El email no es válido",
    })
  }

  next()
}

export const validateChangePassword = (req, res, next) => {
  const { currentPassword, newPassword } = req.body

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Contraseña actual y nueva son requeridas",
    })
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: "La nueva contraseña debe tener al menos 6 caracteres",
    })
  }

  next()
}

export const validateCreateUser = (req, res, next) => {
  const { username, password, name, role } = req.body

  if (!username || username.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "El nombre de usuario es requerido",
    })
  }

  if (!password || password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "La contraseña debe tener al menos 6 caracteres",
    })
  }

  if (!name || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "El nombre es requerido",
    })
  }

  if (!role || !["admin", "empleado"].includes(role)) {
    return res.status(400).json({
      success: false,
      message: "El rol debe ser 'admin' o 'empleado'",
    })
  }

  next()
}

export const validateCreateClient = (req, res, next) => {
  const { username, password, name, dni } = req.body

  if (!username || username.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "El nombre de usuario es requerido",
    })
  }

  if (!password || password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "La contraseña debe tener al menos 6 caracteres",
    })
  }

  if (!name || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "El nombre es requerido",
    })
  }

  if (!dni || dni.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "El DNI es requerido",
    })
  }

  next()
}

export const validateUpdateClient = (req, res, next) => {
  const { username, name, dni } = req.body

  if (!username || username.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "El nombre de usuario es requerido",
    })
  }

  if (!name || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "El nombre es requerido",
    })
  }

  if (!dni || dni.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "El DNI es requerido",
    })
  }

  next()
}

export const validateCreatePlan = (req, res, next) => {
  const { name, duration_days, price } = req.body

  if (!name || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "El nombre del plan es requerido",
    })
  }

  if (!duration_days || duration_days <= 0) {
    return res.status(400).json({
      success: false,
      message: "La duración debe ser mayor a 0 días",
    })
  }

  if (!price || price <= 0) {
    return res.status(400).json({
      success: false,
      message: "El precio debe ser mayor a 0",
    })
  }

  next()
}

export const validateCreateInstructor = (req, res, next) => {
  const { name, dni } = req.body
  if (!name || String(name).trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "El nombre del instructor es requerido",
    })
  }
  if (!dni || String(dni).trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "El DNI del instructor es requerido",
    })
  }
  next()
}

export const validateUpdateInstructor = (req, res, next) => {
  const { name, dni } = req.body
  if (name !== undefined && (!name || String(name).trim().length === 0)) {
    return res.status(400).json({
      success: false,
      message: "El nombre del instructor no puede estar vacío",
    })
  }
  if (dni !== undefined && (!dni || String(dni).trim().length === 0)) {
    return res.status(400).json({
      success: false,
      message: "El DNI del instructor no puede estar vacío",
    })
  }
  next()
}

export const validateCreateMembership = (req, res, next) => {
  const { client_id, plan_id } = req.body

  if (!client_id) {
    return res.status(400).json({
      success: false,
      message: "El ID del cliente es requerido",
    })
  }

  if (!plan_id) {
    return res.status(400).json({
      success: false,
      message: "El ID del plan es requerido",
    })
  }

  next()
}

export const validateOpenCashSession = (req, res, next) => {
  const { opening_amount } = req.body

  if (opening_amount === undefined || opening_amount === null) {
    return res.status(400).json({
      success: false,
      message: "El monto inicial es requerido",
    })
  }

  if (opening_amount < 0) {
    return res.status(400).json({
      success: false,
      message: "El monto inicial no puede ser negativo",
    })
  }

  next()
}

export const validateCloseCashSession = (req, res, next) => {
  const { closing_amount } = req.body

  if (closing_amount === undefined || closing_amount === null) {
    return res.status(400).json({
      success: false,
      message: "El monto de cierre es requerido",
    })
  }

  if (closing_amount < 0) {
    return res.status(400).json({
      success: false,
      message: "El monto de cierre no puede ser negativo",
    })
  }

  next()
}

export const validateCreateCashMovement = (req, res, next) => {
  const { type, payment_method, amount, description } = req.body

  if (!type || !["income", "expense"].includes(type)) {
    return res.status(400).json({
      success: false,
      message: "El tipo debe ser 'income' o 'expense'",
    })
  }

  if (!payment_method || !["cash", "transfer", "credit_card"].includes(payment_method)) {
    return res.status(400).json({
      success: false,
      message: "El método de pago debe ser 'cash', 'transfer' o 'credit_card'",
    })
  }

  if (!amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "El monto debe ser mayor a 0",
    })
  }

  if (!description || description.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "La descripción es requerida",
    })
  }

  next()
}

export const validateCreateMembershipWithPayment = (req, res, next) => {
  const { client_id, plan_id, payment_method, start_date } = req.body

  if (!client_id) {
    return res.status(400).json({
      success: false,
      message: "El ID del cliente es requerido",
    })
  }

  if (!plan_id) {
    return res.status(400).json({
      success: false,
      message: "El ID del plan es requerido",
    })
  }

  if (!payment_method || !["cash", "transfer", "credit_card", "current_account"].includes(payment_method)) {
    return res.status(400).json({
      success: false,
      message: "El método de pago debe ser 'cash', 'transfer', 'credit_card' o 'current_account'",
    })
  }

  if (!start_date || String(start_date).trim() === "") {
    return res.status(400).json({
      success: false,
      message: "La fecha de inicio es requerida",
    })
  }

  const parsed = new Date(start_date)
  if (Number.isNaN(parsed.getTime())) {
    return res.status(400).json({
      success: false,
      message: "La fecha de inicio no es válida. Usá formato AAAA-MM-DD.",
    })
  }

  next()
}

export const validateProduct = (req, res, next) => {
  const { name, code, sale_price, cost_price, min_stock, unit } = req.body

  if (!name || String(name).trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "El nombre del producto es requerido",
    })
  }
  if (!code || String(code).trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "El código del producto es requerido",
    })
  }
  const salePrice = Number(sale_price)
  if (isNaN(salePrice) || salePrice < 0) {
    return res.status(400).json({
      success: false,
      message: "El precio de venta debe ser un número mayor o igual a 0",
    })
  }
  const costPrice = Number(cost_price)
  if (isNaN(costPrice) || costPrice < 0) {
    return res.status(400).json({
      success: false,
      message: "El precio de costo debe ser un número mayor o igual a 0",
    })
  }
  const minStock = Number(min_stock)
  if (isNaN(minStock) || minStock < 0) {
    return res.status(400).json({
      success: false,
      message: "El stock mínimo debe ser un número mayor o igual a 0",
    })
  }
  if (unit && !["kg", "unidad"].includes(unit)) {
    return res.status(400).json({
      success: false,
      message: "La unidad de medida debe ser 'kg' o 'unidad'",
    })
  }
  if (req.method === "POST" || req.body.stock_inicial !== undefined) {
    const stockInicial = Number(req.body.stock_inicial)
    if (isNaN(stockInicial) || stockInicial < 0) {
      return res.status(400).json({
        success: false,
        message: "El stock inicial debe ser un número mayor o igual a 0",
      })
    }
  }
  next()
}

export const validateCategory = (req, res, next) => {
  const { name } = req.body
  if (!name || String(name).trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "El nombre de la categoría es requerido",
    })
  }
  next()
}

export const validateCreateSale = (req, res, next) => {
  const { items, payment_method } = req.body
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "La venta debe incluir al menos un producto",
    })
  }
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    if (!it.product_id) {
      return res.status(400).json({
        success: false,
        message: `El item ${i + 1} debe tener product_id`,
      })
    }
    const qty = Number(it.quantity)
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: `El item ${i + 1} debe tener cantidad mayor a 0`,
      })
    }
  }
  if (!payment_method || !["cash", "transfer", "credit_card", "current_account"].includes(payment_method)) {
    return res.status(400).json({
      success: false,
      message: "El método de pago debe ser cash, transfer, credit_card o current_account",
    })
  }
  if (payment_method === "current_account") {
    const client_id = req.body.client_id
    if (!client_id) {
      return res.status(400).json({
        success: false,
        message: "Para venta a cuenta corriente es obligatorio indicar el cliente (client_id)",
      })
    }
  }
  next()
}

export const validateStockMovement = (req, res, next) => {
  const { product_id, type, quantity } = req.body

  if (!product_id) {
    return res.status(400).json({
      success: false,
      message: "El ID del producto es requerido",
    })
  }
  if (!type || !["entrada", "salida", "ajuste"].includes(type)) {
    return res.status(400).json({
      success: false,
      message: "El tipo debe ser 'entrada', 'salida' o 'ajuste'",
    })
  }
  const qty = Number(quantity)
  if (isNaN(qty) || qty === 0) {
    return res.status(400).json({
      success: false,
      message: "La cantidad debe ser un número distinto de cero",
    })
  }
  next()
}
