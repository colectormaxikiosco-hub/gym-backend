import bcrypt from "bcryptjs"
import pool from "../config/database.js"
import { normalizePhoneArgentina } from "../utils/phoneAr.js"

const WELCOME_SITE_URL = "www.lifefitnesstrancas.com"

function buildWelcomeMessageWhatsApp(username, password) {
  return [
    "¡Bienvenido/a a Life Fitness!",
    "",
    "Tus credenciales de ingreso son:",
    `Usuario: ${username}`,
    `Contraseña: ${password}`,
    "",
    `Ingresá a ${WELCOME_SITE_URL} para ver tu estado de membresía, avisos y más.`,
    "",
    "Podés cambiar tu contraseña en la sección Perfil una vez que ingreses.",
    "",
    "— Life Fitness",
  ].join("\n")
}

function generateTemporaryPassword(length = 8) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"
  let result = ""
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Obtener todos los clientes (con paginación, búsqueda, filtro por cuenta corriente y por estado activo/inactivo)
export const getAllClients = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10))
    const offset = (page - 1) * limit
    const search = (req.query.search || "").trim()
    const debtFilter = (req.query.debt_filter || "all").toLowerCase()
    const validDebtFilter = ["all", "with_debt", "al_day"].includes(debtFilter) ? debtFilter : "all"
    // active_filter: "active" = solo activos (por defecto), "inactive" = solo inactivos
    const activeFilter = (req.query.active_filter || "active").toLowerCase()
    const onlyInactive = activeFilter === "inactive"

    const daysRemainingFilter = parseInt(req.query.days_remaining, 10)
    const validDaysRemaining = [0, 1, 2, 3, 4, 5]
    const filterByDaysRemaining = Number.isInteger(daysRemainingFilter) && validDaysRemaining.includes(daysRemainingFilter)
    const filterExpired = ["1", "true", "yes"].includes(
      String(req.query.filter_expired || "").toLowerCase(),
    )

    const baseFrom = "FROM clients c LEFT JOIN users u ON c.created_by = u.id"
    const searchCondition = search
      ? ` WHERE (c.name LIKE ? OR c.username LIKE ? OR c.dni LIKE ? OR c.phone LIKE ?)`
      : ""
    const searchParam = search ? `%${search}%` : null
    let params = searchParam ? [searchParam, searchParam, searchParam, searchParam] : []
    const activeCondition = (searchCondition ? " AND " : " WHERE ") + " c.active = ?"
    params = [...params, onlyInactive ? 0 : 1]
    if (filterByDaysRemaining) params = [...params, daysRemainingFilter]
    // filterExpired no añade params

    const balanceSubquery =
      "(SELECT ca.balance FROM current_account ca WHERE ca.client_id = c.id ORDER BY ca.created_at DESC LIMIT 1)"
    let debtHaving = ""
    if (validDebtFilter === "with_debt") {
      debtHaving = " HAVING balance > 0"
    } else if (validDebtFilter === "al_day") {
      debtHaving = " HAVING (balance IS NULL OR balance <= 0)"
    }

    let daysRemainingCondition = ""
    if (filterByDaysRemaining) {
      daysRemainingCondition = ` AND c.id IN (SELECT m.client_id FROM memberships m WHERE m.status = 'active' AND m.start_date <= CURDATE() AND m.end_date >= CURDATE() AND DATEDIFF(m.end_date, CURDATE()) = ?)`
    } else if (filterExpired) {
      daysRemainingCondition = ` AND c.id IN (SELECT client_id FROM memberships WHERE status = 'expired') AND c.id NOT IN (SELECT client_id FROM memberships WHERE status = 'active' AND start_date <= CURDATE() AND end_date >= CURDATE())`
    }
    const baseSelect = `SELECT c.id, c.username, c.name, c.phone, c.dni, 
       c.active, c.created_at, c.last_login, u.name as created_by_name,
       ${balanceSubquery} as balance
       ${baseFrom}
       ${searchCondition}${activeCondition}${daysRemainingCondition}`

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM (${baseSelect}${debtHaving}) AS filtered`,
      params,
    )
    const total = countResult[0]?.total ?? 0

    const [clients] = await pool.query(
      `${baseSelect}${debtHaving} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    )

    const includeActiveMembership = ["1", "true", "yes"].includes(
      String(req.query.include_active_membership || "").toLowerCase(),
    )
    if (includeActiveMembership && clients.length > 0) {
      const clientIds = clients.map((c) => c.id)
      const placeholders = clientIds.map(() => "?").join(",")
      const [activeRows] = await pool.query(
        `SELECT m.client_id, m.id as membership_id, m.end_date, m.reminder_sent_days,
         p.name as plan_name, p.duration_days,
         DATEDIFF(m.end_date, CURDATE()) as days_remaining
         FROM memberships m
         INNER JOIN plans p ON p.id = m.plan_id
         WHERE m.status = 'active' AND m.start_date <= CURDATE() AND m.end_date >= CURDATE() AND m.client_id IN (${placeholders})
         ORDER BY m.end_date DESC`,
        clientIds,
      )
      const membershipByClient = {}
      activeRows.forEach((row) => {
        if (!membershipByClient[row.client_id]) {
          membershipByClient[row.client_id] = {
            membership_id: row.membership_id,
            plan_name: row.plan_name,
            end_date: row.end_date,
            days_remaining: row.days_remaining,
            duration_days: row.duration_days,
            reminder_sent_days: row.reminder_sent_days || "",
          }
        }
      })
      clients.forEach((c) => {
        c.active_membership = membershipByClient[c.id] || null
      })

      const clientIdsWithoutActive = clientIds.filter((id) => !membershipByClient[id])
      if (clientIdsWithoutActive.length > 0) {
        const placeholdersExpired = clientIdsWithoutActive.map(() => "?").join(",")
        const [expiredRows] = await pool.query(
          `SELECT m.client_id, m.end_date, m.status, p.name as plan_name
           FROM memberships m
           INNER JOIN plans p ON p.id = m.plan_id
           WHERE m.client_id IN (${placeholdersExpired}) AND (m.status = 'expired' OR m.end_date < CURDATE())
           ORDER BY m.end_date DESC`,
          clientIdsWithoutActive,
        )
        const expiredByClient = {}
        expiredRows.forEach((row) => {
          if (!expiredByClient[row.client_id]) {
            expiredByClient[row.client_id] = {
              end_date: row.end_date,
              status: row.status,
              plan_name: row.plan_name,
            }
          }
        })
        clients.forEach((c) => {
          c.expired_membership = expiredByClient[c.id] || null
        })
      } else {
        clients.forEach((c) => {
          c.expired_membership = null
        })
      }
    }

    const totalPages = Math.ceil(total / limit) || 1

    res.json({
      success: true,
      data: clients,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error("Error al obtener clientes")
    next(error)
  }
}

// Obtener un cliente por ID
export const getClientById = async (req, res, next) => {
  try {
    const { id } = req.params

    const [clients] = await pool.query(
      `SELECT c.id, c.username, c.name, c.phone, c.address, c.dni, 
       c.emergency_contact, c.emergency_phone, c.active, 
       c.created_at, c.last_login, u.name as created_by_name
       FROM clients c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = ?`,
      [id],
    )

    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Cliente no encontrado",
      })
    }

    res.json({
      success: true,
      data: clients[0],
    })
  } catch (error) {
    console.error("Error al obtener cliente")
    next(error)
  }
}

// Crear nuevo cliente
export const createClient = async (req, res, next) => {
  try {
    const { username, password, name, phone, dni, address, emergency_contact, emergency_phone } = req.body
    const createdBy = req.user.id

    if (!username || !password || !name || !dni) {
      return res.status(400).json({
        success: false,
        message: "Usuario, contraseña, nombre y DNI son requeridos",
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "La contraseña debe tener al menos 6 caracteres",
      })
    }

    // Verificar si el username ya existe
    const [existingUsername] = await pool.query("SELECT id FROM clients WHERE username = ?", [username])

    if (existingUsername.length > 0) {
      return res.status(400).json({
        success: false,
        message: "El nombre de usuario ya existe",
      })
    }

    // Verificar si el DNI ya existe
    const [existingDNI] = await pool.query("SELECT id FROM clients WHERE dni = ?", [dni])

    if (existingDNI.length > 0) {
      return res.status(400).json({
        success: false,
        message: "El DNI ya está registrado",
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const [result] = await pool.query(
      `INSERT INTO clients (username, password, name, phone, dni, address, emergency_contact, emergency_phone, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, hashedPassword, name, phone, dni, address, emergency_contact, emergency_phone, createdBy],
    )

    const [newClient] = await pool.query(
      "SELECT id, username, name, phone, dni, active, created_at FROM clients WHERE id = ?",
      [result.insertId],
    )

    res.status(201).json({
      success: true,
      message: "Cliente creado correctamente",
      data: newClient[0],
    })
  } catch (error) {
    console.error("Error al crear cliente")
    next(error)
  }
}

// Actualizar cliente
export const updateClient = async (req, res, next) => {
  try {
    const { id } = req.params
    const { username, name, phone, dni, address, emergency_contact, emergency_phone, active } = req.body

    if (!username || !name || !dni) {
      return res.status(400).json({
        success: false,
        message: "Usuario, nombre y DNI son requeridos",
      })
    }

    const [existingUsername] = await pool.query("SELECT id FROM clients WHERE username = ? AND id != ?", [username, id])

    if (existingUsername.length > 0) {
      return res.status(400).json({
        success: false,
        message: "El nombre de usuario ya está en uso",
      })
    }

    // Verificar si el DNI ya existe (excepto el cliente actual)
    const [existingDNI] = await pool.query("SELECT id FROM clients WHERE dni = ? AND id != ?", [dni, id])

    if (existingDNI.length > 0) {
      return res.status(400).json({
        success: false,
        message: "El DNI ya está registrado",
      })
    }

    await pool.query(
      `UPDATE clients SET username = ?, name = ?, phone = ?, dni = ?, 
       address = ?, emergency_contact = ?, emergency_phone = ?, active = ? 
       WHERE id = ?`,
      [username, name, phone, dni, address, emergency_contact, emergency_phone, active !== undefined ? active : true, id],
    )

    const [updatedClient] = await pool.query(
      "SELECT id, username, name, phone, dni, active, created_at, last_login FROM clients WHERE id = ?",
      [id],
    )

    if (updatedClient.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Cliente no encontrado",
      })
    }

    res.json({
      success: true,
      message: "Cliente actualizado correctamente",
      data: updatedClient[0],
    })
  } catch (error) {
    console.error("Error al actualizar cliente")
    next(error)
  }
}

// Eliminar cliente (desactivar)
export const deleteClient = async (req, res, next) => {
  try {
    const { id } = req.params

    await pool.query("UPDATE clients SET active = 0 WHERE id = ?", [id])

    res.json({
      success: true,
      message: "Cliente desactivado correctamente",
    })
  } catch (error) {
    console.error("Error al eliminar cliente")
    next(error)
  }
}

// Reenviar mensaje de bienvenida por WhatsApp: genera contraseña temporal, actualiza el cliente y devuelve mensaje y teléfono para abrir wa.me
export const resendWelcomeWhatsApp = async (req, res, next) => {
  try {
    const { id } = req.params

    const [clients] = await pool.query(
      "SELECT id, username, name, phone FROM clients WHERE id = ? AND active = 1",
      [id],
    )

    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Cliente no encontrado",
      })
    }

    const client = clients[0]
    const phone = client.phone?.toString?.()?.trim?.()

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "El cliente no tiene teléfono registrado. Agregá un teléfono para poder reenviar las credenciales por WhatsApp.",
      })
    }

    const normalizedPhone = normalizePhoneArgentina(phone)
    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        message: "El número de teléfono no es válido para WhatsApp (formato Argentina).",
      })
    }

    const tempPassword = generateTemporaryPassword(8)
    const hashedPassword = await bcrypt.hash(tempPassword, 10)
    await pool.query("UPDATE clients SET password = ? WHERE id = ?", [hashedPassword, id])

    const message = buildWelcomeMessageWhatsApp(client.username, tempPassword)

    res.json({
      success: true,
      message: "Se generó una nueva contraseña temporal. Abrí WhatsApp para enviar las credenciales al cliente.",
      data: {
        message,
        phone: normalizedPhone,
      },
    })
  } catch (error) {
    console.error("Error al reenviar mensaje de bienvenida WhatsApp", error)
    next(error)
  }
}

// Obtener perfil del cliente actual (cuando el cliente inicia sesión), incluyendo membresía activa
export const getMyProfile = async (req, res, next) => {
  try {
    const clientId = req.user.id

    const [clients] = await pool.query(
      `SELECT id, username, name, phone, address, dni, 
       emergency_contact, emergency_phone, created_at, last_login 
       FROM clients WHERE id = ? AND active = 1`,
      [clientId],
    )

    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Cliente no encontrado",
      })
    }

    const client = clients[0]

    const [activeMembershipRows] = await pool.query(
      `SELECT m.id as membership_id, m.end_date, p.name as plan_name,
       p.duration_days, DATEDIFF(m.end_date, CURDATE()) as days_remaining
       FROM memberships m
       INNER JOIN plans p ON p.id = m.plan_id
       WHERE m.client_id = ? AND m.status = 'active' AND m.start_date <= CURDATE() AND m.end_date >= CURDATE()
       ORDER BY m.end_date DESC LIMIT 1`,
      [clientId],
    )

    client.active_membership =
      activeMembershipRows.length > 0
        ? {
            plan_name: activeMembershipRows[0].plan_name,
            end_date: activeMembershipRows[0].end_date,
            days_remaining: activeMembershipRows[0].days_remaining,
            duration_days: activeMembershipRows[0].duration_days,
          }
        : null

    res.json({
      success: true,
      data: client,
    })
  } catch (error) {
    console.error("Error al obtener perfil del cliente")
    next(error)
  }
}

// Actualizar perfil del cliente actual
export const updateMyProfile = async (req, res, next) => {
  try {
    const clientId = req.user.id
    const { username, name, phone, address, emergency_contact, emergency_phone } = req.body

    if (!username || !name) {
      return res.status(400).json({
        success: false,
        message: "Nombre de usuario y nombre son requeridos",
      })
    }

    const [existingUsername] = await pool.query("SELECT id FROM clients WHERE username = ? AND id != ?", [
      username,
      clientId,
    ])

    if (existingUsername.length > 0) {
      return res.status(400).json({
        success: false,
        message: "El nombre de usuario ya está en uso",
      })
    }

    await pool.query(
      "UPDATE clients SET username = ?, name = ?, phone = ?, address = ?, emergency_contact = ?, emergency_phone = ? WHERE id = ?",
      [username, name, phone, address, emergency_contact, emergency_phone, clientId],
    )

    const [updatedClient] = await pool.query(
      "SELECT id, username, name, phone, address, emergency_contact, emergency_phone FROM clients WHERE id = ?",
      [clientId],
    )

    res.json({
      success: true,
      message: "Perfil actualizado correctamente",
      data: updatedClient[0],
    })
  } catch (error) {
    console.error("Error al actualizar perfil del cliente")
    next(error)
  }
}

export const changeMyPassword = async (req, res, next) => {
  try {
    const clientId = req.user.id
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Contraseña actual y nueva contraseña son requeridas",
      })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "La contraseña debe tener al menos 6 caracteres",
      })
    }

    const [clients] = await pool.query("SELECT password FROM clients WHERE id = ?", [clientId])

    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Cliente no encontrado",
      })
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, clients[0].password)

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Contraseña actual incorrecta",
      })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await pool.query("UPDATE clients SET password = ? WHERE id = ?", [hashedPassword, clientId])

    res.json({
      success: true,
      message: "Contraseña actualizada correctamente",
    })
  } catch (error) {
    console.error("Error al cambiar contraseña del cliente")
    next(error)
  }
}
