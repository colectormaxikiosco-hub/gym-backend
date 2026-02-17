-- Ejecutar en Railway si cash_sessions no tiene closing_cash, closing_transfer, closing_card.
-- Seguro ejecutar varias veces: solo agrega las columnas que no existan.

SET @dbname = DATABASE();
SET @t = 'cash_sessions';

-- Agregar cada columna solo si no existe (seguro ejecutar varias veces).
SET @add1 = (SELECT COUNT(*) = 0 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @t AND COLUMN_NAME = 'closing_cash');
SET @stmt1 = IF(@add1, 'ALTER TABLE cash_sessions ADD COLUMN closing_cash DECIMAL(10, 2) NULL AFTER difference', 'SELECT 1');
PREPARE p1 FROM @stmt1;
EXECUTE p1;
DEALLOCATE PREPARE p1;

SET @add2 = (SELECT COUNT(*) = 0 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @t AND COLUMN_NAME = 'closing_transfer');
SET @stmt2 = IF(@add2, 'ALTER TABLE cash_sessions ADD COLUMN closing_transfer DECIMAL(10, 2) NULL AFTER closing_cash', 'SELECT 1');
PREPARE p2 FROM @stmt2;
EXECUTE p2;
DEALLOCATE PREPARE p2;

SET @add3 = (SELECT COUNT(*) = 0 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @t AND COLUMN_NAME = 'closing_card');
SET @stmt3 = IF(@add3, 'ALTER TABLE cash_sessions ADD COLUMN closing_card DECIMAL(10, 2) NULL AFTER closing_transfer', 'SELECT 1');
PREPARE p3 FROM @stmt3;
EXECUTE p3;
DEALLOCATE PREPARE p3;
