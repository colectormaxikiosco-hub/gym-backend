/**
 * Normaliza un número de teléfono de Argentina al formato E.164 para WhatsApp.
 * Argentina: +54, móviles con 9 después del código de país (54 9 XXX XXXXXXX).
 * Ejemplos: 381 1234567, 15 381 1234567, 0381-1234567 → 5493811234567
 * @param {string} input - Número tal como puede ingresar el usuario (con espacios, guiones, etc.)
 * @returns {string|null} - Número en E.164 sin el "+" (ej: 5493811234567) o null si no es válido
 */
export function normalizePhoneArgentina(input) {
  if (input == null || typeof input !== "string") return null
  const digits = input.replace(/\D/g, "")
  if (digits.length < 10) return null

  let normalized = digits

  // Ya tiene código de país 54 (puede ser 54 9 381... o 54 381...)
  if (normalized.startsWith("54")) {
    if (normalized.length === 12 && normalized.charAt(2) !== "9") {
      normalized = "54" + "9" + normalized.slice(2)
    }
    return normalized.length >= 12 ? normalized : null
  }

  // Formato local con 15 (móvil): 15 381 1234567 → 11 dígitos
  if (normalized.length === 11 && normalized.startsWith("15")) {
    normalized = "549" + normalized.slice(2)
    return normalized
  }

  // 10 dígitos: código de área + número (ej. 3811234567 para Tucumán)
  if (normalized.length === 10) {
    normalized = "549" + normalized
    return normalized
  }

  return null
}
