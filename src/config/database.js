import mysql from "mysql2/promise"
import dotenv from "dotenv"

dotenv.config()

const isProduction = process.env.NODE_ENV === "production"

// Railway y entornos cloud: usar DATABASE_URL (o MYSQL_URL). Local: DB_HOST, DB_USER, etc.
const databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_URL

const poolOptions = {
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
}

const pool = databaseUrl
  ? mysql.createPool(databaseUrl, {
      ...poolOptions,
      ...(isProduction && { ssl: { rejectUnauthorized: false } }),
    })
  : mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "gym_db",
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      ...poolOptions,
    })

pool
  .getConnection()
  .then((connection) => {
    if (!isProduction) {
      console.log("Base de datos conectada correctamente")
    }
    connection.release()
  })
  .catch((err) => {
    console.error("ERROR CRÍTICO: No se pudo conectar a la base de datos")
    if (!isProduction) {
      console.error("Detalles:", err.message)
    }
    process.exit(1)
  })

export default pool
