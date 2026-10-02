-- =============================================================================
--  10_limpieza.sql — Módulo de Gestión de Limpieza
--  Responsable: Alan
--
--  Flujo: el supervisor programa una tarea en un área y la asigna a una persona
--  del personal de limpieza -> el personal la inicia y la completa, registrando
--  los insumos usados -> el supervisor la verifica o la rechaza.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '-06:00';

CREATE TABLE insumo_limpieza (
  id              SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(100)      NOT NULL,
  unidad_medida   ENUM('l','ml','kg','g','galon','unidad') NOT NULL,
  stock_actual    DECIMAL(10,2)     NOT NULL DEFAULT 0,
  stock_minimo    DECIMAL(10,2)     NOT NULL DEFAULT 0 COMMENT 'Al llegar a este valor se genera alerta',
  descripcion     VARCHAR(255)      NULL,
  activo          TINYINT(1)        NOT NULL DEFAULT 1,
  creado_en       DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_insumo_limpieza_nombre (nombre),
  CONSTRAINT ck_insumo_limpieza_stock CHECK (stock_actual >= 0 AND stock_minimo >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Productos e insumos de limpieza con su existencia';

CREATE TABLE tarea_limpieza (
  id                         INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  area_id                    SMALLINT UNSIGNED NOT NULL,
  tipo                       ENUM('rutinaria','profunda','desinfeccion','emergencia') NOT NULL DEFAULT 'rutinaria',
  descripcion                VARCHAR(255)      NULL COMMENT 'Indicaciones específicas para la tarea',
  fecha_programada           DATE              NOT NULL,
  hora_programada            TIME              NOT NULL,
  asignado_id                INT UNSIGNED      NOT NULL COMMENT 'Usuario del personal de limpieza que la ejecuta',
  programado_por_id          INT UNSIGNED      NOT NULL COMMENT 'Usuario que programó la tarea',
  estado                     ENUM('pendiente','en_proceso','completada','verificada','rechazada','cancelada') NOT NULL DEFAULT 'pendiente',
  inicio_real                DATETIME          NULL,
  fin_real                   DATETIME          NULL,
  observaciones              VARCHAR(500)      NULL COMMENT 'Lo que reporta quien ejecuta la tarea',
  verificado_por_id          INT UNSIGNED      NULL COMMENT 'Supervisor que verificó o rechazó la tarea',
  fecha_verificacion         DATETIME          NULL,
  observacion_verificacion   VARCHAR(500)      NULL,
  creado_en                  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en             DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tarea_fecha_estado (fecha_programada, estado),
  KEY idx_tarea_area (area_id),
  KEY idx_tarea_asignado (asignado_id),
  CONSTRAINT fk_tarea_area        FOREIGN KEY (area_id)           REFERENCES area (id),
  CONSTRAINT fk_tarea_asignado    FOREIGN KEY (asignado_id)       REFERENCES usuario (id),
  CONSTRAINT fk_tarea_programador FOREIGN KEY (programado_por_id) REFERENCES usuario (id),
  CONSTRAINT fk_tarea_verificador FOREIGN KEY (verificado_por_id) REFERENCES usuario (id),
  CONSTRAINT ck_tarea_tiempos      CHECK (fin_real IS NULL OR inicio_real IS NULL OR fin_real >= inicio_real),
  CONSTRAINT ck_tarea_finalizada   CHECK (estado NOT IN ('completada','verificada','rechazada') OR fin_real IS NOT NULL),
  CONSTRAINT ck_tarea_verificacion CHECK (estado NOT IN ('verificada','rechazada') OR verificado_por_id IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tareas de limpieza programadas por área, con su ejecución y verificación';

CREATE TABLE tarea_insumo (
  tarea_id            INT UNSIGNED      NOT NULL,
  insumo_limpieza_id  SMALLINT UNSIGNED NOT NULL,
  cantidad_usada      DECIMAL(10,2)     NOT NULL,
  PRIMARY KEY (tarea_id, insumo_limpieza_id),
  KEY idx_tarea_insumo_insumo (insumo_limpieza_id),
  CONSTRAINT fk_tarea_insumo_tarea  FOREIGN KEY (tarea_id)           REFERENCES tarea_limpieza (id) ON DELETE CASCADE,
  CONSTRAINT fk_tarea_insumo_insumo FOREIGN KEY (insumo_limpieza_id) REFERENCES insumo_limpieza (id),
  CONSTRAINT ck_tarea_insumo_cantidad CHECK (cantidad_usada > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Insumos de limpieza consumidos en cada tarea';

CREATE TABLE movimiento_insumo_limpieza (
  id                  INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  insumo_limpieza_id  SMALLINT UNSIGNED NOT NULL,
  tipo                ENUM('entrada','salida','merma') NOT NULL COMMENT 'entrada suma al stock; salida y merma restan',
  cantidad            DECIMAL(10,2)     NOT NULL,
  tarea_id            INT UNSIGNED      NULL COMMENT 'Tarea en la que se usó (salidas)',
  motivo              VARCHAR(255)      NULL,
  usuario_id          INT UNSIGNED      NOT NULL COMMENT 'Quién registró el movimiento',
  fecha               DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mov_limpieza_insumo_fecha (insumo_limpieza_id, fecha),
  CONSTRAINT fk_mov_limpieza_insumo  FOREIGN KEY (insumo_limpieza_id) REFERENCES insumo_limpieza (id),
  CONSTRAINT fk_mov_limpieza_tarea   FOREIGN KEY (tarea_id)           REFERENCES tarea_limpieza (id),
  CONSTRAINT fk_mov_limpieza_usuario FOREIGN KEY (usuario_id)         REFERENCES usuario (id),
  CONSTRAINT ck_mov_limpieza_cantidad CHECK (cantidad > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Historial de entradas y salidas de insumos de limpieza';

-- =============================================================================
--  DATOS DE PRUEBA (las fechas son relativas al día en que se crea la BD)
-- =============================================================================

INSERT INTO insumo_limpieza (id, nombre, unidad_medida, stock_actual, stock_minimo, descripcion) VALUES
  (1, 'Desinfectante de amonio cuaternario', 'l',      18.00, 10.00, 'Apto para recintos con animales'),
  (2, 'Cloro',                               'l',       6.00, 10.00, 'Solo para sanitarios y áreas públicas'),
  (3, 'Jabón líquido para manos',            'l',      25.00,  8.00, NULL),
  (4, 'Papel higiénico',                     'unidad', 140.00, 100.00, 'Rollo doble hoja'),
  (5, 'Bolsas de basura grandes',            'unidad',  60.00,  80.00, NULL),
  (6, 'Detergente biodegradable',            'kg',      12.00,  5.00, NULL);

INSERT INTO tarea_limpieza
  (id, area_id, tipo, descripcion, fecha_programada, hora_programada, asignado_id, programado_por_id, estado,
   inicio_real, fin_real, observaciones, verificado_por_id, fecha_verificacion, observacion_verificacion) VALUES
  (1,  1, 'rutinaria',    'Retirar desechos y lavar poza',       CURDATE() - INTERVAL 1 DAY, '07:00', 7, 6, 'verificada',
       TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '07:05'), TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '07:50'), NULL,
       6, TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '09:00'), 'Trabajo completo'),
  (2, 11, 'rutinaria',    'Limpiar fuentes y barrer senderos',   CURDATE() - INTERVAL 1 DAY, '15:00', 11, 6, 'rechazada',
       TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '15:10'), TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '15:45'), NULL,
       6, TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '16:30'), 'Quedaron hojas en las fuentes'),
  (3, 13, 'rutinaria',    NULL,                                  CURDATE() - INTERVAL 1 DAY, '17:00', 11, 6, 'completada',
       TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '17:00'), TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '17:40'), 'Sin novedades',
       NULL, NULL, NULL),
  (4,  9, 'rutinaria',    'Reponer papel y jabón',               CURDATE(),                  '08:00', 11, 6, 'pendiente',
       NULL, NULL, NULL, NULL, NULL, NULL),
  (5, 15, 'desinfeccion', 'Desinfección completa de sala de procedimientos', CURDATE(),      '07:30', 7, 6, 'pendiente',
       NULL, NULL, NULL, NULL, NULL, NULL),
  (6,  4, 'profunda',     'Limpieza profunda de comederos',      CURDATE(),                  '09:00', 7, 6, 'pendiente',
       NULL, NULL, NULL, NULL, NULL, NULL),
  (7, 12, 'rutinaria',    NULL,                                  CURDATE(),                  '10:00', 11, 6, 'pendiente',
       NULL, NULL, NULL, NULL, NULL, NULL),
  (8,  2, 'rutinaria',    'Retirar restos de fruta',             CURDATE() + INTERVAL 1 DAY, '07:00', 7, 6, 'pendiente',
       NULL, NULL, NULL, NULL, NULL, NULL);

INSERT INTO tarea_insumo (tarea_id, insumo_limpieza_id, cantidad_usada) VALUES
  (1, 1, 2.00), (1, 5, 3.00),
  (2, 5, 4.00),
  (3, 6, 0.50), (3, 5, 2.00);

INSERT INTO movimiento_insumo_limpieza (insumo_limpieza_id, tipo, cantidad, tarea_id, motivo, usuario_id, fecha) VALUES
  (1, 'entrada', 20.00, NULL, 'Compra mensual',       6, TIMESTAMP(CURDATE() - INTERVAL 10 DAY, '10:00')),
  (5, 'entrada', 69.00, NULL, 'Compra mensual',       6, TIMESTAMP(CURDATE() - INTERVAL 10 DAY, '10:00')),
  (6, 'entrada', 12.50, NULL, 'Compra mensual',       6, TIMESTAMP(CURDATE() - INTERVAL 10 DAY, '10:00')),
  (1, 'salida',   2.00, 1,    NULL,                   7, TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '07:50')),
  (5, 'salida',   3.00, 1,    NULL,                   7, TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '07:50')),
  (5, 'salida',   4.00, 2,    NULL,                  11, TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '15:45')),
  (6, 'salida',   0.50, 3,    NULL,                  11, TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '17:40')),
  (5, 'salida',   2.00, 3,    NULL,                  11, TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '17:40'));
