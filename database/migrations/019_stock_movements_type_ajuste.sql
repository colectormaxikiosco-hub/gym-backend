-- Permite registrar ajustes de inventario (stock físico).
-- La tabla en producción quedó con ENUM('entrada', 'salida') y MySQL rechaza 'ajuste'
-- con: Data truncated for column 'type'.
ALTER TABLE stock_movements
  MODIFY COLUMN type ENUM('entrada', 'salida', 'ajuste') NOT NULL;
