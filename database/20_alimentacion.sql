-- =============================================================================
--  20_alimentacion.sql — Módulo de Gestión de Alimentación
--  Responsable: Mijeli
--
--  Requerimientos cubiertos
--    RF-ALI-01  dieta                    (por especie o por animal)
--    RF-ALI-02  horario_alimentacion     (por jaula, con cuidador responsable)
--    RF-ALI-03  registro_alimentacion    (cada ración suministrada)
--    RF-ALI-04  movimiento_alimento      (consumo descontado por lote, sin negativos)
--    RF-ALI-05  alimento, lote_alimento  (productos y entradas por compra)
--    RF-ALI-06  proveedor
--    RF-ALI-07  vista_existencia_alimento + fechas de vencimiento de lote_alimento
--    RF-ALI-08  consultas sobre registro_alimentacion, lote_alimento y la vista
--
--  Reglas de negocio
--    * La existencia de un alimento es la suma de cantidad_disponible de sus lotes
--      no vencidos. No se guarda un stock total aparte para que nunca se desincronice.
--    * Al registrar una ración se descuenta del lote más próximo a vencer (FEFO)
--      y se guarda un movimiento de consumo por cada lote afectado.
--    * Si un animal tiene dietas activas propias, esas reemplazan a las de su especie.
--    * Una dieta con frecuencia_diaria = N se sirve en los primeros N horarios del día
--      de la jaula donde vive el animal.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '-06:00';

CREATE TABLE proveedor (
  id              SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(120)      NOT NULL,
  nit             VARCHAR(20)       NULL,
  contacto        VARCHAR(100)      NULL COMMENT 'Persona de contacto',
  telefono        VARCHAR(20)       NULL,
  correo          VARCHAR(120)      NULL,
  direccion       VARCHAR(200)      NULL,
  activo          TINYINT(1)        NOT NULL DEFAULT 1,
  creado_en       DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_proveedor_nombre (nombre),
  UNIQUE KEY uq_proveedor_nit (nit)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Proveedores de alimentos para los animales';

CREATE TABLE alimento (
  id                      SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre                  VARCHAR(100)      NOT NULL,
  categoria               ENUM('carne','pescado','fruta','verdura','forraje','grano','insecto','presa','concentrado','suplemento','otro') NOT NULL,
  unidad_medida           ENUM('kg','g','l','unidad') NOT NULL DEFAULT 'kg',
  stock_minimo            DECIMAL(10,3)     NOT NULL DEFAULT 0 COMMENT 'Al llegar a este valor se genera alerta de stock',
  dias_aviso_vencimiento  SMALLINT UNSIGNED NOT NULL DEFAULT 7 COMMENT 'Días antes del vencimiento en que se genera alerta',
  descripcion             VARCHAR(255)      NULL,
  activo                  TINYINT(1)        NOT NULL DEFAULT 1,
  creado_en               DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_alimento_nombre (nombre),
  CONSTRAINT ck_alimento_minimo CHECK (stock_minimo >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Catálogo de productos alimenticios';

CREATE TABLE lote_alimento (
  id                   INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  alimento_id          SMALLINT UNSIGNED NOT NULL,
  proveedor_id         SMALLINT UNSIGNED NOT NULL,
  numero_lote          VARCHAR(40)       NOT NULL,
  numero_factura       VARCHAR(40)       NULL,
  fecha_ingreso        DATE              NOT NULL,
  fecha_vencimiento    DATE              NULL COMMENT 'NULL si el producto no vence',
  cantidad_inicial     DECIMAL(10,3)     NOT NULL,
  cantidad_disponible  DECIMAL(10,3)     NOT NULL COMMENT 'Se reduce con cada consumo o merma',
  costo_unitario       DECIMAL(10,2)     NULL COMMENT 'Quetzales por unidad de medida',
  usuario_id           INT UNSIGNED      NOT NULL COMMENT 'Encargado de bodega que registró la entrada',
  observaciones        VARCHAR(255)      NULL,
  creado_en            DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lote_alimento_numero (alimento_id, numero_lote),
  KEY idx_lote_fefo (alimento_id, fecha_vencimiento),
  KEY idx_lote_proveedor (proveedor_id),
  CONSTRAINT fk_lote_alimento  FOREIGN KEY (alimento_id)  REFERENCES alimento (id),
  CONSTRAINT fk_lote_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedor (id),
  CONSTRAINT fk_lote_usuario   FOREIGN KEY (usuario_id)   REFERENCES usuario (id),
  CONSTRAINT ck_lote_cantidades  CHECK (cantidad_inicial > 0 AND cantidad_disponible >= 0 AND cantidad_disponible <= cantidad_inicial),
  CONSTRAINT ck_lote_vencimiento CHECK (fecha_vencimiento IS NULL OR fecha_vencimiento >= fecha_ingreso),
  CONSTRAINT ck_lote_costo       CHECK (costo_unitario IS NULL OR costo_unitario >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Cada entrada de alimento por compra. Es también el historial de compras por proveedor';

CREATE TABLE dieta (
  id                 INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  especie_id         SMALLINT UNSIGNED NULL COMMENT 'Dieta general de la especie',
  animal_id          INT UNSIGNED      NULL COMMENT 'Dieta particular de un animal (reemplaza a la de su especie)',
  alimento_id        SMALLINT UNSIGNED NOT NULL,
  cantidad_racion    DECIMAL(10,3)     NOT NULL COMMENT 'Cantidad por ración en la unidad del alimento',
  frecuencia_diaria  TINYINT UNSIGNED  NOT NULL DEFAULT 1 COMMENT 'Raciones por día',
  indicaciones       VARCHAR(255)      NULL COMMENT 'Forma de preparación o entrega',
  motivo             VARCHAR(255)      NULL COMMENT 'Razón de la dieta o del cambio (ej. indicación clínica)',
  veterinario_id     INT UNSIGNED      NOT NULL COMMENT 'Veterinario que definió la dieta',
  fecha_inicio       DATE              NOT NULL,
  fecha_fin          DATE              NULL,
  activa             TINYINT(1)        NOT NULL DEFAULT 1,
  creado_en          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en     DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_dieta_especie (especie_id, activa),
  KEY idx_dieta_animal (animal_id, activa),
  KEY idx_dieta_alimento (alimento_id),
  CONSTRAINT fk_dieta_especie     FOREIGN KEY (especie_id)     REFERENCES especie (id),
  CONSTRAINT fk_dieta_animal      FOREIGN KEY (animal_id)      REFERENCES animal (id),
  CONSTRAINT fk_dieta_alimento    FOREIGN KEY (alimento_id)    REFERENCES alimento (id),
  CONSTRAINT fk_dieta_veterinario FOREIGN KEY (veterinario_id) REFERENCES veterinario (usuario_id),
  CONSTRAINT ck_dieta_destino     CHECK ((especie_id IS NULL) <> (animal_id IS NULL)),
  CONSTRAINT ck_dieta_racion      CHECK (cantidad_racion > 0),
  CONSTRAINT ck_dieta_frecuencia  CHECK (frecuencia_diaria BETWEEN 1 AND 12),
  CONSTRAINT ck_dieta_fechas      CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dietas definidas por el veterinario para una especie o para un animal en particular';

CREATE TABLE horario_alimentacion (
  id              INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  area_id         SMALLINT UNSIGNED NOT NULL COMMENT 'Jaula o recinto',
  hora            TIME              NOT NULL,
  dias            SET('lun','mar','mie','jue','vie','sab','dom') NOT NULL DEFAULT 'lun,mar,mie,jue,vie,sab,dom',
  cuidador_id     INT UNSIGNED      NOT NULL COMMENT 'Cuidador responsable',
  observaciones   VARCHAR(255)      NULL,
  activo          TINYINT(1)        NOT NULL DEFAULT 1,
  creado_en       DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_horario_area_hora (area_id, hora),
  KEY idx_horario_cuidador (cuidador_id),
  CONSTRAINT fk_horario_area     FOREIGN KEY (area_id)     REFERENCES area (id),
  CONSTRAINT fk_horario_cuidador FOREIGN KEY (cuidador_id) REFERENCES usuario (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Horarios de alimentación de cada jaula y su cuidador responsable';

CREATE TABLE registro_alimentacion (
  id                     INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  dieta_id               INT UNSIGNED  NOT NULL,
  animal_id              INT UNSIGNED  NOT NULL,
  horario_id             INT UNSIGNED  NULL COMMENT 'Turno al que corresponde; NULL si fue una ración fuera de horario',
  usuario_id             INT UNSIGNED  NOT NULL COMMENT 'Cuidador que suministró la ración',
  fecha                  DATE          NOT NULL,
  hora                   TIME          NOT NULL,
  cantidad_suministrada  DECIMAL(10,3) NOT NULL,
  consumo                ENUM('completo','parcial','nulo') NOT NULL DEFAULT 'completo' COMMENT 'Lo que el animal consumió de la ración',
  observaciones          VARCHAR(255)  NULL,
  creado_en              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_registro_turno (animal_id, dieta_id, horario_id, fecha),
  KEY idx_registro_fecha (fecha),
  KEY idx_registro_dieta (dieta_id),
  KEY idx_registro_usuario (usuario_id),
  CONSTRAINT fk_registro_dieta   FOREIGN KEY (dieta_id)   REFERENCES dieta (id),
  CONSTRAINT fk_registro_animal  FOREIGN KEY (animal_id)  REFERENCES animal (id),
  CONSTRAINT fk_registro_horario FOREIGN KEY (horario_id) REFERENCES horario_alimentacion (id),
  CONSTRAINT fk_registro_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id),
  CONSTRAINT ck_registro_cantidad CHECK (cantidad_suministrada > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Cada ración suministrada a un animal (trazabilidad del consumo)';

CREATE TABLE movimiento_alimento (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  lote_id      INT UNSIGNED  NOT NULL,
  tipo         ENUM('entrada','consumo','merma') NOT NULL COMMENT 'entrada suma; consumo y merma restan',
  cantidad     DECIMAL(10,3) NOT NULL,
  registro_id  INT UNSIGNED  NULL COMMENT 'Ración que originó el consumo',
  motivo       VARCHAR(255)  NULL COMMENT 'Obligatorio para las mermas',
  usuario_id   INT UNSIGNED  NOT NULL,
  fecha        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mov_alimento_lote_fecha (lote_id, fecha),
  KEY idx_mov_alimento_registro (registro_id),
  CONSTRAINT fk_mov_alimento_lote     FOREIGN KEY (lote_id)     REFERENCES lote_alimento (id),
  CONSTRAINT fk_mov_alimento_registro FOREIGN KEY (registro_id) REFERENCES registro_alimentacion (id),
  CONSTRAINT fk_mov_alimento_usuario  FOREIGN KEY (usuario_id)  REFERENCES usuario (id),
  CONSTRAINT ck_mov_alimento_cantidad CHECK (cantidad > 0),
  CONSTRAINT ck_mov_alimento_consumo  CHECK (tipo <> 'consumo' OR registro_id IS NOT NULL),
  CONSTRAINT ck_mov_alimento_merma    CHECK (tipo <> 'merma' OR motivo IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Historial de entradas, consumos y mermas de cada lote';

-- -----------------------------------------------------------------------------
-- Existencia actual por alimento (base de alertas y reportes)
-- -----------------------------------------------------------------------------
CREATE VIEW vista_existencia_alimento AS
SELECT
  a.id                          AS alimento_id,
  a.nombre,
  a.categoria,
  a.unidad_medida,
  a.stock_minimo,
  a.dias_aviso_vencimiento,
  COALESCE(SUM(CASE WHEN l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= CURDATE()
                    THEN l.cantidad_disponible END), 0)                       AS existencia,
  COALESCE(SUM(CASE WHEN l.fecha_vencimiento < CURDATE()
                    THEN l.cantidad_disponible END), 0)                       AS existencia_vencida,
  MIN(CASE WHEN l.cantidad_disponible > 0 AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= CURDATE())
           THEN l.fecha_vencimiento END)                                       AS proximo_vencimiento,
  SUM(CASE WHEN l.cantidad_disponible > 0 THEN 1 ELSE 0 END)                  AS lotes_con_existencia
FROM alimento a
LEFT JOIN lote_alimento l ON l.alimento_id = a.id
WHERE a.activo = 1
GROUP BY a.id;

-- =============================================================================
--  DATOS DE PRUEBA (fechas relativas al día en que se crea la BD)
--  Dejan a propósito: carne de res y suplemento bajo el mínimo, un lote de
--  pescado vencido y varios lotes próximos a vencer, para ver las alertas.
-- =============================================================================

INSERT INTO proveedor (id, nombre, nit, contacto, telefono, correo, direccion) VALUES
  (1, 'Carnicería La Ganadera',              '4521873-1', 'Marco Tulio Ávila',  '7844-1020', 'ventas@laganadera.gt',     'Barrio El Centro, Jutiapa'),
  (2, 'Distribuidora Agrícola del Oriente',  '7810345-6', 'Silvia Recinos',     '7842-3311', 'pedidos@agrooriente.gt',   'Km 117 carretera a El Salvador'),
  (3, 'Pescadería del Pacífico',             '3398120-K', 'Hugo Barrientos',    '7881-5540', NULL,                       'Mercado municipal, local 14'),
  (4, 'Forrajes San Jorge',                  '6612907-2', 'Jorge Lemus',        '5512-8890', 'forrajessanjorge@mail.gt', 'Aldea San Jorge, Jutiapa'),
  (5, 'Agroservicio El Progreso',            '2210458-9', 'Lucía Morán',        '7843-0077', 'agroprogreso@mail.gt',     'El Progreso, Jutiapa'),
  (6, 'Bioterio Centroamericano',            '9034112-4', 'Dra. Elena Paz',     '2365-4410', 'ventas@bioterioca.com',    'Zona 12, Ciudad de Guatemala');

INSERT INTO alimento (id, nombre, categoria, unidad_medida, stock_minimo, dias_aviso_vencimiento, descripcion) VALUES
  ( 1, 'Carne de res',                  'carne',       'kg',     40.000,  3, 'Cortes sin hueso'),
  ( 2, 'Pollo entero',                  'carne',       'kg',     25.000,  3, NULL),
  ( 3, 'Pescado fresco (tilapia)',      'pescado',     'kg',     15.000,  2, NULL),
  ( 4, 'Frutas mixtas',                 'fruta',       'kg',     30.000,  3, 'Papaya, banano, mango y sandía'),
  ( 5, 'Verduras mixtas',               'verdura',     'kg',     20.000,  4, 'Zanahoria, güisquil y camote'),
  ( 6, 'Heno de alfalfa',               'forraje',     'kg',    150.000, 30, 'Pacas de 20 kg'),
  ( 7, 'Concentrado para herbívoros',   'concentrado', 'kg',     60.000, 30, NULL),
  ( 8, 'Mezcla de semillas para aves',  'grano',       'kg',     10.000, 60, NULL),
  ( 9, 'Ratones congelados',            'presa',       'unidad', 20.000, 30, 'Mantener a -18 °C'),
  (10, 'Suplemento vitamínico',         'suplemento',  'kg',      2.000, 90, 'Polvo para mezclar con la ración'),
  (11, 'Ramas y follaje de ramoneo',    'forraje',     'kg',     40.000,  2, 'Acacia, morera y guácimo');

INSERT INTO lote_alimento
  (id, alimento_id, proveedor_id, numero_lote, numero_factura, fecha_ingreso, fecha_vencimiento,
   cantidad_inicial, cantidad_disponible, costo_unitario, usuario_id, observaciones) VALUES
  ( 1,  1, 1, 'CR-001', 'F-1021', CURDATE() - INTERVAL  3 DAY, CURDATE() + INTERVAL   4 DAY,  72.000,  35.000, 38.50, 5, NULL),
  ( 2,  2, 1, 'PO-001', 'F-1022', CURDATE() - INTERVAL  2 DAY, CURDATE() + INTERVAL   2 DAY,  60.000,  60.000, 22.00, 5, NULL),
  ( 3,  3, 3, 'PE-001', 'B-0456', CURDATE() - INTERVAL  6 DAY, CURDATE() - INTERVAL   1 DAY,   3.000,   3.000, 30.00, 5, 'Sobrante sin usar'),
  ( 4,  3, 3, 'PE-002', 'B-0471', CURDATE() - INTERVAL  1 DAY, CURDATE() + INTERVAL   2 DAY,  15.000,  15.000, 30.00, 5, NULL),
  ( 5,  4, 2, 'FR-001', 'A-7781', CURDATE() - INTERVAL  2 DAY, CURDATE() + INTERVAL   3 DAY,  80.000,  76.600,  6.50, 5, NULL),
  ( 6,  5, 2, 'VE-001', 'A-7781', CURDATE() - INTERVAL  2 DAY, CURDATE() + INTERVAL   5 DAY,  50.000,  49.400,  5.00, 5, NULL),
  ( 7,  6, 4, 'HE-001', 'FS-332', CURDATE() - INTERVAL 20 DAY, CURDATE() + INTERVAL  70 DAY, 400.000, 370.000,  3.25, 5, NULL),
  ( 8,  6, 4, 'HE-002', 'FS-348', CURDATE() - INTERVAL  5 DAY, CURDATE() + INTERVAL  85 DAY, 300.000, 300.000,  3.25, 5, NULL),
  ( 9,  7, 5, 'CO-001', 'EP-910', CURDATE() - INTERVAL 15 DAY, CURDATE() + INTERVAL 120 DAY, 200.000, 198.500,  7.80, 5, NULL),
  (10,  8, 5, 'SE-001', 'EP-910', CURDATE() - INTERVAL 30 DAY, CURDATE() + INTERVAL 150 DAY,  25.000,  25.000, 12.00, 5, NULL),
  (11,  9, 6, 'RA-001', 'BC-118', CURDATE() - INTERVAL 10 DAY, CURDATE() + INTERVAL  60 DAY,  60.000,  60.000,  9.00, 5, NULL),
  (12, 10, 5, 'SU-001', 'EP-887', CURDATE() - INTERVAL 40 DAY, CURDATE() + INTERVAL 200 DAY,   1.580,   1.500, 95.00, 5, NULL),
  (13, 11, 4, 'RM-001', 'FS-350', CURDATE() - INTERVAL  1 DAY, CURDATE() + INTERVAL   1 DAY,  80.000,  80.000,  1.50, 5, 'Cortado el día de ingreso');

-- Dietas: generales por especie, y una particular para Simba (león en tratamiento)
INSERT INTO dieta
  (id, especie_id, animal_id, alimento_id, cantidad_racion, frecuencia_diaria, indicaciones, motivo, veterinario_id, fecha_inicio) VALUES
  ( 1,  1, NULL,  1,  4.000, 1, 'En trozos grandes, a temperatura ambiente',  NULL, 3, CURDATE() - INTERVAL 60 DAY),
  ( 2,  1, NULL, 10,  0.020, 1, 'Espolvorear sobre la carne',                 NULL, 3, CURDATE() - INTERVAL 60 DAY),
  ( 3,  2, NULL,  4,  1.200, 2, 'Fruta picada, repartida en varios puntos',  NULL, 9, CURDATE() - INTERVAL 60 DAY),
  ( 4,  2, NULL,  5,  0.300, 1, NULL,                                         NULL, 9, CURDATE() - INTERVAL 60 DAY),
  ( 5,  3, NULL,  2,  3.000, 1, 'Entero, solo martes y viernes',             NULL, 3, CURDATE() - INTERVAL 60 DAY),
  ( 6,  4, NULL,  6, 12.000, 2, 'En comedero elevado',                       NULL, 9, CURDATE() - INTERVAL 60 DAY),
  ( 7,  4, NULL, 11,  8.000, 1, 'Colgar las ramas a 3 m de altura',          NULL, 9, CURDATE() - INTERVAL 60 DAY),
  ( 8,  5, NULL,  6,  6.000, 2, NULL,                                         NULL, 9, CURDATE() - INTERVAL 60 DAY),
  ( 9,  5, NULL,  7,  1.500, 1, NULL,                                         NULL, 9, CURDATE() - INTERVAL 60 DAY),
  (10,  6, NULL,  1,  6.000, 1, 'En trozos grandes',                         NULL, 3, CURDATE() - INTERVAL 60 DAY),
  (11, NULL,  9,  1,  4.500, 1, 'Ración reducida, sin hueso',
       'Dieta reducida durante tratamiento digestivo', 3, CURDATE() - INTERVAL 7 DAY),
  (12,  7, NULL,  4,  0.150, 2, NULL,                                         NULL, 9, CURDATE() - INTERVAL 60 DAY),
  (13,  7, NULL,  8,  0.050, 1, NULL,                                         NULL, 9, CURDATE() - INTERVAL 60 DAY),
  (14,  8, NULL,  4,  0.120, 2, 'Trozos pequeños',                           NULL, 9, CURDATE() - INTERVAL 60 DAY),
  (15,  9, NULL,  9,  2.000, 1, 'Descongelar a temperatura ambiente',        NULL, 3, CURDATE() - INTERVAL 60 DAY),
  (16, 10, NULL,  5,  4.000, 2, NULL,                                         NULL, 9, CURDATE() - INTERVAL 60 DAY),
  (17, 10, NULL,  4,  3.000, 1, NULL,                                         NULL, 9, CURDATE() - INTERVAL 60 DAY),
  (18, 11, NULL,  7,  1.000, 1, NULL,                                         NULL, 9, CURDATE() - INTERVAL 60 DAY),
  (19, 11, NULL, 11,  2.000, 1, NULL,                                         NULL, 9, CURDATE() - INTERVAL 60 DAY);

INSERT INTO horario_alimentacion (id, area_id, hora, dias, cuidador_id, observaciones) VALUES
  ( 1, 1, '16:00', 'lun,mar,mie,jue,vie,sab,dom', 4,  NULL),
  ( 2, 2, '08:00', 'lun,mar,mie,jue,vie,sab,dom', 4,  NULL),
  ( 3, 2, '14:00', 'lun,mar,mie,jue,vie,sab,dom', 4,  NULL),
  ( 4, 3, '11:00', 'mar,vie',                     10, 'Alimentar desde la plataforma de seguridad'),
  ( 5, 4, '07:30', 'lun,mar,mie,jue,vie,sab,dom', 10, NULL),
  ( 6, 4, '15:30', 'lun,mar,mie,jue,vie,sab,dom', 10, NULL),
  ( 7, 5, '16:30', 'lun,mar,mie,jue,vie,sab,dom', 10, 'Entrar solo con el recinto de manejo cerrado'),
  ( 8, 6, '07:00', 'lun,mar,mie,jue,vie,sab,dom', 4,  NULL),
  ( 9, 6, '13:00', 'lun,mar,mie,jue,vie,sab,dom', 4,  NULL),
  (10, 7, '10:00', 'dom',                         10, NULL),
  (11, 8, '08:30', 'lun,mar,mie,jue,vie,sab,dom', 4,  NULL),
  (12, 8, '15:00', 'lun,mar,mie,jue,vie,sab,dom', 4,  NULL);

-- Raciones de los dos días anteriores
INSERT INTO registro_alimentacion
  (id, dieta_id, animal_id, horario_id, usuario_id, fecha, hora, cantidad_suministrada, consumo, observaciones) VALUES
  ( 1,  1,  1, 1,  4, CURDATE() - INTERVAL 2 DAY, '16:05',  4.000, 'completo', NULL),
  ( 2,  2,  1, 1,  4, CURDATE() - INTERVAL 2 DAY, '16:05',  0.020, 'completo', NULL),
  ( 3,  1,  2, 1,  4, CURDATE() - INTERVAL 2 DAY, '16:07',  4.000, 'completo', NULL),
  ( 4,  2,  2, 1,  4, CURDATE() - INTERVAL 2 DAY, '16:07',  0.020, 'completo', NULL),
  ( 5, 11,  9, 7, 10, CURDATE() - INTERVAL 2 DAY, '16:35',  4.500, 'completo', NULL),
  ( 6, 10, 10, 7, 10, CURDATE() - INTERVAL 2 DAY, '16:36',  6.000, 'completo', NULL),
  ( 7,  1,  1, 1,  4, CURDATE() - INTERVAL 1 DAY, '16:02',  4.000, 'completo', NULL),
  ( 8,  2,  1, 1,  4, CURDATE() - INTERVAL 1 DAY, '16:02',  0.020, 'completo', NULL),
  ( 9,  1,  2, 1,  4, CURDATE() - INTERVAL 1 DAY, '16:04',  4.000, 'parcial',  'Dejó cerca de medio kilo'),
  (10,  2,  2, 1,  4, CURDATE() - INTERVAL 1 DAY, '16:04',  0.020, 'completo', NULL),
  (11, 11,  9, 7, 10, CURDATE() - INTERVAL 1 DAY, '16:33',  4.500, 'parcial',  'Sigue con poco apetito'),
  (12, 10, 10, 7, 10, CURDATE() - INTERVAL 1 DAY, '16:34',  6.000, 'completo', NULL),
  (13,  3,  3, 2,  4, CURDATE() - INTERVAL 1 DAY, '08:03',  1.200, 'completo', NULL),
  (14,  4,  3, 2,  4, CURDATE() - INTERVAL 1 DAY, '08:03',  0.300, 'completo', NULL),
  (15,  3,  4, 2,  4, CURDATE() - INTERVAL 1 DAY, '08:05',  1.200, 'parcial',  'Comió la mitad de la fruta'),
  (16,  4,  4, 2,  4, CURDATE() - INTERVAL 1 DAY, '08:05',  0.300, 'completo', NULL),
  (17,  6,  6, 5, 10, CURDATE() - INTERVAL 1 DAY, '07:35', 12.000, 'completo', NULL),
  (18,  6,  7, 5, 10, CURDATE() - INTERVAL 1 DAY, '07:36', 12.000, 'completo', NULL),
  (19,  8,  8, 5, 10, CURDATE() - INTERVAL 1 DAY, '07:38',  6.000, 'completo', NULL),
  (20,  9,  8, 5, 10, CURDATE() - INTERVAL 1 DAY, '07:38',  1.500, 'completo', NULL);

-- Movimientos: entrada de cada lote ...
INSERT INTO movimiento_alimento (lote_id, tipo, cantidad, registro_id, motivo, usuario_id, fecha)
SELECT id, 'entrada', cantidad_inicial, NULL, CONCAT('Compra, factura ', numero_factura), usuario_id, TIMESTAMP(fecha_ingreso, '09:00')
  FROM lote_alimento;

-- ... consumo de cada ración (todas salieron del lote más próximo a vencer de su alimento) ...
INSERT INTO movimiento_alimento (lote_id, tipo, cantidad, registro_id, motivo, usuario_id, fecha)
SELECT (SELECT l.id FROM lote_alimento l
          WHERE l.alimento_id = d.alimento_id
          ORDER BY l.fecha_vencimiento, l.id LIMIT 1),
       'consumo', r.cantidad_suministrada, r.id, NULL, r.usuario_id, TIMESTAMP(r.fecha, r.hora)
  FROM registro_alimentacion r
  JOIN dieta d ON d.id = r.dieta_id;

-- ... y una merma
INSERT INTO movimiento_alimento (lote_id, tipo, cantidad, registro_id, motivo, usuario_id, fecha) VALUES
  (5, 'merma', 1.000, NULL, 'Fruta en mal estado al abrir las cajas', 5, TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '10:15'));
