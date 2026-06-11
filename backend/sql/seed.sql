-- =====================================================================
-- HelpDesk · seed inicial (idempotente)
-- Crea usuario supervisor por defecto. Cambia la contraseña en producción.
-- Usuario: supervisor
-- Password: Admin12345!
-- Hash bcrypt (cost 12) pre-generado para Admin12345!
-- =====================================================================

INSERT INTO usuarios (id, usuario, nombre, correo, password_hash, rol, activo)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'supervisor',
  'Supervisor inicial',
  'supervisor@helpdesk.local',
  '$2a$12$Yx7r1Q0Y7hHj4yPq7Yp1d.k5JmO9oVZQX5p3HfV9fZK0bC2u4j8pe',
  'supervisor',
  true
)
ON CONFLICT (usuario) DO NOTHING;

INSERT INTO profiles (id, full_name, username, email, active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Supervisor inicial',
  'supervisor',
  'supervisor@helpdesk.local',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'supervisor'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;
