-- Descuento en membresías: monto en pesos descontado del precio del plan
-- El monto a pagar es plan.price - discount (no se guarda porcentaje, solo el monto descontado)

ALTER TABLE memberships
ADD COLUMN discount DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER cash_movement_id;
