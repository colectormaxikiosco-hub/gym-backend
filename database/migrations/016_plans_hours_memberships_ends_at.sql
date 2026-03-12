-- Planes: duración opcional en horas. Si duration_hours > 0, el plan es por horas.
ALTER TABLE plans
ADD COLUMN duration_hours INT NULL DEFAULT NULL AFTER duration_days;

-- Membresías: para planes por horas, vencimiento exacto en timestamp.
ALTER TABLE memberships
ADD COLUMN ends_at TIMESTAMP NULL DEFAULT NULL AFTER end_date;
