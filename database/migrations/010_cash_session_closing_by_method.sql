-- Montos de cierre por método de pago (efectivo, transferencia, tarjeta)
ALTER TABLE cash_sessions
  ADD COLUMN closing_cash DECIMAL(10, 2) NULL AFTER difference,
  ADD COLUMN closing_transfer DECIMAL(10, 2) NULL AFTER closing_cash,
  ADD COLUMN closing_card DECIMAL(10, 2) NULL AFTER closing_transfer;
