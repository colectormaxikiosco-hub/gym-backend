-- Migración: tabla de registro de entradas (ingresos de clientes al gimnasio)
-- Ejecutar solo si ya tenés la base de datos creada y querés agregar esta tabla sin borrar datos.

USE gym_db;

CREATE TABLE IF NOT EXISTS client_entries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  client_id INT NOT NULL,
  membership_id INT NOT NULL,
  entered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_client_id (client_id),
  INDEX idx_membership_id (membership_id),
  INDEX idx_entered_at (entered_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
