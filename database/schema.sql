-- ====================================================================
-- SCHEMA GYM LIFEFITNESS - Producción (Railway MySQL)
-- ====================================================================
-- Para Railway: si la base de datos ya existe (creada por el servicio),
-- comenta las 3 líneas siguientes y ejecuta el script conectado a tu base.
-- ====================================================================
DROP DATABASE IF EXISTS gym_db;
CREATE DATABASE gym_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gym_db;

-- ====================================================================
-- TABLA DE USUARIOS DEL SISTEMA (admin/empleado)
-- ====================================================================
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NULL UNIQUE,
  role ENUM('admin', 'empleado') DEFAULT 'empleado',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  INDEX idx_username (username),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- TABLA DE CLIENTES (personas con membresías)
-- ====================================================================
CREATE TABLE clients (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  dni VARCHAR(20) UNIQUE,
  emergency_contact VARCHAR(100),
  emergency_phone VARCHAR(20),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  created_by INT,
  INDEX idx_username (username),
  INDEX idx_dni (dni),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- TABLA DE AVISOS
-- ====================================================================
CREATE TABLE notices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  type ENUM('info', 'warning', 'success') DEFAULT 'info',
  active BOOLEAN DEFAULT TRUE,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_active (active),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- TABLA DE CLASES
-- ====================================================================
CREATE TABLE classes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  instructor VARCHAR(255),
  day_of_week ENUM('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo') NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  capacity INT DEFAULT 20,
  active BOOLEAN DEFAULT TRUE,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_active (active),
  INDEX idx_day_of_week (day_of_week)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- TABLA DE INSTRUCTORES
-- ====================================================================
CREATE TABLE instructors (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  dni VARCHAR(20) UNIQUE NOT NULL,
  phone VARCHAR(30),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dni (dni),
  INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- TABLA DE PLANES
-- ====================================================================
CREATE TABLE plans (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  duration_days INT NOT NULL COMMENT 'Duración en días',
  price DECIMAL(10, 2) NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- TABLA DE RELACIÓN PLANES - INSTRUCTORES (muchos a muchos)
-- ====================================================================
CREATE TABLE plan_instructors (
  plan_id INT NOT NULL,
  instructor_id INT NOT NULL,
  PRIMARY KEY (plan_id, instructor_id),
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
  FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE,
  INDEX idx_plan_id (plan_id),
  INDEX idx_instructor_id (instructor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- TABLA DE SESIONES DE CAJA
-- ====================================================================
CREATE TABLE cash_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  opening_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  closing_amount DECIMAL(10, 2) NULL,
  expected_amount DECIMAL(10, 2) NULL,
  difference DECIMAL(10, 2) NULL,
  closing_cash DECIMAL(10, 2) NULL,
  closing_transfer DECIMAL(10, 2) NULL,
  closing_card DECIMAL(10, 2) NULL,
  status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_status (status),
  INDEX idx_user_id (user_id),
  INDEX idx_opened_at (opened_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- TABLA DE MOVIMIENTOS DE CAJA
-- ====================================================================
CREATE TABLE cash_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cash_session_id INT NOT NULL,
  type ENUM('income', 'expense', 'membership_payment', 'sale') NOT NULL,
  payment_method ENUM('cash', 'transfer', 'credit_card') NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT NOT NULL,
  reference VARCHAR(100) NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_cash_session (cash_session_id),
  INDEX idx_type (type),
  INDEX idx_payment_method (payment_method),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- TABLA DE MEMBRESÍAS (con todos los campos de pago incluidos)
-- ====================================================================
CREATE TABLE memberships (
  id INT PRIMARY KEY AUTO_INCREMENT,
  client_id INT NOT NULL,
  plan_id INT NOT NULL,
  instructor_id INT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('active', 'expired', 'cancelled') DEFAULT 'active',
  payment_method ENUM('cash', 'transfer', 'credit_card', 'current_account', 'combined') NULL,
  payment_status ENUM('pending', 'paid') NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP NULL,
  cash_movement_id INT NULL,
  notes TEXT,
  reminder_sent_days VARCHAR(20) NOT NULL DEFAULT '' COMMENT 'Días en que ya se envió recordatorio (ej: 5,3,1)',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE RESTRICT,
  FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (cash_movement_id) REFERENCES cash_movements(id) ON DELETE SET NULL,
  INDEX idx_client_id (client_id),
  INDEX idx_plan_id (plan_id),
  INDEX idx_status (status),
  INDEX idx_payment_status (payment_status),
  INDEX idx_end_date (end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- TABLA DE PAGOS POR MEMBRESÍA (pagos combinados)
-- ====================================================================
CREATE TABLE membership_payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  membership_id INT NOT NULL,
  payment_method ENUM('cash', 'transfer', 'credit_card', 'current_account') NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  cash_movement_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE CASCADE,
  FOREIGN KEY (cash_movement_id) REFERENCES cash_movements(id) ON DELETE SET NULL,
  INDEX idx_membership_id (membership_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- TABLA DE REGISTRO DE ENTRADAS (ingresos de clientes al gimnasio)
-- ====================================================================
CREATE TABLE client_entries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  client_id INT NOT NULL,
  membership_id INT NOT NULL,
  entered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_client_id (client_id),
  INDEX idx_membership_id (membership_id),
  INDEX idx_entered_at (entered_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migración para Sistema de Cuenta Corriente
-- Ejecutar después de las migraciones anteriores

-- Tabla de cuenta corriente (deudas y créditos de clientes)
CREATE TABLE IF NOT EXISTS current_account (
  id INT PRIMARY KEY AUTO_INCREMENT,
  client_id INT NOT NULL,
  membership_id INT NULL,
  type ENUM('debit', 'credit') NOT NULL, -- debit = debe, credit = pago/abono
  amount DECIMAL(10, 2) NOT NULL,
  description VARCHAR(255) NOT NULL,
  payment_method ENUM('cash', 'transfer', 'credit_card') NULL, -- solo para créditos/pagos
  cash_movement_id INT NULL, -- vincula con caja cuando se paga
  balance DECIMAL(10, 2) NOT NULL DEFAULT 0, -- saldo después de este movimiento
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE SET NULL,
  FOREIGN KEY (cash_movement_id) REFERENCES cash_movements(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_client (client_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Actualizar enum de método de pago en membresías para incluir cuenta corriente
ALTER TABLE memberships 
MODIFY COLUMN payment_method ENUM('cash', 'transfer', 'credit_card', 'current_account', 'combined') NULL;

-- ====================================================================
-- TABLA DE CATEGORÍAS (productos)
-- ====================================================================
CREATE TABLE categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_categories_name (name),
  INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- TABLA DE PRODUCTOS
-- ====================================================================
CREATE TABLE products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  category VARCHAR(100) NULL,
  sale_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  stock DECIMAL(12, 3) NOT NULL DEFAULT 0,
  min_stock DECIMAL(12, 3) NOT NULL DEFAULT 0,
  unit ENUM('unidad', 'kg') NOT NULL DEFAULT 'unidad',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_active (active),
  INDEX idx_code (code),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- TABLA DE MOVIMIENTOS DE STOCK
-- ====================================================================
CREATE TABLE stock_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  type ENUM('entrada', 'salida') NOT NULL,
  quantity DECIMAL(12, 3) NOT NULL,
  notes VARCHAR(255) NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_product_id (product_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- TABLA DE VENTAS
-- ====================================================================
CREATE TABLE sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  client_id INT NULL,
  cash_session_id INT NULL,
  cash_movement_id INT NULL,
  payment_method ENUM('cash', 'transfer', 'credit_card', 'current_account', 'combined') NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  discount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  status ENUM('completed', 'cancelled') NOT NULL DEFAULT 'completed',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (cash_movement_id) REFERENCES cash_movements(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- TABLA DE PAGOS POR VENTA (pagos combinados)
-- ====================================================================
CREATE TABLE sale_payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sale_id INT NOT NULL,
  payment_method ENUM('cash', 'transfer', 'credit_card', 'current_account') NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  cash_movement_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (cash_movement_id) REFERENCES cash_movements(id) ON DELETE SET NULL,
  INDEX idx_sale_id (sale_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- TABLA DE ÍTEMS DE VENTA
-- ====================================================================
CREATE TABLE sale_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  product_code VARCHAR(50) NOT NULL,
  quantity DECIMAL(12, 3) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'unidad',
  unit_price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  INDEX idx_sale_id (sale_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- DATOS DE PRUEBA - USUARIOS DEL SISTEMA
-- ====================================================================
-- Contraseña: admin123
INSERT INTO users (username, password, name, email, role) VALUES
('admin', '$2a$10$rZ5YpJQKz5YpJQKz5YpJQOzX5YpJQKz5YpJQKz5YpJQKz5YpJQKz5O', 'Administrador Principal', 'admin@lifefitness.com', 'admin'),
('empleado1', '$2a$10$rZ5YpJQKz5YpJQKz5YpJQOzX5YpJQKz5YpJQKz5YpJQKz5YpJQKz5O', 'Juan Pérez', 'juan@lifefitness.com', 'empleado');

-- ====================================================================
-- DATOS DE PRUEBA - CLIENTES
-- ====================================================================
-- Contraseña para todos: cliente123
INSERT INTO clients (username, password, name, phone, dni, created_by) VALUES
('cliente1', '$2a$10$rZ5YpJQKz5YpJQKz5YpJQOzX5YpJQKz5YpJQKz5YpJQKz5YpJQKz5O', 'María González', '555-0101', '12345678', 1),
('cliente2', '$2a$10$rZ5YpJQKz5YpJQOzX5YpJQKz5YpJQKz5YpJQKz5YpJQKz5YpJQKz5O', 'Carlos Rodríguez', '555-0102', '23456789', 1),
('cliente3', '$2a$10$rZ5YpJQKz5YpJQOzX5YpJQKz5YpJQKz5YpJQKz5YpJQKz5YpJQKz5O', 'Ana Martínez', '555-0103', '34567890', 1);

-- ====================================================================
-- DATOS DE EJEMPLO - AVISOS
-- ====================================================================
INSERT INTO notices (title, content, type, created_by) VALUES
('Bienvenido a Life Fitness', 'Nos alegra que formes parte de nuestra comunidad. Aquí encontrarás avisos importantes y el horario de clases.', 'success', 1),
('Horarios de atención', 'Estamos abiertos de Lunes a Viernes de 6:00 AM a 10:00 PM y Sábados y Domingos de 8:00 AM a 8:00 PM.', 'info', 1);

-- ====================================================================
-- DATOS DE EJEMPLO - CLASES
-- ====================================================================
INSERT INTO classes (name, description, instructor, day_of_week, start_time, end_time, capacity, created_by) VALUES
('Spinning', 'Clase de ciclismo indoor de alta intensidad', 'Carlos Rodríguez', 'Lunes', '07:00:00', '08:00:00', 25, 1),
('Yoga', 'Clase de yoga para todos los niveles', 'María González', 'Martes', '18:00:00', '19:00:00', 20, 1),
('CrossFit', 'Entrenamiento funcional de alta intensidad', 'Juan Pérez', 'Miércoles', '19:00:00', '20:00:00', 15, 1),
('Zumba', 'Baile fitness con ritmos latinos', 'Ana López', 'Jueves', '17:00:00', '18:00:00', 30, 1);

-- ====================================================================
-- DATOS DE EJEMPLO - PLANES
-- ====================================================================
INSERT INTO plans (name, duration_days, price, description) VALUES
('Plan Mensual', 30, 20000.00, 'Acceso completo al gimnasio durante 30 días'),
('Plan Diario', 1, 2000.00, 'Acceso al gimnasio por un día');
