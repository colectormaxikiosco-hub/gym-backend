-- Registro de recordatorios de membresía enviados por WhatsApp (5, 3, 1 días).
-- Guarda por ejemplo "5,3,1" cuando ya se envió el recordatorio a los 5, 3 y 1 día(s).
ALTER TABLE memberships
ADD COLUMN reminder_sent_days VARCHAR(20) NOT NULL DEFAULT '' COMMENT 'Días en que ya se envió recordatorio (ej: 5,3,1)';
