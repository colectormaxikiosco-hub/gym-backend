-- Tipo 'sale' en movimientos de caja para registrar ventas
ALTER TABLE cash_movements
MODIFY COLUMN type ENUM('income', 'expense', 'membership_payment', 'sale') NOT NULL;

-- Tabla de ventas (cabecera)
CREATE TABLE IF NOT EXISTS sales (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  client_id INT NULL,
  cash_session_id INT NULL,
  cash_movement_id INT NULL,
  payment_method ENUM('cash', 'transfer', 'credit_card') NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  discount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  status ENUM('completed', 'cancelled') NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (cash_movement_id) REFERENCES cash_movements(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_client_id (client_id),
  INDEX idx_created_at (created_at),
  INDEX idx_status (status),
  INDEX idx_payment_method (payment_method)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
