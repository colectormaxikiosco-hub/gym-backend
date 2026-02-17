-- Ejecutar en Railway (o cualquier MySQL) si la tabla memberships no tiene la columna reminder_sent_days.
-- Seguro ejecutar varias veces: solo agrega la columna si no existe.

SET @dbname = DATABASE();
SET @tablename = 'memberships';
SET @columnname = 'reminder_sent_days';
SET @prepared = (SELECT COUNT(*) = 0 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname);

SET @sql = IF(@prepared,
  'ALTER TABLE memberships ADD COLUMN reminder_sent_days VARCHAR(20) NOT NULL DEFAULT '''' COMMENT ''Días en que ya se envió recordatorio (ej: 5,3,1)''',
  'SELECT 1 AS noop');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
