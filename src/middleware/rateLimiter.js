const rateLimitStore = new Map()

const rateLimiter = (maxRequests = 100, windowMs = 60000) => {
  return (req, res, next) => {
    const identifier = req.headers.authorization || req.ip
    const now = Date.now()

    // Limpiar entradas antiguas
    for (const [key, data] of rateLimitStore.entries()) {
      if (now - data.resetTime > windowMs) {
        rateLimitStore.delete(key)
      }
    }

    // Obtener o crear entrada para este identificador
    let requestData = rateLimitStore.get(identifier)

    if (!requestData) {
      requestData = {
        count: 0,
        resetTime: now + windowMs,
      }
      rateLimitStore.set(identifier, requestData)
    }

    // Verificar si está dentro del límite
    if (requestData.count >= maxRequests) {
      const retryAfter = Math.ceil((requestData.resetTime - now) / 1000)
      res.set("Retry-After", retryAfter.toString())
      return res.status(429).json({
        success: false,
        message: "Demasiadas peticiones. Por favor, intenta de nuevo más tarde.",
        retryAfter,
      })
    }

    // Incrementar contador
    requestData.count++

    // Agregar headers de información
    res.set("X-RateLimit-Limit", maxRequests.toString())
    res.set("X-RateLimit-Remaining", (maxRequests - requestData.count).toString())
    res.set("X-RateLimit-Reset", requestData.resetTime.toString())

    next()
  }
}

module.exports = rateLimiter
