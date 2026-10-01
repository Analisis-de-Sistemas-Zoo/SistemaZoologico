-- =============================================================================
--  02_core_seed.sql — Datos iniciales del núcleo
--
--  Crea los roles y un usuario de prueba por rol.
--  Contraseña de TODOS los usuarios de prueba:  Zoo2026!
--  (Para generar otro hash usa:  npm run hash -- "MiContraseña")
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '-06:00';

INSERT INTO rol (id, codigo, nombre, descripcion) VALUES
  (1, 'administrador',       'Administrador',          'Gestiona usuarios, configuración y tiene acceso general al sistema'),
  (2, 'director',            'Director',               'Consulta reportes y supervisa la operación del zoológico'),
  (3, 'veterinario',         'Veterinario',            'Define dietas y lleva el control clínico de los animales'),
  (4, 'cuidador',            'Cuidador',               'Registra la alimentación suministrada a los animales'),
  (5, 'encargado_bodega',    'Encargado de bodega',    'Controla el inventario de alimentos y los proveedores'),
  (6, 'supervisor_limpieza', 'Supervisor de limpieza', 'Programa y verifica las tareas de limpieza'),
  (7, 'personal_limpieza',   'Personal de limpieza',   'Ejecuta y reporta las tareas de limpieza asignadas'),
  (8, 'taquillero',          'Taquillero',             'Vende y valida entradas en taquilla');

INSERT INTO usuario (rol_id, nombres, apellidos, usuario, correo, password_hash) VALUES
  (1, 'Ana Lucía',  'Morales Pérez',   'admin',       'admin@miradasalvaje.gt',       '$2a$10$80Pel47OWJurDhYbeJVGwOmCsa8C4oVpPLTfCVzMoD94EKWXQy7ky'),
  (2, 'Roberto',    'Castillo Méndez', 'director',    'director@miradasalvaje.gt',    '$2a$10$80Pel47OWJurDhYbeJVGwOmCsa8C4oVpPLTfCVzMoD94EKWXQy7ky'),
  (3, 'Patricia',   'Ortiz Ramírez',  'veterinario', 'veterinario@miradasalvaje.gt', '$2a$10$80Pel47OWJurDhYbeJVGwOmCsa8C4oVpPLTfCVzMoD94EKWXQy7ky'),
  (4, 'Carlos',     'Hernández López', 'cuidador',    'cuidador@miradasalvaje.gt',    '$2a$10$80Pel47OWJurDhYbeJVGwOmCsa8C4oVpPLTfCVzMoD94EKWXQy7ky'),
  (5, 'María José', 'Ruiz Aguilar',    'bodega',      'bodega@miradasalvaje.gt',      '$2a$10$80Pel47OWJurDhYbeJVGwOmCsa8C4oVpPLTfCVzMoD94EKWXQy7ky'),
  (6, 'Jorge',      'Guzmán Flores',   'suplimpieza', 'suplimpieza@miradasalvaje.gt', '$2a$10$80Pel47OWJurDhYbeJVGwOmCsa8C4oVpPLTfCVzMoD94EKWXQy7ky'),
  (7, 'Luis',       'Martínez Cruz',   'limpieza',    'limpieza@miradasalvaje.gt',    '$2a$10$80Pel47OWJurDhYbeJVGwOmCsa8C4oVpPLTfCVzMoD94EKWXQy7ky'),
  (8, 'Sofía',      'Valdez Ramos',    'taquilla',    'taquilla@miradasalvaje.gt',    '$2a$10$80Pel47OWJurDhYbeJVGwOmCsa8C4oVpPLTfCVzMoD94EKWXQy7ky');
