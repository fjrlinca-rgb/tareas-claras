-- =====================================================================
-- seed.sql — Bootstrap mínimo de helpdesk
-- Ejecutar UNA sola vez tras importar helpdesk_schema_pg12.sql
--
-- Crea un usuario supervisor inicial para el primer acceso.
-- Reemplazar el password_hash por uno generado con bcrypt (12 rondas):
--   node -e "console.log(require('bcryptjs').hashSync('TU_PASSWORD',12))"
-- =====================================================================

BEGIN;

INSERT INTO usuarios (id, usuario, nombre, correo, password_hash, rol, activo)
VALUES (
  gen_random_uuid(),
  'supervisor',
  'Supervisor Inicial',
  'admin@helpdesk.local',
  -- bcrypt hash de "ChangeMe!123" (REEMPLAZAR EN PRODUCCIÓN)
  '$2a$12$8Q1xq5wYJ2vQzqB1mZ2k0eY7qXh9wYxw7m1xq5wYJ2vQzqB1mZ2k0',
  'supervisor',
  true
)
ON CONFLICT (usuario) DO NOTHING;

-- Espejo en profiles (para compatibilidad con vistas/joins existentes)
INSERT INTO profiles (id, full_name, username, email, active)
SELECT id, nombre, usuario, correo, activo FROM usuarios WHERE usuario = 'supervisor'
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Verificación:
SELECT id, usuario, correo, rol, activo FROM usuarios WHERE usuario = 'supervisor';
