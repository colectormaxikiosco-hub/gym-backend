-- Fecha de nacimiento del cliente (opcional)
ALTER TABLE clients
  ADD COLUMN birth_date DATE NULL DEFAULT NULL AFTER dni;
