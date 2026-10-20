-- Control de stock por sesión de caja (turno)
CREATE TABLE IF NOT EXISTS stock_controls (
  id INT PRIMARY KEY AUTO_INCREMENT,
  cash_session_id INT NOT NULL,
  status ENUM('pending', 'completed', 'skipped') NOT NULL DEFAULT 'pending',
  performed_by INT NULL COMMENT 'Usuario que realizó/completó el control',
  skipped_by INT NULL COMMENT 'Usuario que cerró el turno sin control',
  notes TEXT NULL,
  products_count INT NOT NULL DEFAULT 0,
  ok_count INT NOT NULL DEFAULT 0,
  shortage_count INT NOT NULL DEFAULT 0,
  surplus_count INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMP NULL,
  skipped_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_stock_controls_session (cash_session_id),
  FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id) ON DELETE RESTRICT,
  FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (skipped_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_stock_controls_status (status),
  INDEX idx_stock_controls_completed_at (completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_control_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  stock_control_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  product_code VARCHAR(50) NOT NULL,
  unit ENUM('unidad', 'kg') NOT NULL DEFAULT 'unidad',
  system_stock DECIMAL(12, 3) NOT NULL,
  counted_stock DECIMAL(12, 3) NOT NULL,
  difference DECIMAL(12, 3) NOT NULL,
  result ENUM('ok', 'faltante', 'sobrante') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_stock_control_product (stock_control_id, product_id),
  FOREIGN KEY (stock_control_id) REFERENCES stock_controls(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  INDEX idx_stock_control_items_result (result),
  INDEX idx_stock_control_items_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Controles pendientes para sesiones abiertas que aún no tenían registro
INSERT INTO stock_controls (cash_session_id, status)
SELECT cs.id, 'pending'
FROM cash_sessions cs
WHERE cs.status = 'open'
  AND NOT EXISTS (
    SELECT 1 FROM stock_controls sc WHERE sc.cash_session_id = cs.id
  );
