-- Email opcional en usuarios: permitir NULL y normalizar vacíos.
-- En MySQL varias filas pueden tener NULL en una columna UNIQUE (no cuenta como duplicado).
-- Asegura que la columna acepte NULL y convierte emails vacíos existentes a NULL.

ALTER TABLE users MODIFY COLUMN email VARCHAR(100) NULL UNIQUE;
UPDATE users SET email = NULL WHERE COALESCE(TRIM(email), '') = '';
