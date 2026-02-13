import twilio from "twilio"
import { normalizePhoneArgentina } from "../utils/phoneAr.js"

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const fromWhatsApp = process.env.TWILIO_WHATSAPP_FROM || ""

const isConfigured = () => Boolean(accountSid && authToken && fromWhatsApp)

/**
 * Envía un WhatsApp de bienvenida al cliente con sus credenciales.
 * @param {string} phone - Teléfono del cliente (se normaliza a Argentina E.164)
 * @param {string} username - Usuario de acceso
 * @param {string} password - Contraseña en texto plano (solo para este mensaje, no se guarda)
 * @returns {{ sent: boolean, error?: string }}
 */
export async function sendWelcomeWhatsApp(phone, username, password) {
  if (!phone || !username) {
    return { sent: false, error: "Faltan teléfono o usuario" }
  }

  if (!isConfigured()) {
    console.log("[WhatsApp] No configurado (TWILIO_*). Se omite envío.")
    return { sent: false, error: "WhatsApp no configurado" }
  }

  const toE164 = normalizePhoneArgentina(phone)
  if (!toE164) {
    console.warn("[WhatsApp] Teléfono no válido o no argentino:", phone)
    return { sent: false, error: "Teléfono no válido" }
  }

  const message = [
    "¡Bienvenido/a a Life Fitness!",
    "",
    "Tus credenciales de ingreso son:",
    `Usuario: ${username}`,
    `Contraseña: ${password}`,
    "",
    "Ingresá a lifefitness.com para ver tu estado de membresía, avisos y más.",
    "",
    "— Life Fitness",
  ].join("\n")

  try {
    const client = twilio(accountSid, authToken)
    const to = `whatsapp:+${toE164}`
    const from = fromWhatsApp.startsWith("whatsapp:") ? fromWhatsApp : `whatsapp:${fromWhatsApp}`

    await client.messages.create({
      body: message,
      from,
      to,
    })
    console.log("[WhatsApp] Mensaje de bienvenida enviado a", toE164)
    return { sent: true }
  } catch (err) {
    console.error("[WhatsApp] Error al enviar:", err.message)
    return { sent: false, error: err.message }
  }
}
