-- =============================================================================
-- SCRIPT DE PRUEBA: Clientes con membresías de plan mensual por vencer
-- =============================================================================
-- Crea 5 clientes de prueba con Plan Mensual (30 días), cada uno con su
-- membresía activa venciendo en 5, 4, 3, 2 y 1 día(s) para probar:
-- - Botón y modal de recordatorio por WhatsApp (días 5, 3, 1)
-- - Colores de fila (verde / naranja / rojo)
--
-- Requisitos: tener la migración 011 (reminder_sent_days) aplicada y al menos
-- un usuario con id = 1 (created_by). Plan Mensual debe existir con id = 1.
--
-- Contraseña de los clientes de prueba: 123456
-- =============================================================================

-- Evitar duplicados: eliminar clientes de prueba anteriores (opcional)
DELETE m FROM memberships m
INNER JOIN clients c ON m.client_id = c.id
WHERE c.username LIKE 'test_venc_%';
DELETE FROM clients WHERE username LIKE 'test_venc_%';

-- Hash bcrypt para contraseña "123456"
SET @pwd = '$2a$10$xwGjyEx3Gop7Z2tMB5/pW.zNop/WGrbtAVt28WOxkFuBCvyZK2hCW';

-- Cliente 1: membresía vence en 5 días (debe verse botón WhatsApp y fila naranja)
INSERT INTO clients (username, password, name, phone, dni, active, created_by)
VALUES ('test_venc_5d', @pwd, 'Cliente Test 5 Días', '3815000001', '50900001', 1, 1);
SET @c5 = LAST_INSERT_ID();
INSERT INTO memberships (client_id, plan_id, start_date, end_date, status, payment_method, payment_status, created_by, reminder_sent_days)
VALUES (@c5, 1, DATE_SUB(CURDATE(), INTERVAL 25 DAY), DATE_ADD(CURDATE(), INTERVAL 5 DAY), 'active', 'cash', 'paid', 1, '');

-- Cliente 2: membresía vence en 4 días (sin botón; fila naranja si plan > 5 días)
INSERT INTO clients (username, password, name, phone, dni, active, created_by)
VALUES ('test_venc_4d', @pwd, 'Cliente Test 4 Días', '3815000002', '50900002', 1, 1);
SET @c4 = LAST_INSERT_ID();
INSERT INTO memberships (client_id, plan_id, start_date, end_date, status, payment_method, payment_status, created_by, reminder_sent_days)
VALUES (@c4, 1, DATE_SUB(CURDATE(), INTERVAL 26 DAY), DATE_ADD(CURDATE(), INTERVAL 4 DAY), 'active', 'cash', 'paid', 1, '');

-- Cliente 3: membresía vence en 3 días (botón WhatsApp + fila naranja)
INSERT INTO clients (username, password, name, phone, dni, active, created_by)
VALUES ('test_venc_3d', @pwd, 'Cliente Test 3 Días', '3815000003', '50900003', 1, 1);
SET @c3 = LAST_INSERT_ID();
INSERT INTO memberships (client_id, plan_id, start_date, end_date, status, payment_method, payment_status, created_by, reminder_sent_days)
VALUES (@c3, 1, DATE_SUB(CURDATE(), INTERVAL 27 DAY), DATE_ADD(CURDATE(), INTERVAL 3 DAY), 'active', 'cash', 'paid', 1, '');

-- Cliente 4: membresía vence en 2 días (sin botón; fila verde o naranja según lógica)
INSERT INTO clients (username, password, name, phone, dni, active, created_by)
VALUES ('test_venc_2d', @pwd, 'Cliente Test 2 Días', '3815000004', '50900004', 1, 1);
SET @c2 = LAST_INSERT_ID();
INSERT INTO memberships (client_id, plan_id, start_date, end_date, status, payment_method, payment_status, created_by, reminder_sent_days)
VALUES (@c2, 1, DATE_SUB(CURDATE(), INTERVAL 28 DAY), DATE_ADD(CURDATE(), INTERVAL 2 DAY), 'active', 'cash', 'paid', 1, '');

-- Cliente 5: membresía vence en 1 día (botón WhatsApp + fila roja)
INSERT INTO clients (username, password, name, phone, dni, active, created_by)
VALUES ('test_venc_1d', @pwd, 'Cliente Test 1 Día', '3815000005', '50900005', 1, 1);
SET @c1 = LAST_INSERT_ID();
INSERT INTO memberships (client_id, plan_id, start_date, end_date, status, payment_method, payment_status, created_by, reminder_sent_days)
VALUES (@c1, 1, DATE_SUB(CURDATE(), INTERVAL 29 DAY), DATE_ADD(CURDATE(), INTERVAL 1 DAY), 'active', 'cash', 'paid', 1, '');

-- =============================================================================
-- Resumen esperado en la tabla de clientes:
-- - test_venc_5d: 5 días restantes → botón recordatorio visible, fila naranja
-- - test_venc_4d: 4 días restantes → sin botón, fila naranja
-- - test_venc_3d: 3 días restantes → botón recordatorio visible, fila naranja
-- - test_venc_2d: 2 días restantes → sin botón, fila naranja
-- - test_venc_1d: 1 día restante  → botón recordatorio visible, fila roja
-- =============================================================================

SELECT 'Script completado. 5 clientes de prueba creados con membresías por vencer.' AS mensaje;
