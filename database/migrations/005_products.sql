-- Tabla de productos (inventario)
CREATE TABLE IF NOT EXISTS products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  category VARCHAR(100),
  sale_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  cost_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  stock DECIMAL(12, 3) NOT NULL DEFAULT 0.000 COMMENT 'Stock actual (se actualiza con movimientos)',
  min_stock DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
  unit ENUM('kg', 'unidad') NOT NULL DEFAULT 'unidad',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_category (category),
  INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
