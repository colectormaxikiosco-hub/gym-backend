-- Permite reutilizar nombres de planes desactivados.
-- Objetivo: bloquear duplicados solo entre planes activos.

-- 1) Quitar restricción UNIQUE global por nombre (si existe)
SET @idx_name_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'plans'
    AND index_name = 'name'
);
SET @drop_idx_sql := IF(
  @idx_name_exists > 0,
  'ALTER TABLE plans DROP INDEX `name`',
  'SELECT 1'
);
PREPARE stmt_drop_idx FROM @drop_idx_sql;
EXECUTE stmt_drop_idx;
DEALLOCATE PREPARE stmt_drop_idx;

-- 2) Crear columna generada para unicidad solo en activos
SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'plans'
    AND column_name = 'active_name_unique'
);
SET @add_col_sql := IF(
  @col_exists = 0,
  "ALTER TABLE plans ADD COLUMN active_name_unique VARCHAR(100) GENERATED ALWAYS AS (CASE WHEN active = 1 THEN name ELSE NULL END) STORED",
  'SELECT 1'
);
PREPARE stmt_add_col FROM @add_col_sql;
EXECUTE stmt_add_col;
DEALLOCATE PREPARE stmt_add_col;

-- 3) Índice UNIQUE sobre columna generada (NULL permite múltiples inactivos)
SET @uk_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'plans'
    AND index_name = 'uk_plans_active_name'
);
SET @add_uk_sql := IF(
  @uk_exists = 0,
  'CREATE UNIQUE INDEX uk_plans_active_name ON plans (active_name_unique)',
  'SELECT 1'
);
PREPARE stmt_add_uk FROM @add_uk_sql;
EXECUTE stmt_add_uk;
DEALLOCATE PREPARE stmt_add_uk;

