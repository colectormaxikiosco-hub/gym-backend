-- Columna instructor_id en memberships: instructor asignado a esta membresía
-- Puede ser NULL (plan sin instructores o sin asignar)

ALTER TABLE memberships
ADD COLUMN instructor_id INT NULL AFTER plan_id,
ADD CONSTRAINT fk_memberships_instructor
  FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE SET NULL,
ADD INDEX idx_memberships_instructor (instructor_id);
