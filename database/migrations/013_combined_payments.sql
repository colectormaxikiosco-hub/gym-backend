-- Pagos combinados: permitir dividir una venta o membresía en varios métodos de pago.

-- 1) Agregar 'combined' al método de pago en ventas
ALTER TABLE sales
MODIFY COLUMN payment_method ENUM('cash', 'transfer', 'credit_card', 'current_account', 'combined') NOT NULL;

-- 2) Agregar 'combined' al método de pago en membresías
ALTER TABLE memberships
MODIFY COLUMN payment_method ENUM('cash', 'transfer', 'credit_card', 'current_account', 'combined') NULL;

-- 3) Detalle de pagos por venta (un registro por cada método de pago usado)
CREATE TABLE IF NOT EXISTS sale_payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sale_id INT NOT NULL,
  payment_method ENUM('cash', 'transfer', 'credit_card', 'current_account') NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  cash_movement_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (cash_movement_id) REFERENCES cash_movements(id) ON DELETE SET NULL,
  INDEX idx_sale_id (sale_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) Detalle de pagos por membresía
CREATE TABLE IF NOT EXISTS membership_payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  membership_id INT NOT NULL,
  payment_method ENUM('cash', 'transfer', 'credit_card', 'current_account') NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  cash_movement_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE CASCADE,
  FOREIGN KEY (cash_movement_id) REFERENCES cash_movements(id) ON DELETE SET NULL,
  INDEX idx_membership_id (membership_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
