-- =============================================================================
--  02_core_seed.sql — Datos iniciales del núcleo y de los catálogos compartidos
--
--  Contraseña de TODOS los usuarios de prueba:  Zoo2026!
--  (Para generar otro hash usa:  npm run hash -- "MiContraseña")
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '-06:00';

-- -----------------------------------------------------------------------------
-- Roles
-- -----------------------------------------------------------------------------
INSERT INTO rol (id, codigo, nombre, descripcion) VALUES
  (1, 'administrador',       'Administrador',          'Gestiona usuarios, configuración y tiene acceso general al sistema'),
  (2, 'director',            'Director',               'Consulta reportes y supervisa la operación del zoológico'),
  (3, 'veterinario',         'Veterinario',            'Define dietas y lleva el control clínico de los animales'),
  (4, 'cuidador',            'Cuidador',               'Registra la alimentación suministrada a los animales'),
  (5, 'encargado_bodega',    'Encargado de bodega',    'Controla el inventario de alimentos y los proveedores'),
  (6, 'supervisor_limpieza', 'Supervisor de limpieza', 'Programa y verifica las tareas de limpieza'),
  (7, 'personal_limpieza',   'Personal de limpieza',   'Ejecuta y reporta las tareas de limpieza asignadas'),
  (8, 'taquillero',          'Taquillero',             'Vende y valida entradas en taquilla');

-- -----------------------------------------------------------------------------
-- Usuarios (uno por rol, más algunos adicionales para tener datos variados)
-- -----------------------------------------------------------------------------
SET @hash = '$2a$10$80Pel47OWJurDhYbeJVGwOmCsa8C4oVpPLTfCVzMoD94EKWXQy7ky';

INSERT INTO usuario (id, rol_id, nombres, apellidos, usuario, correo, password_hash, ultimo_acceso) VALUES
  ( 1, 1, 'Ana Lucía',  'Morales Pérez',    'admin',        'admin@miradasalvaje.gt',        @hash, NULL),
  ( 2, 2, 'Roberto',    'Castillo Méndez',  'director',     'director@miradasalvaje.gt',     @hash, NULL),
  ( 3, 3, 'Patricia',   'Ortiz Ramírez',    'veterinario',  'veterinario@miradasalvaje.gt',  @hash, NULL),
  ( 4, 4, 'Carlos',     'Hernández López',  'cuidador',     'cuidador@miradasalvaje.gt',     @hash, NULL),
  ( 5, 5, 'María José', 'Ruiz Aguilar',     'bodega',       'bodega@miradasalvaje.gt',       @hash, NULL),
  ( 6, 6, 'Jorge',      'Guzmán Flores',    'suplimpieza',  'suplimpieza@miradasalvaje.gt',  @hash, NULL),
  ( 7, 7, 'Luis',       'Martínez Cruz',    'limpieza',     'limpieza@miradasalvaje.gt',     @hash, NULL),
  ( 8, 8, 'Sofía',      'Valdez Ramos',     'taquilla',     'taquilla@miradasalvaje.gt',     @hash, NULL),
  ( 9, 3, 'Fernando',   'Solís Barrios',    'veterinario2', 'fsolis@miradasalvaje.gt',       @hash, NULL),
  (10, 4, 'Andrea',     'Pineda Morales',   'cuidador2',    'apineda@miradasalvaje.gt',      @hash, NULL),
  (11, 7, 'Kevin',      'Ramírez Estrada',  'limpieza2',    'kramirez@miradasalvaje.gt',     @hash, NULL);

INSERT INTO veterinario (usuario_id, num_colegiado, especialidad) VALUES
  (3, 'CMVZ-4521', 'Medicina de fauna silvestre'),
  (9, 'CMVZ-5103', 'Nutrición animal');

-- -----------------------------------------------------------------------------
-- Hábitats
-- -----------------------------------------------------------------------------
INSERT INTO habitat (id, nombre, tipo, descripcion, ubicacion, capacidad_max) VALUES
  (1, 'Selva Tropical',   'selva',      'Vegetación densa y alta humedad, recrea la selva de Petén',      'Sector norte',    12),
  (2, 'Sabana Africana',  'sabana',     'Llanura abierta con pastizales y árboles dispersos',             'Sector oriente',  15),
  (3, 'Aviario Quetzal',  'aviario',    'Malla de gran altura con vegetación nativa para aves',           'Sector centro',   40),
  (4, 'Herpetario',       'herpetario', 'Ambientes controlados para reptiles',                            'Sector poniente', 20),
  (5, 'Bosque Nuboso',    'bosque',     'Bosque de montaña con temperatura fresca y neblina artificial', 'Sector sur',      10);

-- -----------------------------------------------------------------------------
-- Áreas: jaulas (con hábitat) y áreas de servicio (sin hábitat)
-- -----------------------------------------------------------------------------
INSERT INTO area (id, habitat_id, nombre, tipo, ubicacion, descripcion) VALUES
  ( 1, 1,    'Recinto de jaguares',        'jaula',       'Selva Tropical, sendero A',  'Recinto con poza y plataformas elevadas'),
  ( 2, 1,    'Isla de monos araña',        'jaula',       'Selva Tropical, sendero B',  'Isla rodeada de agua con árboles y cuerdas'),
  ( 3, 4,    'Pantano de cocodrilos',      'jaula',       'Herpetario, exterior',       'Estanque con zona de asoleo'),
  ( 4, 2,    'Llanura africana',           'jaula',       'Sabana Africana, centro',    'Recinto mixto de jirafas y cebras'),
  ( 5, 2,    'Recinto de leones',          'jaula',       'Sabana Africana, norte',     'Recinto con foso de seguridad'),
  ( 6, 3,    'Gran aviario',               'jaula',       'Aviario Quetzal',            'Aviario de vuelo libre'),
  ( 7, 4,    'Terrario de serpientes',     'jaula',       'Herpetario, interior',       'Terrarios con control de temperatura'),
  ( 8, 5,    'Refugio del tapir',          'jaula',       'Bosque Nuboso',              'Recinto con estanque y sotobosque'),
  ( 9, NULL, 'Sanitarios entrada principal','sanitario',  'Plaza de ingreso',           NULL),
  (10, NULL, 'Sanitarios zona sabana',     'sanitario',   'Sabana Africana, mirador',   NULL),
  (11, NULL, 'Jardín central',             'jardin',      'Plaza central',              'Jardines y fuentes de la plaza'),
  (12, NULL, 'Área de juegos infantiles',  'area_juegos', 'Junto a la cafetería',       NULL),
  (13, NULL, 'Oficinas administrativas',   'oficina',     'Edificio administrativo',    NULL),
  (14, NULL, 'Bodega de alimentos',        'bodega',      'Área de servicio',           'Bodega con cuarto frío'),
  (15, NULL, 'Clínica veterinaria',        'clinica',     'Área de servicio',           NULL);

-- -----------------------------------------------------------------------------
-- Especies
-- -----------------------------------------------------------------------------
INSERT INTO especie (id, nombre_comun, nombre_cientifico, clasificacion, tipo_dieta, estado_conservacion, descripcion) VALUES
  ( 1, 'Jaguar',                     'Panthera onca',           'mamifero', 'carnivoro',  'NT', 'El felino más grande de América'),
  ( 2, 'Mono araña centroamericano', 'Ateles geoffroyi',        'mamifero', 'frugivoro',  'EN', 'Primate arborícola de cola prensil'),
  ( 3, 'Cocodrilo de pantano',       'Crocodylus moreletii',    'reptil',   'carnivoro',  'LC', 'Cocodrilo de agua dulce de Mesoamérica'),
  ( 4, 'Jirafa',                     'Giraffa camelopardalis',  'mamifero', 'herbivoro',  'VU', 'El animal terrestre más alto'),
  ( 5, 'Cebra de llanura',           'Equus quagga',            'mamifero', 'herbivoro',  'NT', NULL),
  ( 6, 'León',                       'Panthera leo',            'mamifero', 'carnivoro',  'VU', NULL),
  ( 7, 'Guacamaya roja',             'Ara macao',               'ave',      'frugivoro',  'LC', 'Ave emblemática de la selva maya'),
  ( 8, 'Tucán pico iris',            'Ramphastos sulfuratus',   'ave',      'frugivoro',  'LC', NULL),
  ( 9, 'Boa constrictor',            'Boa constrictor',         'reptil',   'carnivoro',  'LC', NULL),
  (10, 'Tapir centroamericano',      'Tapirus bairdii',         'mamifero', 'herbivoro',  'EN', 'El mamífero terrestre más grande de Centroamérica'),
  (11, 'Venado cola blanca',         'Odocoileus virginianus',  'mamifero', 'herbivoro',  'LC', 'Especie común en los bosques de Guatemala');

-- -----------------------------------------------------------------------------
-- Animales
-- -----------------------------------------------------------------------------
INSERT INTO animal (id, codigo, nombre, especie_id, area_id, sexo, fecha_nacimiento, fecha_ingreso, procedencia, peso_kg, estado_salud) VALUES
  ( 1, 'ANI-0001', 'Balam',    1, 1, 'macho',       '2018-05-12', '2019-02-01', 'Rescate CONAP',                     92.50, 'sano'),
  ( 2, 'ANI-0002', 'Ixchel',   1, 1, 'hembra',      '2019-03-20', '2020-01-15', 'Intercambio con otro zoológico',    68.00, 'sano'),
  ( 3, 'ANI-0003', 'Chico',    2, 2, 'macho',       '2015-07-01', '2016-04-10', 'Rescate de tráfico ilegal',          8.40, 'sano'),
  ( 4, 'ANI-0004', 'Luna',     2, 2, 'hembra',      '2017-02-14', '2017-09-03', 'Rescate de tráfico ilegal',          7.90, 'en_observacion'),
  ( 5, 'ANI-0005', 'Kukulcán', 3, 3, 'macho',       NULL,         '2014-06-20', 'Rescate en Izabal',                210.00, 'sano'),
  ( 6, 'ANI-0006', 'Zuri',     4, 4, 'hembra',      '2016-08-08', '2018-03-12', 'Intercambio internacional',        780.00, 'sano'),
  ( 7, 'ANI-0007', 'Kito',     4, 4, 'macho',       '2014-01-25', '2018-03-12', 'Intercambio internacional',       1100.00, 'sano'),
  ( 8, 'ANI-0008', 'Raya',     5, 4, 'hembra',      '2017-10-02', '2019-05-20', 'Intercambio internacional',        310.00, 'sano'),
  ( 9, 'ANI-0009', 'Simba',    6, 5, 'macho',       '2015-09-30', '2017-11-11', 'Intercambio internacional',        190.00, 'en_tratamiento'),
  (10, 'ANI-0010', 'Nala',     6, 5, 'hembra',      '2016-04-18', '2017-11-11', 'Intercambio internacional',        130.00, 'sano'),
  (11, 'ANI-0011', 'Rubí',     7, 6, 'hembra',      '2012-06-10', '2013-01-22', 'Rescate de tráfico ilegal',          1.05, 'sano'),
  (12, 'ANI-0012', 'Fuego',    7, 6, 'macho',       '2013-04-02', '2014-02-17', 'Rescate de tráfico ilegal',          1.10, 'sano'),
  (13, 'ANI-0013', 'Arcoíris', 8, 6, 'desconocido', NULL,         '2021-08-09', 'Rescate CONAP',                      0.40, 'sano'),
  (14, 'ANI-0014', 'Sombra',   9, 7, 'hembra',      '2016-11-11', '2017-03-30', 'Decomiso',                          18.00, 'sano'),
  (15, 'ANI-0015', 'Danta',   10, 8, 'hembra',      '2014-05-05', '2015-01-12', 'Rescate en Petén',                 250.00, 'sano'),
  (16, 'ANI-0016', 'Astado',  11, 8, 'macho',       '2019-06-21', '2020-02-02', 'Nacido en el zoológico',            55.00, 'sano');
