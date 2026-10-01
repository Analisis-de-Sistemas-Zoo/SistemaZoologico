-- =============================================================================
--  40_entradas.sql — Módulo de Gestión de Entradas y Promociones
--  Responsable: Mario
--
--  Canales de venta
--    * web:      el visitante compra desde el portal SIN crear cuenta. Se guardan
--                sus datos de contacto en `cliente` para enviarle las entradas.
--    * taquilla: el taquillero registra la venta (cliente opcional).
--  Cada persona recibe una `entrada` con un código QR único que se valida
--  al ingresar. El pago es simulado (prototipo).
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '-06:00';

CREATE TABLE tipo_entrada (
  id              TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(60)      NOT NULL,
  descripcion     VARCHAR(200)     NULL,
  precio          DECIMAL(10,2)    NOT NULL COMMENT 'Quetzales',
  activo          TINYINT(1)       NOT NULL DEFAULT 1,
  creado_en       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tipo_entrada_nombre (nombre),
  CONSTRAINT ck_tipo_entrada_precio CHECK (precio >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tipos de entrada y su precio';

CREATE TABLE promocion (
  id                    SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre                VARCHAR(100)      NOT NULL,
  descripcion           VARCHAR(255)      NULL,
  descuento_porcentaje  DECIMAL(5,2)      NOT NULL,
  tipo_entrada_id       TINYINT UNSIGNED  NULL COMMENT 'NULL = aplica a todos los tipos de entrada',
  cantidad_minima       TINYINT UNSIGNED  NOT NULL DEFAULT 1 COMMENT 'Entradas mínimas en la compra para aplicar',
  codigo                VARCHAR(20)       NULL COMMENT 'Cupón opcional que el cliente debe ingresar',
  fecha_inicio          DATE              NOT NULL,
  fecha_fin             DATE              NOT NULL,
  publicada             TINYINT(1)        NOT NULL DEFAULT 1 COMMENT 'Se muestra en el portal público',
  activa                TINYINT(1)        NOT NULL DEFAULT 1,
  creado_en             DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en        DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_promocion_codigo (codigo),
  KEY idx_promocion_vigencia (activa, fecha_inicio, fecha_fin),
  CONSTRAINT fk_promocion_tipo_entrada FOREIGN KEY (tipo_entrada_id) REFERENCES tipo_entrada (id),
  CONSTRAINT ck_promocion_descuento CHECK (descuento_porcentaje > 0 AND descuento_porcentaje <= 100),
  CONSTRAINT ck_promocion_fechas    CHECK (fecha_fin >= fecha_inicio),
  CONSTRAINT ck_promocion_cantidad  CHECK (cantidad_minima >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Promociones y descuentos con vigencia';

CREATE TABLE cliente (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nombre     VARCHAR(120)  NOT NULL,
  correo     VARCHAR(120)  NOT NULL,
  telefono   VARCHAR(20)   NULL,
  nit        VARCHAR(20)   NOT NULL DEFAULT 'CF',
  creado_en  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cliente_correo (correo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Datos de contacto de quien compra en línea. No tiene usuario ni contraseña';

CREATE TABLE compra (
  id                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  codigo            VARCHAR(20)   NOT NULL COMMENT 'Número de compra visible, ej. MS-000123',
  canal             ENUM('web','taquilla') NOT NULL,
  cliente_id        INT UNSIGNED  NULL COMMENT 'Obligatorio en ventas web',
  vendedor_id       INT UNSIGNED  NULL COMMENT 'Taquillero; obligatorio en ventas de taquilla',
  fecha             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_visita      DATE          NOT NULL,
  subtotal          DECIMAL(10,2) NOT NULL,
  descuento         DECIMAL(10,2) NOT NULL DEFAULT 0,
  total             DECIMAL(10,2) NOT NULL,
  metodo_pago       ENUM('tarjeta','efectivo','transferencia') NOT NULL,
  referencia_pago   VARCHAR(60)   NULL COMMENT 'Autorización simulada de la tarjeta',
  estado            ENUM('pagada','anulada') NOT NULL DEFAULT 'pagada',
  motivo_anulacion  VARCHAR(255)  NULL,
  anulado_por_id    INT UNSIGNED  NULL,
  fecha_anulacion   DATETIME      NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_compra_codigo (codigo),
  KEY idx_compra_fecha (fecha),
  KEY idx_compra_visita (fecha_visita),
  KEY idx_compra_cliente (cliente_id),
  CONSTRAINT fk_compra_cliente  FOREIGN KEY (cliente_id)     REFERENCES cliente (id),
  CONSTRAINT fk_compra_vendedor FOREIGN KEY (vendedor_id)    REFERENCES usuario (id),
  CONSTRAINT fk_compra_anulador FOREIGN KEY (anulado_por_id) REFERENCES usuario (id),
  CONSTRAINT ck_compra_canal_web      CHECK (canal <> 'web' OR cliente_id IS NOT NULL),
  CONSTRAINT ck_compra_canal_taquilla CHECK (canal <> 'taquilla' OR vendedor_id IS NOT NULL),
  CONSTRAINT ck_compra_montos         CHECK (subtotal >= 0 AND descuento >= 0 AND descuento <= subtotal AND total = subtotal - descuento),
  CONSTRAINT ck_compra_anulacion      CHECK (estado <> 'anulada' OR (motivo_anulacion IS NOT NULL AND anulado_por_id IS NOT NULL AND fecha_anulacion IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Ventas de entradas por la web o en taquilla';

CREATE TABLE detalle_compra (
  id               INT UNSIGNED       NOT NULL AUTO_INCREMENT,
  compra_id        INT UNSIGNED       NOT NULL,
  tipo_entrada_id  TINYINT UNSIGNED   NOT NULL,
  promocion_id     SMALLINT UNSIGNED  NULL,
  cantidad         SMALLINT UNSIGNED  NOT NULL,
  precio_unitario  DECIMAL(10,2)      NOT NULL COMMENT 'Precio vigente al momento de la compra',
  descuento        DECIMAL(10,2)      NOT NULL DEFAULT 0 COMMENT 'Monto total descontado en esta línea',
  subtotal         DECIMAL(10,2)      NOT NULL COMMENT 'cantidad x precio_unitario - descuento',
  PRIMARY KEY (id),
  KEY idx_detalle_compra (compra_id),
  KEY idx_detalle_tipo (tipo_entrada_id),
  KEY idx_detalle_promocion (promocion_id),
  CONSTRAINT fk_detalle_compra    FOREIGN KEY (compra_id)       REFERENCES compra (id),
  CONSTRAINT fk_detalle_tipo      FOREIGN KEY (tipo_entrada_id) REFERENCES tipo_entrada (id),
  CONSTRAINT fk_detalle_promocion FOREIGN KEY (promocion_id)    REFERENCES promocion (id),
  CONSTRAINT ck_detalle_cantidad  CHECK (cantidad > 0),
  CONSTRAINT ck_detalle_montos    CHECK (precio_unitario >= 0 AND descuento >= 0 AND subtotal = cantidad * precio_unitario - descuento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Líneas de cada compra por tipo de entrada';

CREATE TABLE entrada (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  detalle_id    INT UNSIGNED  NOT NULL,
  codigo_qr     CHAR(32)      NOT NULL COMMENT 'Código aleatorio único que contiene el QR',
  estado        ENUM('vigente','usada','anulada') NOT NULL DEFAULT 'vigente'
                COMMENT 'Una entrada vigente con fecha de visita pasada se considera vencida',
  fecha_uso     DATETIME      NULL,
  validador_id  INT UNSIGNED  NULL COMMENT 'Taquillero que validó el ingreso',
  PRIMARY KEY (id),
  UNIQUE KEY uq_entrada_qr (codigo_qr),
  KEY idx_entrada_detalle (detalle_id),
  CONSTRAINT fk_entrada_detalle   FOREIGN KEY (detalle_id)   REFERENCES detalle_compra (id),
  CONSTRAINT fk_entrada_validador FOREIGN KEY (validador_id) REFERENCES usuario (id),
  CONSTRAINT ck_entrada_uso CHECK (estado <> 'usada' OR (fecha_uso IS NOT NULL AND validador_id IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Una entrada por persona, identificada con un código QR';

-- =============================================================================
--  DATOS DE PRUEBA (fechas relativas al día en que se crea la BD)
-- =============================================================================

INSERT INTO tipo_entrada (id, nombre, descripcion, precio) VALUES
  (1, 'Adulto',       'De 13 a 59 años',                         40.00),
  (2, 'Niño',         'De 3 a 12 años. Menores de 3 no pagan',   20.00),
  (3, 'Estudiante',   'Presentando carné vigente',               25.00),
  (4, 'Adulto mayor', 'De 60 años en adelante',                  20.00);

INSERT INTO promocion
  (id, nombre, descripcion, descuento_porcentaje, tipo_entrada_id, cantidad_minima, codigo, fecha_inicio, fecha_fin, publicada) VALUES
  (1, 'Paquete familiar',        'Comprando 4 entradas o más, 15% de descuento en todas',  15.00, NULL, 4, NULL,
      CURDATE() - INTERVAL 10 DAY,  CURDATE() + INTERVAL 20 DAY, 1),
  (2, 'Estudiantes entre semana','20% en entradas de estudiante',                          20.00, 3,    1, NULL,
      CURDATE() - INTERVAL 5 DAY,   CURDATE() + INTERVAL 60 DAY, 1),
  (3, 'Feria de Jutiapa',        '10% con el cupón FERIA2026',                             10.00, NULL, 1, 'FERIA2026',
      CURDATE() + INTERVAL 5 DAY,   CURDATE() + INTERVAL 15 DAY, 1),
  (4, 'Vacaciones de medio año', '25% en entradas de niño',                                25.00, 2,    1, NULL,
      CURDATE() - INTERVAL 120 DAY, CURDATE() - INTERVAL 90 DAY, 1);

INSERT INTO cliente (id, nombre, correo, telefono, nit) VALUES
  (1, 'Familia Orellana',  'gorellana@correo.gt', '5544-1122', 'CF'),
  (2, 'Daniel Monterroso', 'dmonte@correo.gt',    '4410-7788', '8812345-6'),
  (3, 'Karla Juárez',      'kjuarez@correo.gt',   NULL,        'CF');

INSERT INTO compra
  (id, codigo, canal, cliente_id, vendedor_id, fecha, fecha_visita, subtotal, descuento, total, metodo_pago, referencia_pago,
   estado, motivo_anulacion, anulado_por_id, fecha_anulacion) VALUES
  (1, 'MS-000001', 'web',      1,    NULL, TIMESTAMP(CURDATE() - INTERVAL 3 DAY, '20:15'), CURDATE() - INTERVAL 1 DAY, 120.00, 18.00, 102.00, 'tarjeta',  'AUT-558120', 'pagada',  NULL, NULL, NULL),
  (2, 'MS-000002', 'taquilla', NULL, 8,    TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '09:40'), CURDATE() - INTERVAL 1 DAY,  60.00,  0.00,  60.00, 'efectivo', NULL,         'pagada',  NULL, NULL, NULL),
  (3, 'MS-000003', 'web',      2,    NULL, TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '18:02'), CURDATE() + INTERVAL 2 DAY,  75.00, 15.00,  60.00, 'tarjeta',  'AUT-559004', 'pagada',  NULL, NULL, NULL),
  (4, 'MS-000004', 'web',      3,    NULL, TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '21:30'), CURDATE(),                   80.00,  0.00,  80.00, 'tarjeta',  'AUT-559117', 'pagada',  NULL, NULL, NULL),
  (5, 'MS-000005', 'taquilla', NULL, 8,    TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '11:05'), CURDATE() - INTERVAL 2 DAY,  20.00,  0.00,  20.00, 'efectivo', NULL,         'anulada', 'Cobro duplicado', 1, TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '11:20'));

INSERT INTO detalle_compra (id, compra_id, tipo_entrada_id, promocion_id, cantidad, precio_unitario, descuento, subtotal) VALUES
  (1, 1, 1, 1,    2, 40.00, 12.00, 68.00),
  (2, 1, 2, 1,    2, 20.00,  6.00, 34.00),
  (3, 2, 1, NULL, 1, 40.00,  0.00, 40.00),
  (4, 2, 4, NULL, 1, 20.00,  0.00, 20.00),
  (5, 3, 3, 2,    3, 25.00, 15.00, 60.00),
  (6, 4, 1, NULL, 2, 40.00,  0.00, 80.00),
  (7, 5, 2, NULL, 1, 20.00,  0.00, 20.00);

-- Los códigos QR reales se generan en el servidor con crypto.randomBytes(16).
INSERT INTO entrada (detalle_id, codigo_qr, estado, fecha_uso, validador_id) VALUES
  (1, MD5('seed-entrada-01'), 'usada',   TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '10:12'), 8),
  (1, MD5('seed-entrada-02'), 'usada',   TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '10:12'), 8),
  (2, MD5('seed-entrada-03'), 'usada',   TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '10:13'), 8),
  (2, MD5('seed-entrada-04'), 'usada',   TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '10:13'), 8),
  (3, MD5('seed-entrada-05'), 'usada',   TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '09:41'), 8),
  (4, MD5('seed-entrada-06'), 'usada',   TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '09:41'), 8),
  (5, MD5('seed-entrada-07'), 'vigente', NULL, NULL),
  (5, MD5('seed-entrada-08'), 'vigente', NULL, NULL),
  (5, MD5('seed-entrada-09'), 'vigente', NULL, NULL),
  (6, MD5('seed-entrada-10'), 'vigente', NULL, NULL),
  (6, MD5('seed-entrada-11'), 'vigente', NULL, NULL),
  (7, MD5('seed-entrada-12'), 'anulada', NULL, NULL);
