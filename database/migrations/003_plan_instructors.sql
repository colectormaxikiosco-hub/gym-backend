-- Relación muchos a muchos: planes <-> instructores
-- Un plan puede tener 0, 1 o más instructores.

CREATE TABLE IF NOT EXISTS plan_instructors (
  plan_id INT NOT NULL,
  instructor_id INT NOT NULL,
  PRIMARY KEY (plan_id, instructor_id),
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
  FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE,
  INDEX idx_plan_id (plan_id),
  INDEX idx_instructor_id (instructor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
