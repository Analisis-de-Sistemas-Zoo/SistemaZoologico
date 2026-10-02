-- =============================================================================
--  01_core.sql — Núcleo del sistema y catálogos compartidos
--  Zoológico "Mirada Salvaje"
--
--  Convenciones de toda la base de datos
--    * Tablas en singular y minúscula:            especie, registro_alimentacion
--    * Llave primaria:                             id
--    * Llave foránea:                              <tabla>_id   (especie_id)
--    * Fechas de control:                          creado_en, actualizado_en
--    * Registros de catálogo no se borran:         activo = 0
--    * Cantidades:                                 DECIMAL (nunca FLOAT)
--
--  Orden de carga: 01_core -> 02_core_seed -> 10_limpieza -> 20_alimentacion
--                  -> 30_clinico -> 40_entradas
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '-06:00';

-- =============================================================================
--  SEGURIDAD
-- =============================================================================

CREATE TABLE rol (
  id           TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo       VARCHAR(30)      NOT NULL COMMENT 'Identificador usado en el código (server/config/permisos.js)',
  nombre       VARCHAR(60)      NOT NULL,
  descripcion  VARCHAR(255)     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rol_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Roles del personal. Definen a qué módulos y acciones tiene acceso cada usuario';

CREATE TABLE usuario (
  id                 INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  rol_id             TINYINT UNSIGNED NOT NULL,
  nombres            VARCHAR(80)      NOT NULL,
  apellidos          VARCHAR(80)      NOT NULL,
  usuario            VARCHAR(40)      NOT NULL COMMENT 'Nombre de inicio de sesión',
  correo             VARCHAR(120)     NOT NULL,
  password_hash      VARCHAR(255)     NOT NULL COMMENT 'Contraseña cifrada con bcrypt',
  activo             TINYINT(1)       NOT NULL DEFAULT 1,
  intentos_fallidos  TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Intentos fallidos consecutivos de inicio de sesión',
  bloqueado_hasta    DATETIME         NULL     COMMENT 'Bloqueo temporal tras varios intentos fallidos',
  ultimo_acceso      DATETIME         NULL,
  creado_en          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuario_usuario (usuario),
  UNIQUE KEY uq_usuario_correo (correo),
  KEY idx_usuario_rol (rol_id),
  CONSTRAINT fk_usuario_rol FOREIGN KEY (rol_id) REFERENCES rol (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Cuentas del personal del zoológico. Los visitantes no tienen cuenta';

CREATE TABLE sesion (
  sid        VARCHAR(128)  NOT NULL,
  usuario_id INT UNSIGNED  NULL,
  expira     DATETIME      NOT NULL,
  datos      TEXT          NOT NULL,
  PRIMARY KEY (sid),
  KEY idx_sesion_expira (expira),
  KEY idx_sesion_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Sesiones activas. Las administra el servidor';

CREATE TABLE bitacora (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id      INT UNSIGNED    NULL     COMMENT 'NULL cuando la acción ocurre sin sesión (ej. intento de login)',
  modulo          VARCHAR(30)     NOT NULL,
  accion          VARCHAR(30)     NOT NULL COMMENT 'CREAR, ACTUALIZAR, ELIMINAR, LOGIN, ACCESO_DENEGADO, etc.',
  tabla_afectada  VARCHAR(60)     NULL,
  registro_id     VARCHAR(40)     NULL,
  detalle         TEXT            NULL     COMMENT 'Datos del cambio en formato JSON',
  ip              VARCHAR(45)     NULL,
  fecha           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bitacora_fecha (fecha),
  KEY idx_bitacora_modulo (modulo),
  KEY idx_bitacora_usuario (usuario_id),
  CONSTRAINT fk_bitacora_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Auditoría de todas las acciones realizadas en el sistema';

CREATE TABLE veterinario (
  usuario_id     INT UNSIGNED  NOT NULL COMMENT 'Usuario con rol veterinario',
  num_colegiado  VARCHAR(20)   NOT NULL COMMENT 'Número de colegiado activo',
  especialidad   VARCHAR(100)  NULL,
  PRIMARY KEY (usuario_id),
  UNIQUE KEY uq_veterinario_colegiado (num_colegiado),
  CONSTRAINT fk_veterinario_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Datos profesionales de los usuarios con rol veterinario';

-- =============================================================================
--  CATÁLOGOS COMPARTIDOS (los usan todos los módulos)
--  Jerarquía:  habitat  >  area (jaula)  >  animal
-- =============================================================================

CREATE TABLE habitat (
  id             SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre         VARCHAR(80)       NOT NULL,
  tipo           ENUM('selva','sabana','bosque','desierto','acuatico','aviario','montana','herpetario','granja') NOT NULL,
  descripcion    VARCHAR(255)      NULL,
  ubicacion      VARCHAR(100)      NULL COMMENT 'Referencia dentro del zoológico (ej. sector norte)',
  capacidad_max  SMALLINT UNSIGNED NULL COMMENT 'Número máximo de animales',
  activo         TINYINT(1)        NOT NULL DEFAULT 1,
  creado_en      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_habitat_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Zonas temáticas del zoológico que agrupan jaulas y recintos';

CREATE TABLE area (
  id             SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  habitat_id     SMALLINT UNSIGNED NULL COMMENT 'Obligatorio solo para las jaulas',
  nombre         VARCHAR(80)       NOT NULL,
  tipo           ENUM('jaula','sanitario','jardin','area_juegos','oficina','bodega','clinica','otra') NOT NULL
                 COMMENT 'jaula incluye jaulas, recintos y estanques donde viven animales',
  ubicacion      VARCHAR(100)      NULL,
  descripcion    VARCHAR(255)      NULL,
  activo         TINYINT(1)        NOT NULL DEFAULT 1,
  creado_en      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_area_nombre (nombre),
  KEY idx_area_tipo (tipo),
  KEY idx_area_habitat (habitat_id),
  CONSTRAINT fk_area_habitat FOREIGN KEY (habitat_id) REFERENCES habitat (id),
  CONSTRAINT ck_area_jaula_habitat CHECK (tipo <> 'jaula' OR habitat_id IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Lugares físicos del zoológico. Se usan en limpieza (todas) y en alimentación (jaulas)';

CREATE TABLE especie (
  id                   SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre_comun         VARCHAR(100)      NOT NULL,
  nombre_cientifico    VARCHAR(120)      NOT NULL,
  clasificacion        ENUM('mamifero','ave','reptil','anfibio','pez','invertebrado') NOT NULL,
  tipo_dieta           ENUM('carnivoro','herbivoro','omnivoro','insectivoro','piscivoro','frugivoro','granivoro','nectarivoro') NOT NULL,
  estado_conservacion  ENUM('LC','NT','VU','EN','CR','EW','DD') NULL COMMENT 'Categoría de la Lista Roja de la UICN',
  descripcion          VARCHAR(500)      NULL,
  activo               TINYINT(1)        NOT NULL DEFAULT 1,
  creado_en            DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en       DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_especie_cientifico (nombre_cientifico)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Especies animales que alberga el zoológico';

CREATE TABLE animal (
  id                INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  codigo            VARCHAR(20)       NOT NULL COMMENT 'Identificador visible, ej. ANI-0001',
  nombre            VARCHAR(80)       NOT NULL,
  especie_id        SMALLINT UNSIGNED NOT NULL,
  area_id           SMALLINT UNSIGNED NOT NULL COMMENT 'Jaula o recinto donde vive',
  sexo              ENUM('macho','hembra','desconocido') NOT NULL DEFAULT 'desconocido',
  fecha_nacimiento  DATE              NULL,
  fecha_ingreso     DATE              NOT NULL,
  procedencia       VARCHAR(120)      NULL COMMENT 'Nacido en el zoológico, rescate, intercambio, etc.',
  peso_kg           DECIMAL(8,2)      NULL,
  estado_salud      ENUM('sano','en_observacion','en_tratamiento','critico') NOT NULL DEFAULT 'sano'
                    COMMENT 'Lo actualiza el módulo de Control Clínico',
  estado            ENUM('activo','trasladado','fallecido') NOT NULL DEFAULT 'activo',
  observaciones     VARCHAR(500)      NULL,
  creado_en         DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_animal_codigo (codigo),
  KEY idx_animal_especie (especie_id),
  KEY idx_animal_area (area_id),
  KEY idx_animal_estado (estado),
  CONSTRAINT fk_animal_especie FOREIGN KEY (especie_id) REFERENCES especie (id),
  CONSTRAINT fk_animal_area FOREIGN KEY (area_id) REFERENCES area (id),
  CONSTRAINT ck_animal_peso CHECK (peso_kg IS NULL OR peso_kg > 0),
  CONSTRAINT ck_animal_fechas CHECK (fecha_nacimiento IS NULL OR fecha_nacimiento <= fecha_ingreso)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Animales del zoológico';
