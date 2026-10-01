-- =============================================================================
--  30_clinico.sql — Módulo de Control Clínico
--  Responsable: Daniela
--
--  Medicamentos, vacunas y vitaminas comparten una sola tabla (insumo_clinico)
--  porque tienen el mismo manejo de existencias, alertas y movimientos.
--  Se distinguen por el campo `tipo`.
--
--  Flujo: el veterinario registra una consulta -> diagnostica y define el
--  tratamiento -> aplica medicamentos, vacunas o vitaminas (cada aplicación
--  descuenta existencia) -> el estado de salud del animal se actualiza.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '-06:00';

CREATE TABLE insumo_clinico (
  id                       SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tipo                     ENUM('medicamento','vacuna','vitamina') NOT NULL,
  nombre                   VARCHAR(100)      NOT NULL,
  presentacion             VARCHAR(80)       NOT NULL DEFAULT '' COMMENT 'Ej. frasco 50 ml, tabletas 500 mg',
  unidad_medida            ENUM('ml','mg','g','tableta','dosis','unidad') NOT NULL,
  stock_actual             DECIMAL(10,2)     NOT NULL DEFAULT 0,
  stock_minimo             DECIMAL(10,2)     NOT NULL DEFAULT 0 COMMENT 'Al llegar a este valor se genera alerta',
  dosis_recomendada        VARCHAR(100)      NULL,
  enfermedad_previene      VARCHAR(120)      NULL COMMENT 'Solo vacunas',
  intervalo_refuerzo_dias  SMALLINT UNSIGNED NULL COMMENT 'Solo vacunas: días hasta la siguiente dosis',
  activo                   TINYINT(1)        NOT NULL DEFAULT 1,
  creado_en                DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en           DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_insumo_clinico (tipo, nombre, presentacion),
  CONSTRAINT ck_insumo_clinico_stock CHECK (stock_actual >= 0 AND stock_minimo >= 0),
  CONSTRAINT ck_insumo_clinico_vacuna CHECK (tipo = 'vacuna' OR (enfermedad_previene IS NULL AND intervalo_refuerzo_dias IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Medicamentos, vacunas y vitaminas con su existencia';

CREATE TABLE consulta_clinica (
  id                       INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  animal_id                INT UNSIGNED  NOT NULL,
  veterinario_id           INT UNSIGNED  NOT NULL,
  fecha                    DATETIME      NOT NULL,
  tipo                     ENUM('rutina','emergencia','seguimiento','ingreso') NOT NULL DEFAULT 'rutina',
  motivo                   VARCHAR(255)  NOT NULL,
  sintomas                 TEXT          NULL,
  diagnostico              TEXT          NULL,
  tratamiento              TEXT          NULL,
  peso_kg                  DECIMAL(8,2)  NULL,
  temperatura_c            DECIMAL(4,1)  NULL,
  estado_salud_resultante  ENUM('sano','en_observacion','en_tratamiento','critico') NOT NULL
                           COMMENT 'Se copia a animal.estado_salud al guardar la consulta',
  proxima_revision         DATE          NULL,
  observaciones            TEXT          NULL,
  creado_en                DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_consulta_animal_fecha (animal_id, fecha),
  KEY idx_consulta_veterinario (veterinario_id),
  KEY idx_consulta_revision (proxima_revision),
  CONSTRAINT fk_consulta_animal      FOREIGN KEY (animal_id)      REFERENCES animal (id),
  CONSTRAINT fk_consulta_veterinario FOREIGN KEY (veterinario_id) REFERENCES veterinario (usuario_id),
  CONSTRAINT ck_consulta_peso        CHECK (peso_kg IS NULL OR peso_kg > 0),
  CONSTRAINT ck_consulta_temperatura CHECK (temperatura_c IS NULL OR temperatura_c BETWEEN 10 AND 50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Consultas veterinarias. En conjunto forman el expediente clínico de cada animal';

CREATE TABLE aplicacion_clinica (
  id                 INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  animal_id          INT UNSIGNED      NOT NULL,
  insumo_clinico_id  SMALLINT UNSIGNED NOT NULL,
  veterinario_id     INT UNSIGNED      NOT NULL,
  consulta_id        INT UNSIGNED      NULL COMMENT 'Consulta en la que se indicó (opcional para vacunas de rutina)',
  dosis              DECIMAL(10,2)     NOT NULL COMMENT 'En la unidad de medida del insumo',
  via                ENUM('oral','intramuscular','subcutanea','intravenosa','topica','inhalada','otra') NOT NULL,
  fecha_aplicacion   DATETIME          NOT NULL,
  proxima_dosis      DATE              NULL COMMENT 'Base de las alertas de vacunas y tratamientos pendientes',
  observaciones      VARCHAR(255)      NULL,
  creado_en          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_aplicacion_animal_fecha (animal_id, fecha_aplicacion),
  KEY idx_aplicacion_insumo (insumo_clinico_id),
  KEY idx_aplicacion_proxima (proxima_dosis),
  CONSTRAINT fk_aplicacion_animal      FOREIGN KEY (animal_id)         REFERENCES animal (id),
  CONSTRAINT fk_aplicacion_insumo      FOREIGN KEY (insumo_clinico_id) REFERENCES insumo_clinico (id),
  CONSTRAINT fk_aplicacion_veterinario FOREIGN KEY (veterinario_id)    REFERENCES veterinario (usuario_id),
  CONSTRAINT fk_aplicacion_consulta    FOREIGN KEY (consulta_id)       REFERENCES consulta_clinica (id),
  CONSTRAINT ck_aplicacion_dosis       CHECK (dosis > 0),
  CONSTRAINT ck_aplicacion_proxima     CHECK (proxima_dosis IS NULL OR proxima_dosis >= DATE(fecha_aplicacion))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Cada aplicación de medicamento, vacuna o vitamina a un animal';

CREATE TABLE movimiento_clinico (
  id                 INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  insumo_clinico_id  SMALLINT UNSIGNED NOT NULL,
  tipo               ENUM('entrada','salida','merma') NOT NULL COMMENT 'entrada suma; salida y merma restan',
  cantidad           DECIMAL(10,2)     NOT NULL,
  aplicacion_id      INT UNSIGNED      NULL COMMENT 'Aplicación que originó la salida',
  numero_lote        VARCHAR(40)       NULL,
  fecha_vencimiento  DATE              NULL COMMENT 'Del lote recibido (entradas)',
  motivo             VARCHAR(255)      NULL,
  usuario_id         INT UNSIGNED      NOT NULL,
  fecha              DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mov_clinico_insumo_fecha (insumo_clinico_id, fecha),
  CONSTRAINT fk_mov_clinico_insumo     FOREIGN KEY (insumo_clinico_id) REFERENCES insumo_clinico (id),
  CONSTRAINT fk_mov_clinico_aplicacion FOREIGN KEY (aplicacion_id)     REFERENCES aplicacion_clinica (id),
  CONSTRAINT fk_mov_clinico_usuario    FOREIGN KEY (usuario_id)        REFERENCES usuario (id),
  CONSTRAINT ck_mov_clinico_cantidad   CHECK (cantidad > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Historial de entradas y salidas de medicamentos, vacunas y vitaminas';

-- =============================================================================
--  DATOS DE PRUEBA (fechas relativas al día en que se crea la BD)
--  Dejan a propósito: dos insumos bajo el mínimo, una vacuna con refuerzo
--  vencido y otra próxima, y a Simba en tratamiento.
-- =============================================================================

INSERT INTO insumo_clinico
  (id, tipo, nombre, presentacion, unidad_medida, stock_actual, stock_minimo, dosis_recomendada, enfermedad_previene, intervalo_refuerzo_dias) VALUES
  (1, 'medicamento', 'Amoxicilina',              'Frasco 100 ml, 50 mg/ml', 'ml',     180.00, 100.00, '10 mg/kg cada 12 h', NULL, NULL),
  (2, 'medicamento', 'Meloxicam',                'Frasco 20 ml, 5 mg/ml',   'ml',      12.00,  20.00, '0.1 mg/kg cada 24 h', NULL, NULL),
  (3, 'medicamento', 'Ivermectina',              'Frasco 50 ml, 1%',        'ml',      45.00,  15.00, '0.2 mg/kg dosis única', NULL, NULL),
  (4, 'medicamento', 'Metronidazol',             'Tabletas 500 mg',         'tableta', 40.00,  20.00, '15 mg/kg cada 12 h', NULL, NULL),
  (5, 'vacuna',      'Vacuna antirrábica',       'Dosis 1 ml',              'dosis',   14.00,   5.00, '1 ml', 'Rabia', 365),
  (6, 'vacuna',      'Vacuna triple felina',     'Dosis 1 ml',              'dosis',    3.00,   4.00, '1 ml', 'Panleucopenia, rinotraqueítis y calicivirus', 365),
  (7, 'vacuna',      'Vacuna contra clostridios','Dosis 2 ml',              'dosis',   20.00,   6.00, '2 ml', 'Clostridiosis', 180),
  (8, 'vitamina',    'Complejo B',               'Frasco 100 ml',           'ml',      90.00,  30.00, '1 ml por cada 10 kg', NULL, NULL),
  (9, 'vitamina',    'Vitamina E y selenio',     'Frasco 50 ml',            'ml',      35.00,  15.00, '1 ml por cada 45 kg', NULL, NULL);

INSERT INTO consulta_clinica
  (id, animal_id, veterinario_id, fecha, tipo, motivo, sintomas, diagnostico, tratamiento, peso_kg, temperatura_c,
   estado_salud_resultante, proxima_revision, observaciones) VALUES
  (1,  9, 3, TIMESTAMP(CURDATE() - INTERVAL 7 DAY, '09:30'), 'emergencia', 'Pérdida de apetito y vómito',
       'Vómito en dos ocasiones, decaimiento', 'Gastroenteritis bacteriana', 'Metronidazol por 10 días y dieta reducida',
       188.00, 39.4, 'en_tratamiento', CURDATE() + INTERVAL 3 DAY, 'Se indicó dieta particular en el módulo de alimentación'),
  (2,  4, 9, TIMESTAMP(CURDATE() - INTERVAL 3 DAY, '10:15'), 'rutina', 'Revisión por cojera leve',
       'Cojera en miembro posterior izquierdo', 'Contusión leve', 'Antiinflamatorio por 5 días',
       7.80, 37.9, 'en_observacion', CURDATE() + INTERVAL 4 DAY, NULL),
  (3,  1, 3, TIMESTAMP(CURDATE() - INTERVAL 30 DAY, '08:45'), 'rutina', 'Chequeo general semestral',
       NULL, 'Buen estado general', NULL, 92.50, 38.6, 'sano', NULL, NULL),
  (4, 15, 9, TIMESTAMP(CURDATE() - INTERVAL 12 DAY, '11:00'), 'rutina', 'Desparasitación programada',
       NULL, 'Sin hallazgos', 'Ivermectina dosis única', 250.00, 37.8, 'sano', NULL, NULL);

INSERT INTO aplicacion_clinica
  (id, animal_id, insumo_clinico_id, veterinario_id, consulta_id, dosis, via, fecha_aplicacion, proxima_dosis, observaciones) VALUES
  (1,  9, 4, 3, 1,    7.00, 'oral',          TIMESTAMP(CURDATE() - INTERVAL 7 DAY, '10:00'),  CURDATE() + INTERVAL 3 DAY,   'Mezclado con la carne'),
  (2,  4, 2, 9, 2,    0.16, 'subcutanea',    TIMESTAMP(CURDATE() - INTERVAL 3 DAY, '10:30'),  CURDATE() + INTERVAL 2 DAY,   NULL),
  (3, 15, 3, 9, 4,    5.00, 'subcutanea',    TIMESTAMP(CURDATE() - INTERVAL 12 DAY, '11:15'), NULL,                        NULL),
  (4,  1, 6, 3, NULL, 1.00, 'subcutanea',    TIMESTAMP(CURDATE() - INTERVAL 368 DAY, '09:00'), CURDATE() - INTERVAL 3 DAY, 'Refuerzo anual'),
  (5,  2, 6, 3, NULL, 1.00, 'subcutanea',    TIMESTAMP(CURDATE() - INTERVAL 360 DAY, '09:10'), CURDATE() + INTERVAL 5 DAY, 'Refuerzo anual'),
  (6,  6, 7, 9, NULL, 2.00, 'intramuscular', TIMESTAMP(CURDATE() - INTERVAL 100 DAY, '08:00'), CURDATE() + INTERVAL 80 DAY, NULL),
  (7, 11, 8, 9, NULL, 0.20, 'oral',          TIMESTAMP(CURDATE() - INTERVAL 20 DAY, '07:30'), NULL,                        'En el agua de bebida');

INSERT INTO movimiento_clinico (insumo_clinico_id, tipo, cantidad, aplicacion_id, numero_lote, fecha_vencimiento, motivo, usuario_id, fecha) VALUES
  (1, 'entrada', 200.00, NULL, 'AMX-2291', CURDATE() + INTERVAL 300 DAY, 'Compra trimestral', 3, TIMESTAMP(CURDATE() - INTERVAL 45 DAY, '09:00')),
  (4, 'entrada',  50.00, NULL, 'MTZ-0812', CURDATE() + INTERVAL 400 DAY, 'Compra trimestral', 3, TIMESTAMP(CURDATE() - INTERVAL 45 DAY, '09:00')),
  (4, 'salida',    7.00, 1,    NULL,       NULL,                         NULL,                3, TIMESTAMP(CURDATE() - INTERVAL 7 DAY, '10:00')),
  (2, 'salida',    0.16, 2,    NULL,       NULL,                         NULL,                9, TIMESTAMP(CURDATE() - INTERVAL 3 DAY, '10:30')),
  (3, 'salida',    5.00, 3,    NULL,       NULL,                         NULL,                9, TIMESTAMP(CURDATE() - INTERVAL 12 DAY, '11:15')),
  (8, 'salida',    0.20, 7,    NULL,       NULL,                         NULL,                9, TIMESTAMP(CURDATE() - INTERVAL 20 DAY, '07:30'));
