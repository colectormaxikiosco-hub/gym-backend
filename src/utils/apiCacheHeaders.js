/**
 * Evita que proxies/CDN/navegadores cacheen respuestas de API que dependen del token.
 * GET /auth/verify con la misma URL pero distinto Authorization puede servirse mal si se cachea.
 */
export function setNoStoreHeaders(res) {
  res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")
  res.setHeader("Vary", "Authorization")
}
