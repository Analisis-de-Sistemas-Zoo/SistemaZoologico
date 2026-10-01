-- =============================================================================
--  01_core.sql — Núcleo compartido del sistema
--  Zoológico "Mirada Salvaje"
--
--  PROVISIONAL: estas tablas se ajustarán al modelo entidad-relación final.
--  Contiene solo lo que necesita el núcleo (roles, usuarios, sesiones y bitácora).
--  Las tablas de cada módulo van en su propio archivo (10_, 20_, 30_, 40_).
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '-06:00';

-- -----------------------------------------------------------------------------
-- rol — Roles del personal. El visitante no tiene cuenta.
-- Los permisos de cada rol se definen en server/config/permisos.js
-- -----------------------------------------------------------------------------
CREATE TABLE rol (
  id           TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo       VARCHAR(30)      NOT NULL,
  nombre       VARCHAR(60)      NOT NULL,
  descripcion  VARCHAR(255)     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rol_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- usuario — Cuentas del personal del zoológico
-- -----------------------------------------------------------------------------
CREATE TABLE usuario (
  id                 INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  rol_id             TINYINT UNSIGNED NOT NULL,
  nombres            VARCHAR(80)      NOT NULL,
  apellidos          VARCHAR(80)      NOT NULL,
  usuario            VARCHAR(40)      NOT NULL,
  correo             VARCHAR(120)     NOT NULL,
  password_hash      VARCHAR(255)     NOT NULL,
  activo             TINYINT(1)       NOT NULL DEFAULT 1,
  intentos_fallidos  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  bloqueado_hasta    DATETIME         NULL,
  ultimo_acceso      DATETIME         NULL,
  creado_en          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuario_usuario (usuario),
  UNIQUE KEY uq_usuario_correo (correo),
  KEY idx_usuario_rol (rol_id),
  CONSTRAINT fk_usuario_rol FOREIGN KEY (rol_id) REFERENCES rol (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- sesion — Sesiones activas (las administra el servidor, no se tocan a mano)
-- -----------------------------------------------------------------------------
CREATE TABLE sesion (
  sid        VARCHAR(128)  NOT NULL,
  usuario_id INT UNSIGNED  NULL,
  expira     DATETIME      NOT NULL,
  datos      TEXT          NOT NULL,
  PRIMARY KEY (sid),
  KEY idx_sesion_expira (expira),
  KEY idx_sesion_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- bitacora — Registro de auditoría de todas las acciones (RNF de seguridad)
-- -----------------------------------------------------------------------------
CREATE TABLE bitacora (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id      INT UNSIGNED    NULL,
  modulo          VARCHAR(30)     NOT NULL,
  accion          VARCHAR(30)     NOT NULL,
  tabla_afectada  VARCHAR(60)     NULL,
  registro_id     VARCHAR(40)     NULL,
  detalle         TEXT            NULL,
  ip              VARCHAR(45)     NULL,
  fecha           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bitacora_fecha (fecha),
  KEY idx_bitacora_modulo (modulo),
  KEY idx_bitacora_usuario (usuario_id),
  CONSTRAINT fk_bitacora_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
