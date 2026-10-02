# Sistema de Control del Zoológico "Mirada Salvaje" — Especificación para desarrollo de código

> Documento derivado del PDF "Documento - Proyecto Mirada Salvaje (COMPLETO)" (77 págs.).
> Está pensado para que una IA (o un desarrollador) lo use como contexto al generar código.
> Los diagramas originales eran imágenes; aquí están transcritos a **XML** con IDs, nodos y aristas explícitas.
> Se excluyó lo no relacionado con el código (presupuesto, bibliografía, RACI, plan de comunicación).
> La sección 11 lista **brechas e inconsistencias** del documento original que conviene resolver antes de programar.

## Índice

1. Contexto y alcance del proyecto
2. Stack tecnológico
3. Arquitectura (con diagrama XML)
4. Seguridad y roles transversales
5. Módulo Gestión de Limpieza
6. Módulo Gestión de Alimentación
7. Módulo Gestión de Entradas y Promociones
8. Módulo Control Clínico
9. Base de datos (26 tablas) y diagrama ER en XML
10. Plan de desarrollo por Sprint
11. Brechas e inconsistencias detectadas
12. Recomendaciones técnicas del documento

---

## 1. Contexto y alcance del proyecto

El proyecto es el análisis, diseño y prototipo de un sistema web que reemplaza los registros manuales del zoológico por una plataforma centralizada. Tiene dos frentes: un **sistema administrativo interno** (limpieza, alimentación, control clínico) para el personal, y un **portal público** responsive (web y/o app) donde los visitantes consultan promociones y compran entradas. Los cuatro módulos comparten una sola base de datos relacional y un mismo esquema de seguridad por roles.

```xml
<proyecto nombre="Sistema de Control del Zoológico Mirada Salvaje">
  <tipo>Aplicación web (prototipo) con portal público y panel administrativo</tipo>
  <metodologia>Scrum, 2 sprints de desarrollo/análisis + documentación; ciclo iterativo incremental</metodologia>
  <periodo inicio="2026-09-23" fin="2026-10-03"/>
  <modulos>
    <modulo id="LIM" nombre="Gestión de Limpieza"/>
    <modulo id="ALI" nombre="Gestión de Alimentación (incluye inventario compartido)"/>
    <modulo id="ENT" nombre="Gestión de Entradas y Promociones"/>
    <modulo id="CLI" nombre="Control Clínico"/>
  </modulos>
  <usuarios>
    administrador, director, veterinario, cuidador, encargado_de_bodega,
    personal_de_limpieza, supervisor_de_limpieza, taquillero, visitante(cliente)
  </usuarios>
  <entregables_codigo>
    Prototipo funcional que demuestre al menos un caso de uso completo por módulo
    (CRUD Agenda de Limpieza, CRUD Compra de entradas, CRUD Control Clínico, CRUD Control de Alimentación)
  </entregables_codigo>
  <fuera_de_alcance>
    <item>Pasarelas de pago reales (el pago se SIMULA en el prototipo)</item>
    <item>App nativa iOS/Android (se entrega web responsiva)</item>
    <item>Nómina, contabilidad, control de proveedores externos como módulo propio</item>
    <item>Integración con sistemas externos (clínicas, proveedores, gobierno)</item>
    <item>Múltiples sedes, multi-idioma, funcionalidades de IA</item>
    <item>Pruebas de carga a gran escala (se valida con datos de prueba)</item>
    <item>Sensores IoT, lectores QR/NFC en limpieza (mejora futura)</item>
  </fuera_de_alcance>
  <caracteristicas_transversales>
    autenticación, control de acceso por roles (RBAC), validación de datos,
    bitácora de auditoría, alertas automáticas, reportes exportables a PDF/Excel
  </caracteristicas_transversales>
</proyecto>
```

---

## 2. Stack tecnológico

El documento propone un stack de referencia, pero no es 100 % consistente: el módulo de Limpieza fija **Spring Boot + MySQL 8 + Ubuntu Server 24.04**, mientras que la arquitectura general deja abierto "MySQL o PostgreSQL" y "tecnologías web estándar". Se recomienda tomar el stack del módulo Limpieza como decisión por defecto.

```xml
<stack>
  <backend estado="definido en RNF-LIM-11">API REST en Spring Boot (Java)</backend>
  <base_de_datos>MySQL 8 (alternativa mencionada: PostgreSQL)</base_de_datos>
  <servidor_so>Ubuntu Server 24.04 LTS</servidor_so>
  <frontend>HTML5, CSS3, JavaScript y framework moderno (sin especificar); web responsiva; sin instalación</frontend>
  <navegadores>Chrome, Edge, Firefox (versiones recientes)</navegadores>
  <autenticacion>Tokens JWT + RBAC; hash de contraseñas con sal (ej. BCrypt)</autenticacion>
  <transporte>HTTPS/TLS</transporte>
  <zona_horaria_y_formato>America/Guatemala, interfaz en español, moneda Quetzales (Q)</zona_horaria_y_formato>
  <herramientas>
    <item>VS Code, IntelliJ IDEA</item>
    <item>Git + GitHub (una rama por módulo, Pull Requests, integración en rama develop)</item>
    <item>Jira (backlog y sprints)</item>
    <item>Draw.io (diagramas), dbdiagram.io (ER, exporta .dbml), Graphviz/Mermaid (arquitectura)</item>
  </herramientas>
  <hardware_de_campo>POS de taquilla, lectores QR/código de barras, tablets/smartphones, impresora térmica</hardware_de_campo>
</stack>
```

---

## 3. Arquitectura

Arquitectura cliente-servidor de **tres capas** (presentación, lógica de negocio, datos) con patrón MVC. Un único servidor de aplicaciones expone una **API REST** que consumen el sitio web público, la app móvil pública y el panel administrativo interno; así la lógica no se duplica y se puede añadir un nuevo cliente (p. ej. un kiosco) sin tocar el backend. No se usan microservicios: es un prototipo.

```xml
<diagrama_arquitectura tipo="capas" fuente="Diagrama general de arquitectura (pág. 65/69 del PDF)">
  <capa id="PRES" nombre="Capa de presentación (Clientes)">
    <componente id="web" nombre="Sitio Web (público)" funciones="Entradas y promociones"/>
    <componente id="app" nombre="App Móvil (público)" funciones="Entradas y promociones"/>
    <componente id="panel" nombre="Panel Administrativo (empleados / veterinarios)" funciones="Limpieza, Alimentación, Clínico"/>
  </capa>
  <capa id="LOG" nombre="Capa de lógica de negocio">
    <componente id="api" nombre="Servidor de Aplicaciones — API REST"
                modulos="Limpieza, Alimentación, Control Clínico, Entradas"
                seguridad="Autenticación y control de acceso (JWT)"/>
  </capa>
  <capa id="DAT" nombre="Capa de datos">
    <componente id="db" nombre="Servidor de Base de Datos Relacional (MySQL / PostgreSQL)"/>
  </capa>
  <conexiones>
    <conexion de="web"   a="api" protocolo="HTTPS/REST"/>
    <conexion de="app"   a="api" protocolo="HTTPS/REST"/>
    <conexion de="panel" a="api" protocolo="HTTPS/REST"/>
    <conexion de="api"   a="db"  protocolo="SQL"/>
  </conexiones>
  <decisiones>
    <item>Modularidad: cada módulo es un conjunto de servicios dentro de la misma API</item>
    <item>Seguridad centralizada en la capa de negocio (JWT + roles)</item>
    <item>Reportes implementados una sola vez y expuestos a cualquier cliente autorizado</item>
    <item>Base de datos aislada para optimizar, respaldar o migrar sin afectar clientes</item>
  </decisiones>
</diagrama_arquitectura>
```

---

## 4. Seguridad y roles transversales

La seguridad se diseña desde el inicio. Las reglas se validan **siempre en el servidor**, nunca solo en la interfaz. Aplica el principio de "denegar por defecto" (OWASP A01) y mínimo privilegio.

```xml
<seguridad>
  <autenticacion>
    <regla>Usuario y contraseña; hash con sal (BCrypt); HTTPS obligatorio</regla>
    <regla>Sesión expira a los 15 min de inactividad (RNF-LIM-03)</regla>
    <regla>Contraseñas por longitud: mínimo 8, ideal 12-15, hasta 64 caracteres; sin cambios periódicos forzados (NIST SP 800-63B)</regla>
    <regla>MFA obligatoria para Administrador, recomendada para Veterinario</regla>
    <regla>Bloqueo temporal tras varios intentos fallidos; notificar inicios de sesión inusuales</regla>
    <regla>Verificar contraseñas contra bases de contraseñas filtradas</regla>
  </autenticacion>
  <autorizacion modelo="RBAC">
    <regla>Denegar por defecto; permisos explícitos por rol</regla>
    <regla>Validación en servidor siempre; evitar IDOR (el cuidador solo ve animales asignados)</regla>
    <regla>Auditar roles y permisos al menos trimestralmente</regla>
  </autorizacion>
  <proteccion_owasp>inyección SQL, XSS, CSRF, control de acceso deficiente, fuerza bruta, rate limiting en el portal público</proteccion_owasp>
  <datos>
    <regla>Cifrado en tránsito (TLS) y en reposo para datos clínicos y de pago</regla>
    <regla>No manejar datos de tarjeta directamente: delegar a proveedor certificado PCI-DSS</regla>
    <regla>Operaciones multi-tabla en transacciones; baja lógica (no borrado físico) en historiales</regla>
  </datos>
  <bitacora_auditoria>
    Registrar usuario, fecha, hora y acción en toda creación, modificación o eliminación de datos críticos
    (especialmente datos clínicos, inventario y tareas)
  </bitacora_auditoria>
  <roles>
    <rol id="publico" descripcion="Visitante/cliente registrado en app o web: compra entradas, consulta promociones"/>
    <rol id="empleado" descripcion="Personal operativo (cuidador, limpieza, bodega, taquilla) con funciones según su puesto"/>
    <rol id="veterinario" descripcion="Acceso operativo total en Control Clínico; consulta inventario clínico"/>
    <rol id="administrador" descripcion="Control total de los 4 módulos; único que elimina registros clínicos y mueve inventario clínico"/>
    <rol id="supervisor_limpieza" descripcion="Planes, asignación, validación de limpieza"/>
    <rol id="cuidador" descripcion="Autoriza acceso a jaulas, registra alimentación, consulta (solo lectura) historial clínico de sus animales"/>
    <rol id="encargado_bodega" descripcion="Inventario de alimentos, proveedores, alertas"/>
    <rol id="director" descripcion="Consulta reportes"/>
  </roles>
  <matriz_permisos_clinico>
    <permiso accion="Registrar consulta/diagnóstico"      admin="si" vet="si" cuidador="no"/>
    <permiso accion="Registrar vacuna/medicamento/vitamina" admin="si" vet="si" cuidador="no"/>
    <permiso accion="Consultar historial clínico"          admin="si" vet="si" cuidador="solo lectura, solo animales asignados"/>
    <permiso accion="Consultar inventario clínico"         admin="si" vet="solo consulta" cuidador="no"/>
    <permiso accion="Movimientos de inventario clínico"    admin="si" vet="no" cuidador="no"/>
    <permiso accion="Eliminar registros clínicos"          admin="si (con bitácora)" vet="no" cuidador="no"/>
    <permiso accion="Generar reportes clínicos"            admin="si" vet="si" cuidador="no"/>
  </matriz_permisos_clinico>
</seguridad>
```

---

## 5. Módulo Gestión de Limpieza (LIM)

Planifica, asigna, ejecuta, valida y documenta la limpieza de **cinco tipos de área**: jaulas, sanitarios, jardines, áreas de juegos y oficinas. Maneja limpieza **programada** (por plan y frecuencia) y **reactiva** (incidencias). Regla clave: ninguna tarea en una **jaula** puede iniciar sin autorización del cuidador (RN-LIM-01), y ninguna tarea se cierra sin validación del supervisor. El módulo solo **registra consumo** de insumos; el control de stock no es parte de su alcance.

```xml
<modulo id="LIM" nombre="Gestión de Limpieza">
  <actores>Administrador, Supervisor de limpieza, Personal de limpieza, Cuidador de animales</actores>

  <reglas_negocio>
    <rn id="RN-LIM-01">Para tareas en jaulas, el cuidador debe verificar que el animal esté resguardado y autorizar el acceso; si no autoriza, la tarea se pospone y se notifica al supervisor.</rn>
    <rn id="RN-LIM-02">Una tarea finalizada queda en estado "Pendiente de validación"; el supervisor aprueba o la devuelve con observaciones (ciclo de corrección).</rn>
    <rn id="RN-LIM-03">Las tareas fuera de horario se marcan automáticamente como vencidas y se alerta al supervisor.</rn>
    <rn id="RN-LIM-04">Proceso de sanitización: limpiar, desinfectar, secar; registrar actividades y productos usados.</rn>
  </reglas_negocio>

  <indicadores>porcentaje de cumplimiento, tareas vencidas, tiempo promedio de ejecución, tareas rechazadas, incidencias por tipo/área, consumo de insumos</indicadores>

  <fuera_de_alcance>
    control de existencias de insumos (stock/compras/proveedores), nómina/asistencia,
    QR/NFC, app móvil nativa, protocolos de desinfección por especie
  </fuera_de_alcance>

  <requerimientos_funcionales>
    <grupo nombre="Datos maestros">
      <rf id="RF-LIM-01">Registrar, consultar, modificar y desactivar áreas (jaulas, sanitarios, jardines, áreas de juegos, oficinas).</rf>
      <rf id="RF-LIM-02">Almacenar código, nombre, tipo, ubicación y estado por área; en jaulas asociar recinto/especie.</rf>
      <rf id="RF-LIM-03">Registrar, modificar y dar de baja personal de limpieza (identificación, turno, estado).</rf>
      <rf id="RF-LIM-04">Mantener catálogo de insumos de limpieza (nombre, tipo, unidad de medida).</rf>
    </grupo>
    <grupo nombre="Planificación y asignación">
      <rf id="RF-LIM-05">Definir plan de limpieza por área: frecuencia, horario sugerido, prioridad y checklist.</rf>
      <rf id="RF-LIM-06">Generar tareas automáticamente según el plan; permitir tareas extraordinarias manuales.</rf>
      <rf id="RF-LIM-07">Asignar/reasignar tareas con fecha y turno, advirtiendo traslapes de horario.</rf>
      <rf id="RF-LIM-08">Notificar al personal cuando se le asigne o reasigne una tarea.</rf>
    </grupo>
    <grupo nombre="Ejecución">
      <rf id="RF-LIM-09">Consultar tareas asignadas filtradas por fecha y estado.</rf>
      <rf id="RF-LIM-10">Registrar hora de inicio/fin y actualizar el estado de la tarea.</rf>
      <rf id="RF-LIM-11">Presentar el checklist y permitir marcar actividades realizadas y observaciones.</rf>
      <rf id="RF-LIM-12">Exigir autorización previa del cuidador para tareas en jaulas.</rf>
      <rf id="RF-LIM-13">Registrar insumos utilizados por tarea y su cantidad.</rf>
      <rf id="RF-LIM-14">Reportar incidencias (tipo, descripción, fotografía opcional).</rf>
    </grupo>
    <grupo nombre="Supervisión">
      <rf id="RF-LIM-15">Aprobar o rechazar tareas finalizadas con observaciones; una rechazada regresa al personal.</rf>
      <rf id="RF-LIM-16">Marcar automáticamente como vencidas las tareas fuera de horario y alertar al supervisor.</rf>
      <rf id="RF-LIM-17">Dar seguimiento a incidencias (estados: abierta, en atención, resuelta) con comentarios.</rf>
    </grupo>
    <grupo nombre="Consulta y reportes">
      <rf id="RF-LIM-18">Conservar y consultar historial por área, empleado, fecha y estado.</rf>
      <rf id="RF-LIM-19">Generar reportes (cumplimiento, tareas por empleado, insumos, incidencias) exportables a PDF/Excel.</rf>
      <rf id="RF-LIM-20">Mostrar resumen con indicadores del día (cumplidas, vencidas, pendientes).</rf>
    </grupo>
    <grupo nombre="Seguridad">
      <rf id="RF-LIM-21">Autenticar usuarios y restringir funciones según rol.</rf>
      <rf id="RF-LIM-22">Registrar en bitácora de auditoría las acciones críticas (usuario, fecha, hora).</rf>
    </grupo>
  </requerimientos_funcionales>

  <requerimientos_no_funcionales>
    <rnf id="RNF-LIM-01" categoria="Seguridad">Contraseñas con hash y sal (ej. BCrypt); comunicación por HTTPS.</rnf>
    <rnf id="RNF-LIM-02" categoria="Seguridad">Mitigar OWASP Top 10: inyección SQL, XSS, CSRF, control de acceso deficiente.</rnf>
    <rnf id="RNF-LIM-03" categoria="Seguridad">Sesiones expiran a los 15 min de inactividad; permisos validados siempre en el servidor.</rnf>
    <rnf id="RNF-LIM-04" categoria="Rendimiento">95 % de operaciones de consulta/registro responden en menos de 3 s con hasta 50 usuarios concurrentes.</rnf>
    <rnf id="RNF-LIM-05" categoria="Disponibilidad">Disponibilidad de al menos 99 % del horario operativo; respaldo diario de la BD.</rnf>
    <rnf id="RNF-LIM-06" categoria="Usabilidad">Interfaz responsiva, usable desde móvil, en pocos pasos y sin capacitación extensa.</rnf>
    <rnf id="RNF-LIM-07" categoria="Usabilidad">Interfaz en español; fecha/hora de Guatemala (America/Guatemala).</rnf>
    <rnf id="RNF-LIM-08" categoria="Fiabilidad">Operaciones multi-tabla en transacciones; baja lógica en historial.</rnf>
    <rnf id="RNF-LIM-09" categoria="Mantenibilidad">Arquitectura en capas, código documentado, módulo independiente salvo catálogo compartido.</rnf>
    <rnf id="RNF-LIM-10" categoria="Compatibilidad">Chrome, Edge y Firefox recientes, sin instalación.</rnf>
    <rnf id="RNF-LIM-11" categoria="Restricción técnica">API REST en Spring Boot, MySQL 8, Ubuntu Server 24.04 LTS.</rnf>
  </requerimientos_no_funcionales>

  <diagramas>

    <diagrama_casos_de_uso id="CU-LIM">
      <nota>CU-01 (Iniciar sesión) es transversal: se dibuja fuera de paquetes y conecta a los 4 actores.</nota>
      <actores>
        <actor id="admin" nombre="Administrador"/>
        <actor id="sup" nombre="Supervisor de limpieza"/>
        <actor id="per" nombre="Personal de limpieza"/>
        <actor id="cui" nombre="Cuidador de animales"/>
      </actores>
      <paquete nombre="Administración">
        <caso_uso id="CU-02" nombre="Gestionar áreas a limpiar"/>
        <caso_uso id="CU-03" nombre="Gestionar personal de limpieza"/>
        <caso_uso id="CU-04" nombre="Gestionar catálogo de insumos"/>
      </paquete>
      <paquete nombre="Consulta y reportes">
        <caso_uso id="CU-14" nombre="Consultar historial de limpieza"/>
        <caso_uso id="CU-15" nombre="Generar reportes de limpieza"/>
      </paquete>
      <paquete nombre="Planificación y supervisión">
        <caso_uso id="CU-05" nombre="Definir plan de limpieza y checklist"/>
        <caso_uso id="CU-06" nombre="Asignar tarea de limpieza"/>
        <caso_uso id="CU-07" nombre="Validar limpieza realizada"/>
        <caso_uso id="CU-08" nombre="Atender incidencias"/>
      </paquete>
      <paquete nombre="Operación en campo">
        <caso_uso id="CU-09" nombre="Consultar tareas asignadas"/>
        <caso_uso id="CU-10" nombre="Ejecutar tarea de limpieza"/>
        <caso_uso id="CU-11" nombre="Registrar insumos utilizados"/>
        <caso_uso id="CU-12" nombre="Reportar incidencia"/>
        <caso_uso id="CU-13" nombre="Autorizar acceso a jaula"/>
      </paquete>
      <caso_uso id="CU-01" nombre="Iniciar sesión" paquete="ninguno (transversal)"/>
      <asociaciones>
        <asoc actor="admin" caso_uso="CU-02"/><asoc actor="admin" caso_uso="CU-03"/><asoc actor="admin" caso_uso="CU-04"/>
        <asoc actor="admin" caso_uso="CU-14"/><asoc actor="admin" caso_uso="CU-15"/>
        <asoc actor="sup" caso_uso="CU-05"/><asoc actor="sup" caso_uso="CU-06"/><asoc actor="sup" caso_uso="CU-07"/><asoc actor="sup" caso_uso="CU-08"/>
        <asoc actor="sup" caso_uso="CU-14"/><asoc actor="sup" caso_uso="CU-15"/>
        <asoc actor="per" caso_uso="CU-09"/><asoc actor="per" caso_uso="CU-10"/>
        <asoc actor="cui" caso_uso="CU-13"/>
        <asoc actor="admin" caso_uso="CU-01"/><asoc actor="sup" caso_uso="CU-01"/>
        <asoc actor="per" caso_uso="CU-01"/><asoc actor="cui" caso_uso="CU-01"/>
      </asociaciones>
      <relaciones>
        <include de="CU-10" a="CU-11"/>
        <extend  de="CU-12" a="CU-10"/>
        <extend  de="CU-13" a="CU-10" condicion="area = jaula"/>
      </relaciones>
    </diagrama_casos_de_uso>

    <diagrama_actividades id="ACT-LIM" nombre="Flujo completo de una tarea de limpieza">
      <carriles>
        <carril id="sup" nombre="Supervisor de limpieza"/>
        <carril id="sis" nombre="Sistema"/>
        <carril id="per" nombre="Personal de limpieza"/>
        <carril id="cui" nombre="Cuidador de animales"/>
      </carriles>
      <nodos>
        <nodo id="ini" tipo="inicio" carril="sup"/>
        <nodo id="a1"  tipo="accion" carril="sup" texto="Definir plan de limpieza (área, frecuencia y checklist)"/>
        <nodo id="a2"  tipo="accion" carril="sis" texto="Generar tareas de limpieza según el plan"/>
        <nodo id="a3"  tipo="accion" carril="sup" texto="Asignar tarea al personal de limpieza"/>
        <nodo id="a4"  tipo="accion" carril="sis" texto="Notificar la asignación"/>
        <nodo id="a5"  tipo="accion" carril="per" texto="Seleccionar la tarea del día e iniciarla"/>
        <nodo id="d1"  tipo="decision" carril="per" texto="¿El área es una jaula?"/>
        <nodo id="a6"  tipo="accion" carril="cui" texto="Verificar que el animal esté resguardado"/>
        <nodo id="d2"  tipo="decision" carril="cui" texto="¿Autoriza el acceso?"/>
        <nodo id="a7"  tipo="accion" carril="sis" texto="Posponer la tarea y notificar al supervisor"/>
        <nodo id="fin1" tipo="fin" carril="sis" texto="Fin: tarea pospuesta"/>
        <nodo id="m1"  tipo="union" carril="per"/>
        <nodo id="a8"  tipo="accion" carril="per" texto="Ejecutar la limpieza según el checklist y registrar insumos"/>
        <nodo id="d3"  tipo="decision" carril="per" texto="¿Hubo incidencia?"/>
        <nodo id="a9"  tipo="accion" carril="per" texto="Reportar incidencia (tipo, descripción, evidencia)"/>
        <nodo id="m2"  tipo="union" carril="per"/>
        <nodo id="a10" tipo="accion" carril="per" texto="Finalizar tarea y registrar observaciones"/>
        <nodo id="a11" tipo="accion" carril="sis" texto="Registrar hora de fin y estado 'Pendiente de validación'"/>
        <nodo id="a12" tipo="accion" carril="sup" texto="Revisar la limpieza realizada"/>
        <nodo id="d4"  tipo="decision" carril="sup" texto="¿Limpieza aprobada?"/>
        <nodo id="a13" tipo="accion" carril="sup" texto="Devolver con observaciones"/>
        <nodo id="a14" tipo="accion" carril="per" texto="Corregir y finalizar nuevamente la tarea"/>
        <nodo id="a15" tipo="accion" carril="sup" texto="Revisar la limpieza realizada (re-revisión)"/>
        <nodo id="a16" tipo="accion" carril="sis" texto="Cerrar tarea y guardar en el historial de limpieza"/>
        <nodo id="a17" tipo="accion" carril="sup" texto="Consultar historial y generar reportes"/>
        <nodo id="fin2" tipo="fin" carril="sup" texto="Fin: ciclo completo cerrado"/>
      </nodos>
      <aristas>
        <arista de="ini" a="a1"/><arista de="a1" a="a2"/><arista de="a2" a="a3"/><arista de="a3" a="a4"/>
        <arista de="a4" a="a5"/><arista de="a5" a="d1"/>
        <arista de="d1" a="a6" guarda="sí"/>
        <arista de="d1" a="m1" guarda="no"/>
        <arista de="a6" a="d2"/>
        <arista de="d2" a="m1" guarda="sí"/>
        <arista de="d2" a="a7" guarda="no"/>
        <arista de="a7" a="fin1"/>
        <arista de="m1" a="a8"/><arista de="a8" a="d3"/>
        <arista de="d3" a="a9" guarda="sí"/>
        <arista de="d3" a="m2" guarda="no"/>
        <arista de="a9" a="m2"/>
        <arista de="m2" a="a10"/><arista de="a10" a="a11"/><arista de="a11" a="a12"/><arista de="a12" a="d4"/>
        <arista de="d4" a="a16" guarda="sí"/>
        <arista de="d4" a="a13" guarda="no"/>
        <arista de="a13" a="a14"/><arista de="a14" a="a15"/><arista de="a15" a="d4" nota="ciclo de corrección"/>
        <arista de="a16" a="a17"/><arista de="a17" a="fin2"/>
      </aristas>
    </diagrama_actividades>

  </diagramas>
</modulo>
```

---

## 6. Módulo Gestión de Alimentación (ALI)

Integra dietas, horarios e inventario de alimentos. El veterinario define la dieta (por especie o animal), el administrador programa horarios por recinto y asigna cuidador, el cuidador registra cada ración, y el sistema **valida existencias, descuenta del lote más próximo a vencer** y genera alertas de stock mínimo o vencimiento. Este módulo contiene el **inventario compartido** que otros módulos deberían consumir (no duplicar).

```xml
<modulo id="ALI" nombre="Gestión de Alimentación">
  <actores>Veterinario, Administrador, Cuidador (alimentador), Encargado de bodega, Director</actores>

  <reglas_negocio>
    <rn id="RN-ALI-01">Cada registro de alimentación descuenta automáticamente la cantidad del inventario.</rn>
    <rn id="RN-ALI-02">Si la existencia es insuficiente, el registro se rechaza y se muestra aviso; nunca existencias negativas.</rn>
    <rn id="RN-ALI-03">El descuento se hace sobre el lote con vencimiento más próximo (FEFO).</rn>
    <rn id="RN-ALI-04">Si tras descontar la existencia es menor o igual al stock mínimo, se genera alerta para el encargado de bodega.</rn>
    <rn id="RN-ALI-05">Cambios de dieta por motivos de salud se deciden en Control Clínico y aquí solo se reflejan como actualización de dieta.</rn>
  </reglas_negocio>

  <funcionalidades>
    gestión de dietas, programación de horarios por recinto, registro de alimentación,
    control de inventario por lote y vencimiento, catálogo de proveedores e historial de compras,
    alertas automáticas, reportes de consumo/stock crítico/vencimientos
  </funcionalidades>

  <fuera_de_alcance>
    proceso formal de compra/cotización/pago, inventario de medicamentos y de limpieza,
    diagnósticos clínicos, básculas/sensores automáticos
  </fuera_de_alcance>

  <requerimientos_funcionales>
    <rf id="RF-ALI-01">Registrar y modificar la dieta de cada especie o animal: tipo de alimento, cantidad por ración y frecuencia diaria.</rf>
    <rf id="RF-ALI-02">Programar horarios de alimentación por recinto y asignar cuidador responsable.</rf>
    <rf id="RF-ALI-03">Registrar cada ración: fecha, hora, cantidad, responsable y observaciones.</rf>
    <rf id="RF-ALI-04">Descontar del inventario la cantidad registrada e impedir el registro si no hay existencia suficiente.</rf>
    <rf id="RF-ALI-05">Registrar productos alimenticios y entradas por compra con proveedor, lote, cantidad y fecha de vencimiento.</rf>
    <rf id="RF-ALI-06">Registrar, modificar y consultar proveedores de alimentos.</rf>
    <rf id="RF-ALI-07">Generar alertas cuando un producto llegue a su stock mínimo o un lote esté próximo a vencer.</rf>
    <rf id="RF-ALI-08">Generar reportes de consumo (por periodo y especie), stock crítico y lotes próximos a vencer, exportables a PDF y Excel.</rf>
  </requerimientos_funcionales>

  <requerimientos_no_funcionales>
    <rnf id="RNF-ALI-01" categoria="Seguridad">Acceso con usuario/contraseña; cada usuario solo accede a funciones de su rol.</rnf>
    <rnf id="RNF-ALI-02" categoria="Seguridad">Bitácora de cada cambio con usuario, fecha y hora.</rnf>
    <rnf id="RNF-ALI-03" categoria="Rendimiento">Consultas y registros en menos de 3 segundos.</rnf>
    <rnf id="RNF-ALI-04" categoria="Usabilidad">Interfaz adaptable a tabletas y teléfonos para registrar desde el recinto.</rnf>
    <rnf id="RNF-ALI-05" categoria="Integridad">Impedir existencias negativas; integridad referencial entre dietas, animales y productos.</rnf>
  </requerimientos_no_funcionales>

  <diagramas>

    <diagrama_casos_de_uso id="CU-ALI">
      <actores>
        <actor id="vet" nombre="Veterinario"/>
        <actor id="adm" nombre="Administrador"/>
        <actor id="cui" nombre="Cuidador"/>
        <actor id="bod" nombre="Encargado de bodega"/>
        <actor id="dir" nombre="Director"/>
      </actores>
      <casos_uso>
        <caso_uso id="ALI-CU1" nombre="Gestionar dietas"/>
        <caso_uso id="ALI-CU2" nombre="Programar horarios de alimentación"/>
        <caso_uso id="ALI-CU3" nombre="Asignar cuidador responsable"/>
        <caso_uso id="ALI-CU4" nombre="Registrar alimentación suministrada"/>
        <caso_uso id="ALI-CU5" nombre="Validar existencia disponible"/>
        <caso_uso id="ALI-CU6" nombre="Descontar del inventario"/>
        <caso_uso id="ALI-CU7" nombre="Registrar productos alimenticios"/>
        <caso_uso id="ALI-CU8" nombre="Registrar entrada de alimento"/>
        <caso_uso id="ALI-CU9" nombre="Gestionar proveedores"/>
        <caso_uso id="ALI-CU10" nombre="Consultar alertas de stock y vencimiento"/>
        <caso_uso id="ALI-CU11" nombre="Generar reportes"/>
        <caso_uso id="ALI-CU12" nombre="Exportar a PDF o Excel"/>
      </casos_uso>
      <asociaciones>
        <asoc actor="vet" caso_uso="ALI-CU1"/>
        <asoc actor="adm" caso_uso="ALI-CU2"/>
        <asoc actor="cui" caso_uso="ALI-CU4"/>
        <asoc actor="bod" caso_uso="ALI-CU7"/><asoc actor="bod" caso_uso="ALI-CU8"/>
        <asoc actor="bod" caso_uso="ALI-CU9"/><asoc actor="bod" caso_uso="ALI-CU10"/>
        <asoc actor="vet" caso_uso="ALI-CU11"/><asoc actor="bod" caso_uso="ALI-CU11"/><asoc actor="dir" caso_uso="ALI-CU11"/>
      </asociaciones>
      <relaciones>
        <include de="ALI-CU2" a="ALI-CU3"/>
        <include de="ALI-CU4" a="ALI-CU5"/>
        <include de="ALI-CU4" a="ALI-CU6"/>
        <extend  de="ALI-CU12" a="ALI-CU11"/>
      </relaciones>
    </diagrama_casos_de_uso>

    <diagrama_actividades id="ACT-ALI" nombre="Registro de alimentación suministrada">
      <carriles>
        <carril id="cui" nombre="Cuidador"/>
        <carril id="sis" nombre="Sistema"/>
        <carril id="bod" nombre="Encargado de bodega"/>
      </carriles>
      <nodos>
        <nodo id="ini" tipo="inicio" carril="cui"/>
        <nodo id="a1"  tipo="accion" carril="cui" texto="Iniciar sesión"/>
        <nodo id="a2"  tipo="accion" carril="sis" texto="Validar credenciales"/>
        <nodo id="d1"  tipo="decision" carril="sis" texto="¿Credenciales válidas?"/>
        <nodo id="a3"  tipo="accion" carril="sis" texto="Mostrar alimentaciones pendientes del día"/>
        <nodo id="a4"  tipo="accion" carril="cui" texto="Seleccionar alimentación pendiente"/>
        <nodo id="a5"  tipo="accion" carril="sis" texto="Mostrar dieta asignada con alimento y ración"/>
        <nodo id="a6"  tipo="accion" carril="cui" texto="Suministrar la ración al animal"/>
        <nodo id="a7"  tipo="accion" carril="cui" texto="Registrar cantidad suministrada y observaciones"/>
        <nodo id="a8"  tipo="accion" carril="sis" texto="Validar existencia disponible"/>
        <nodo id="d2"  tipo="decision" carril="sis" texto="¿Existencia suficiente?"/>
        <nodo id="a9"  tipo="accion" carril="sis" texto="Rechazar registro y mostrar aviso"/>
        <nodo id="a10" tipo="accion" carril="sis" texto="Guardar registro de alimentación"/>
        <nodo id="a11" tipo="accion" carril="sis" texto="Descontar del lote más próximo a vencer"/>
        <nodo id="a12" tipo="accion" carril="sis" texto="Marcar alimentación como completada"/>
        <nodo id="d3"  tipo="decision" carril="sis" texto="¿Existencia menor o igual al stock mínimo?"/>
        <nodo id="a13" tipo="accion" carril="sis" texto="Generar alerta de stock"/>
        <nodo id="j1"  tipo="union_barra" carril="sis"/>
        <nodo id="a14" tipo="accion" carril="bod" texto="Revisar alerta de stock"/>
        <nodo id="a15" tipo="accion" carril="bod" texto="Registrar entrada de alimento"/>
        <nodo id="fin_b" tipo="fin_flujo" carril="bod"/>
        <nodo id="d4"  tipo="decision" carril="cui" texto="¿Hay más alimentaciones pendientes?"/>
        <nodo id="fin"  tipo="fin" carril="cui"/>
      </nodos>
      <aristas>
        <arista de="ini" a="a1"/><arista de="a1" a="a2"/><arista de="a2" a="d1"/>
        <arista de="d1" a="a1" guarda="no (mostrar error)"/>
        <arista de="d1" a="a3" guarda="sí"/>
        <arista de="a3" a="a4"/><arista de="a4" a="a5"/><arista de="a5" a="a6"/><arista de="a6" a="a7"/>
        <arista de="a7" a="a8"/><arista de="a8" a="d2"/>
        <arista de="d2" a="a9" guarda="no"/>
        <arista de="d2" a="a10" guarda="sí"/>
        <arista de="a9" a="a13" nota="existencia insuficiente dispara alerta"/>
        <arista de="a10" a="a11"/><arista de="a11" a="a12"/><arista de="a12" a="d3"/>
        <arista de="d3" a="a13" guarda="sí"/>
        <arista de="d3" a="j1" guarda="no"/>
        <arista de="a13" a="j1"/>
        <arista de="j1" a="a14" nota="rama hacia bodega"/>
        <arista de="j1" a="d4" nota="rama hacia cuidador"/>
        <arista de="a14" a="a15"/><arista de="a15" a="fin_b"/>
        <arista de="d4" a="a4" guarda="sí"/>
        <arista de="d4" a="fin" guarda="no"/>
      </aristas>
    </diagrama_actividades>

  </diagramas>
</modulo>
```

---

## 7. Módulo Gestión de Entradas y Promociones (ENT)

Es el único módulo **expuesto al público**. Permite comprar entradas por web/app con hasta **60 días de anticipación** y por taquilla, controla el **aforo máximo por fecha** (bloquea ventas al llegar al límite), calcula precios con tarifa base + categorías + promociones, genera comprobante y **código QR único** por entrada, y valida el ingreso con escáner. El pago es **simulado** en el prototipo. Nota: el PDF no numera los requerimientos de este módulo; los IDs `RF-ENT-xx` / `RNF-ENT-xx` de abajo fueron asignados aquí por orden de aparición.

```xml
<modulo id="ENT" nombre="Gestión de Entradas y Promociones">
  <actores>Cliente (visitante), Empleado (taquillero), Administrador</actores>

  <reglas_negocio>
    <rn id="RN-ENT-01">Compra digital permitida hasta 60 días antes de la fecha de visita.</rn>
    <rn id="RN-ENT-02">Si el aforo máximo de una fecha se alcanza, se rechaza la venta (bloqueo automático).</rn>
    <rn id="RN-ENT-03">Estructura de tarifas: tarifa base (adulto, día ordinario) y categorías derivadas: adultos, niños, adultos mayores, discapacidad, familias numerosas, infantes.</rn>
    <rn id="RN-ENT-04">Modalidades de vigencia: día único, fecha abierta, pase de varios días, membresía/abono anual.</rn>
    <rn id="RN-ENT-05">Descuentos permanentes para categorías especiales (discapacidad, familia numerosa) y códigos promocionales con vigencia.</rn>
    <rn id="RN-ENT-06">Cada entrada lleva un código QR/barras único; se valida al ingreso registrando fecha, hora y estado.</rn>
    <rn id="RN-ENT-07">Se puede anular/cancelar una entrada solo antes de su uso, según políticas institucionales.</rn>
    <rn id="RN-ENT-08">Una entrada puede asociarse a un cliente registrado (historial y membresías).</rn>
  </reglas_negocio>

  <fuera_de_alcance>
    pasarelas bancarias internacionales fuera de la integración estándar; tiendas de souvenirs o venta de alimentos
  </fuera_de_alcance>

  <requerimientos_funcionales>
    <rf id="RF-ENT-01">Registrar y consultar tipos de entrada (general, niño, adulto mayor, discapacidad, familia numerosa).</rf>
    <rf id="RF-ENT-02">Definir una tarifa base para cada tipo de entrada.</rf>
    <rf id="RF-ENT-03">Seleccionar cantidad de entradas por transacción diferenciando por categoría de visitante.</rf>
    <rf id="RF-ENT-04">Calcular automáticamente el monto total según tipo y cantidad.</rf>
    <rf id="RF-ENT-05">Registrar entradas de día único, fecha abierta, varios días y membresía/abono anual.</rf>
    <rf id="RF-ENT-06">Permitir compra presencial (taquilla) y digital (web/app).</rf>
    <rf id="RF-ENT-07">Generar un comprobante de compra por transacción.</rf>
    <rf id="RF-ENT-08">Generar un código de validación (QR o barras) por cada entrada vendida.</rf>
    <rf id="RF-ENT-09">Validar el comprobante o código al ingreso.</rf>
    <rf id="RF-ENT-10">Registrar fecha y hora de emisión de cada entrada.</rf>
    <rf id="RF-ENT-11">Controlar aforo por fecha y rechazar la venta al llegar al límite.</rf>
    <rf id="RF-ENT-12">Consultar historial de entradas vendidas por fecha, tipo o categoría.</rf>
    <rf id="RF-ENT-13">Cancelar o anular una entrada antes de su uso según políticas.</rf>
    <rf id="RF-ENT-14">Asociar una entrada a un cliente registrado (historial / membresías).</rf>
  </requerimientos_funcionales>

  <requerimientos_no_funcionales>
    <rnf id="RNF-ENT-01">Información de pago procesada de forma segura.</rnf>
    <rnf id="RNF-ENT-02">Disponible en línea 24 horas para compra digital.</rnf>
    <rnf id="RNF-ENT-03">Comprobante generado en pocos segundos tras confirmar el pago.</rnf>
    <rnf id="RNF-ENT-04">Accesible desde móviles y escritorio.</rnf>
    <rnf id="RNF-ENT-05">Respaldo de las transacciones para evitar pérdida de información.</rnf>
  </requerimientos_no_funcionales>

  <diagramas>

    <diagrama_casos_de_uso id="CU-ENT-1" nombre="Comprar entrada">
      <actores>
        <actor id="cli" nombre="Cliente"/>
        <actor id="emp" nombre="Empleado"/>
      </actores>
      <casos_uso>
        <caso_uso id="E1" nombre="Comprar Entrada" principal="true"/>
        <caso_uso id="E2" nombre="Seleccionar tipo de entrada"/>
        <caso_uso id="E3" nombre="Calcular precio total"/>
        <caso_uso id="E4" nombre="Aplicar código promocional"/>
        <caso_uso id="E5" nombre="Aplicar descuento por categoría especial"/>
        <caso_uso id="E6" nombre="Verificar aforo disponible"/>
        <caso_uso id="E7" nombre="Procesar pago"/>
        <caso_uso id="E8" nombre="Generar comprobante"/>
      </casos_uso>
      <asociaciones>
        <asoc actor="cli" caso_uso="E1"/>
        <asoc actor="emp" caso_uso="E2"/>
      </asociaciones>
      <relaciones>
        <include de="E1" a="E2"/><include de="E1" a="E3"/><include de="E1" a="E6"/>
        <include de="E1" a="E7"/><include de="E1" a="E8"/>
        <extend de="E4" a="E3"/>
        <extend de="E5" a="E3"/>
      </relaciones>
    </diagrama_casos_de_uso>

    <diagrama_casos_de_uso id="CU-ENT-2" nombre="Validar entrada en el ingreso">
      <nota>El diagrama original no dibuja actor; por contexto lo ejecuta el empleado de control de acceso con escáner.</nota>
      <casos_uso>
        <caso_uso id="V1" nombre="Validar entrada en el ingreso" principal="true"/>
        <caso_uso id="V2" nombre="Escanear código de validación"/>
        <caso_uso id="V3" nombre="Verificar vigencia de la entrada"/>
        <caso_uso id="V4" nombre="Verificar estado de la entrada"/>
        <caso_uso id="V5" nombre="Registrar el ingreso"/>
        <caso_uso id="V6" nombre="Denegar acceso"/>
      </casos_uso>
      <relaciones>
        <include de="V1" a="V2"/><include de="V1" a="V3"/><include de="V1" a="V4"/><include de="V1" a="V5"/>
        <extend de="V6" a="V5"/>
      </relaciones>
    </diagrama_casos_de_uso>

    <diagrama_casos_de_uso id="CU-ENT-3" nombre="Consultar historial de ventas">
      <actores><actor id="adm" nombre="Administrador"/></actores>
      <casos_uso>
        <caso_uso id="H1" nombre="Consultar historial de ventas" principal="true"/>
        <caso_uso id="H2" nombre="Autenticar/verificar sesión del administrador"/>
        <caso_uso id="H3" nombre="Filtrar registros de venta"/>
        <caso_uso id="H4" nombre="Generar reporte"/>
        <caso_uso id="H5" nombre="Exportar historial"/>
      </casos_uso>
      <asociaciones><asoc actor="adm" caso_uso="H1"/></asociaciones>
      <relaciones>
        <include de="H1" a="H2"/><include de="H1" a="H3"/><include de="H1" a="H4"/>
        <extend de="H5" a="H4"/>
      </relaciones>
    </diagrama_casos_de_uso>

    <diagrama_actividades id="ACT-ENT" nombre="Compra de entrada por la web (flujo del cliente, sin carriles)">
      <nodos>
        <nodo id="ini" tipo="inicio" texto="Inicio"/>
        <nodo id="a1" tipo="accion" texto="Cliente ingresa a la web"/>
        <nodo id="a2" tipo="accion" texto="Elige la fecha de visita"/>
        <nodo id="d1" tipo="decision" texto="¿Tiene código de descuento?"/>
        <nodo id="a3" tipo="accion" texto="Ingresa código de descuento"/>
        <nodo id="a4" tipo="accion" texto="Se aplica el descuento"/>
        <nodo id="a5" tipo="accion" texto="Selecciona las entradas que quiere comprar"/>
        <nodo id="a6" tipo="accion" texto="Revisa el resumen de su compra"/>
        <nodo id="a7" tipo="accion" texto="Selecciona método de pago"/>
        <nodo id="d2" tipo="decision" texto="¿Qué tipo de tarjeta es?"/>
        <nodo id="a8" tipo="accion" texto="Ingresa información de la tarjeta (crédito)"/>
        <nodo id="a9" tipo="accion" texto="Ingresa información de la tarjeta (débito)"/>
        <nodo id="a10" tipo="accion" texto="Procede a pagar"/>
        <nodo id="a11" tipo="accion" texto="Procesa el pago"/>
        <nodo id="a12" tipo="accion" texto="Recibe el comprobante de compra"/>
        <nodo id="a13" tipo="accion" texto="Guarda el comprobante"/>
        <nodo id="fin" tipo="fin" texto="FIN"/>
      </nodos>
      <aristas>
        <arista de="ini" a="a1"/><arista de="a1" a="a2"/><arista de="a2" a="d1"/>
        <arista de="d1" a="a3" guarda="sí"/>
        <arista de="d1" a="a5" guarda="no"/>
        <arista de="a3" a="a4"/><arista de="a4" a="a5"/>
        <arista de="a5" a="a6"/><arista de="a6" a="a7"/><arista de="a7" a="d2"/>
        <arista de="d2" a="a8" guarda="Crédito"/>
        <arista de="d2" a="a9" guarda="Débito"/>
        <arista de="a8" a="a10"/><arista de="a9" a="a10"/>
        <arista de="a10" a="a11"/><arista de="a11" a="a12"/><arista de="a12" a="a13"/><arista de="a13" a="fin"/>
      </aristas>
      <nota>En el diagrama original el orden es: fecha → ¿código? → (ingresar/aplicar código) → seleccionar entradas.
            Funcionalmente el cálculo final del precio ocurre en el servidor (ver secuencia).</nota>
    </diagrama_actividades>

    <diagrama_secuencia id="SEQ-ENT" nombre="Proceso de compra de entrada">
      <participantes>
        <participante id="cli" tipo="actor" nombre="Cliente"/>
        <participante id="ui"  nombre="Interfaz Web/App"/>
        <participante id="srv" nombre="Servidor"/>
        <participante id="pay" nombre="Pasarela de Pagos"/>
        <participante id="db"  nombre="Base de Datos"/>
      </participantes>
      <mensajes>
        <mensaje n="1"  de="cli" a="ui"  tipo="sync">Ingresa al sitio web</mensaje>
        <mensaje n="2"  de="cli" a="ui"  tipo="sync">Elige fecha de visita</mensaje>
        <mensaje n="3"  de="cli" a="ui"  tipo="sync">Ingresa código de descuento</mensaje>
        <fragmento tipo="opt" condicion="Cliente tiene código de descuento">
          <mensaje n="4" de="ui"  a="srv" tipo="sync">validarCodigoDescuento(codigo)</mensaje>
          <mensaje n="5" de="srv" a="db"  tipo="sync">consultarCodigo(codigo)</mensaje>
          <mensaje n="6" de="db"  a="srv" tipo="retorno">resultado(valido/invalido)</mensaje>
          <mensaje n="7" de="srv" a="ui"  tipo="retorno">aplicarDescuento(monto)</mensaje>
        </fragmento>
        <mensaje n="8"  de="cli" a="ui"  tipo="sync">Selecciona entradas</mensaje>
        <mensaje n="9"  de="ui"  a="srv" tipo="sync">calcularPrecioTotal(entradas)</mensaje>
        <mensaje n="10" de="srv" a="ui"  tipo="retorno">totalCalculado</mensaje>
        <mensaje n="11" de="cli" a="ui"  tipo="sync">Revisa resumen de compra</mensaje>
        <mensaje n="12" de="cli" a="ui"  tipo="sync">Selecciona método de pago e ingresa datos de tarjeta</mensaje>
        <mensaje n="13" de="ui"  a="srv" tipo="sync">procesarPago(datosPago)</mensaje>
        <mensaje n="14" de="srv" a="pay" tipo="sync">procesarPago(monto, tarjeta)</mensaje>
        <mensaje n="15" de="pay" a="srv" tipo="retorno">pagoConfirmado</mensaje>
        <mensaje n="16" de="srv" a="db"  tipo="sync">registrarVenta(detalleCompra)</mensaje>
        <mensaje n="17" de="db"  a="srv" tipo="retorno">ventaRegistrada</mensaje>
        <mensaje n="18" de="srv" a="ui"  tipo="retorno">generarComprobante()</mensaje>
        <mensaje n="19" de="ui"  a="cli" tipo="retorno">Muestra/entrega comprobante</mensaje>
        <mensaje n="20" de="cli" a="cli" tipo="propio">Guarda el comprobante</mensaje>
      </mensajes>
    </diagrama_secuencia>

    <diagrama_estados id="EST-ENT" nombre="Ciclo de vida de la Entrada">
      <nota>En el PDF este diagrama aparece bajo el título "Diagrama de Despliegue", pero es un diagrama de estados (el índice lo lista como "Diagrama de Estados").</nota>
      <estados>
        <estado id="ini" tipo="inicio"/>
        <estado id="activa" nombre="Emitida / Activa"/>
        <estado id="usada" nombre="Utilizada"/>
        <estado id="vencida" nombre="Vencida"/>
        <estado id="cancelada" nombre="Cancelada / Anulada"/>
        <estado id="fin" tipo="fin"/>
      </estados>
      <transiciones>
        <t de="ini" a="activa"/>
        <t de="activa" a="usada" evento="Entrada escaneada y validada"/>
        <t de="activa" a="vencida" evento="Fecha de vigencia expirada (texto cortado en el original)"/>
        <t de="activa" a="cancelada" evento="Cliente solicita cancelación / Anulación administrativa"/>
        <t de="usada" a="fin" evento="Fin del ciclo de vida"/>
        <t de="vencida" a="fin" evento="Fin del ciclo de vida"/>
        <t de="cancelada" a="fin" evento="Fin del ciclo de vida"/>
      </transiciones>
    </diagrama_estados>

  </diagramas>
</modulo>
```

---

## 8. Módulo Control Clínico (CLI)

Gestiona la salud de los animales: consultas, diagnósticos, vacunas, medicamentos, vitaminas, inventario clínico y reportes, con **RBAC estricto**. Es el módulo con más requisitos de seguridad (MFA, cifrado en reposo, propiedad de registros, auditoría trimestral) y de continuidad (RPO/RTO, respaldos). El sistema actúa también como actor automático que genera alertas de vencimiento, refuerzos y recordatorios.

```xml
<modulo id="CLI" nombre="Control Clínico">
  <actores>Administrador del Sistema, Veterinario, Cuidador de Animales, Sistema (proceso automático)</actores>
  <estandares>RBAC, OWASP Top 10 (A01), NIST SP 800-63B, ISO/IEC 14764 (mantenimiento)</estandares>

  <reglas_negocio>
    <rn id="RN-CLI-01">El cuidador solo consulta (sin editar) el historial de los animales que tiene asignados (control de propiedad / anti-IDOR).</rn>
    <rn id="RN-CLI-02">Solo el administrador mueve inventario clínico y elimina registros clínicos; toda eliminación va a la bitácora.</rn>
    <rn id="RN-CLI-03">Si el tratamiento requiere refuerzo, el sistema programa una alerta/recordatorio automático (extend condicionado [requiere refuerzo]).</rn>
    <rn id="RN-CLI-04">Si no hay stock suficiente del producto, se genera alerta de reabastecimiento y no se aplica el descuento.</rn>
  </reglas_negocio>

  <requerimientos_funcionales>
    <rf id="RF-CLI-01">Veterinario y administrador registran consultas y diagnósticos por animal (veterinario responsable, fecha, diagnóstico).</rf>
    <rf id="RF-CLI-02">Veterinario y administrador registran aplicación de vacunas, medicamentos y vitaminas (producto, dosis, fecha).</rf>
    <rf id="RF-CLI-03">Consultar historial clínico completo: admin y vet con acceso total; cuidador solo lectura y solo animales asignados.</rf>
    <rf id="RF-CLI-04">Administrador (y veterinario en solo consulta) revisan el inventario clínico de medicamentos, vacunas y vitaminas.</rf>
    <rf id="RF-CLI-05">Solo el administrador registra movimientos de entrada/salida del inventario clínico.</rf>
    <rf id="RF-CLI-06">Solo el administrador elimina registros clínicos, dejando constancia en bitácora.</rf>
    <rf id="RF-CLI-07">Administrador y veterinario generan reportes de control clínico.</rf>
    <rf id="RF-CLI-08">Generar automáticamente alertas y notificaciones de vencimientos, refuerzos y recordatorios de vacunas y tratamientos.</rf>
    <rf id="RF-CLI-09">Autenticar usuarios y restringir funciones por rol (RBAC).</rf>
    <rf id="RF-CLI-10">Bitácora de auditoría de toda creación, modificación o eliminación de datos clínicos (usuario, fecha, hora, acción).</rf>
  </requerimientos_funcionales>

  <requerimientos_no_funcionales>
    <rnf id="RNF-CLI-01" categoria="Seguridad">Denegar por defecto; permisos explícitos por rol (OWASP A01).</rnf>
    <rnf id="RNF-CLI-02" categoria="Seguridad">Autorización validada siempre en el servidor.</rnf>
    <rnf id="RNF-CLI-03" categoria="Seguridad">Cuidador solo accede a animales asignados; evitar referencias directas manipulables (IDOR).</rnf>
    <rnf id="RNF-CLI-04" categoria="Seguridad">MFA obligatoria para Administrador, recomendada para Veterinario.</rnf>
    <rnf id="RNF-CLI-05" categoria="Seguridad">Contraseñas por longitud (mín. 8, ideal 12-15, hasta 64), sin cambios periódicos forzados (NIST SP 800-63B).</rnf>
    <rnf id="RNF-CLI-06" categoria="Seguridad">Información clínica cifrada en tránsito (HTTPS/TLS) y en reposo.</rnf>
    <rnf id="RNF-CLI-07" categoria="Seguridad">Bloqueo temporal tras intentos fallidos; notificar inicios de sesión inusuales.</rnf>
    <rnf id="RNF-CLI-08" categoria="Seguridad">Auditar roles y permisos al menos trimestralmente.</rnf>
    <rnf id="RNF-CLI-09" categoria="Mantenimiento">Mantenimiento preventivo (respaldo semanal, revisión mensual de integridad y vencimientos), correctivo, adaptativo y perfectivo (ISO/IEC 14764).</rnf>
    <rnf id="RNF-CLI-10" categoria="Respaldo">Respaldo completo semanal e incremental diario, al menos una copia fuera del servidor principal, prueba de restauración trimestral.</rnf>
    <rnf id="RNF-CLI-11" categoria="Continuidad">RPO = 24 horas; RTO = 4 a 8 horas.</rnf>
    <rnf id="RNF-CLI-12" categoria="Soporte">Incidencias críticas: atención menor a 1 h, resolución menor a 8 h. Altas: atención menor a 4 h, resolución menor a 24 h.</rnf>
  </requerimientos_no_funcionales>

  <diagramas>

    <diagrama_casos_de_uso id="CU-CLI-resumen" nombre="Vista general (último diagrama del PDF)">
      <actores>
        <actor id="vet" nombre="veterinario"/>
        <actor id="adm" nombre="administrador"/>
      </actores>
      <caso_uso id="CLI-Login" nombre="Iniciar Sesión" transversal="true"/>
      <paquete nombre="PROCESOS VETERINARIO" actor="vet">
        <caso_uso id="CLI-V1" nombre="Crear Ficha"/>
        <caso_uso id="CLI-V2" nombre="Agendar Vacunación"/>
        <caso_uso id="CLI-V3" nombre="Registrar Vacuna"/>
        <caso_uso id="CLI-V4" nombre="Registrar Vitamina"/>
        <caso_uso id="CLI-V5" nombre="Registrar Medicamento"/>
        <caso_uso id="CLI-V6" nombre="Consultar Historial Clínico"/>
        <caso_uso id="CLI-V7" nombre="Actualizar Ficha"/>
      </paquete>
      <paquete nombre="PROCESOS ADMINISTRADOR" actor="adm">
        <caso_uso id="CLI-A1" nombre="Generar Reportes"/>
        <caso_uso id="CLI-A2" nombre="Gestionar Inventario"/>
      </paquete>
      <relaciones>
        <asoc actor="vet" caso_uso="CLI-Login"/><asoc actor="adm" caso_uso="CLI-Login"/>
      </relaciones>
    </diagrama_casos_de_uso>

    <diagrama_casos_de_uso id="CU-CLI-detalle" nombre="Fragmentos detallados del actor veterinario">
      <fragmento nombre="Reportes">
        <caso_uso id="R1" nombre="Seleccionar Módulo de Reportes"/>
        <caso_uso id="R2" nombre="Seleccionar Tipo de Reporte"/>
        <caso_uso id="R3" nombre="Generar Reporte de Control Clínico"/>
        <include de="R2" a="R1"/><include de="R3" a="R2"/>
        <asoc actor="veterinario" caso_uso="R1"/><asoc actor="veterinario" caso_uso="R3"/>
      </fragmento>
      <fragmento nombre="Aplicar tratamiento (se repite para vitaminas, medicamento y vacunación)">
        <caso_uso id="T0" nombre="Buscar Animal"/>
        <caso_uso id="T1" nombre="Registrar Aplicación de Vitaminas | Registrar Aplicación de Medicamento | Registrar Vacunación"/>
        <caso_uso id="T2" nombre="Programar Cita"/>
        <include de="T1" a="T0"/>
        <extend de="T2" a="T1"/>
        <asoc actor="veterinario" caso_uso="T0"/><asoc actor="veterinario" caso_uso="T1"/>
      </fragmento>
      <fragmento nombre="Expediente y agenda">
        <caso_uso id="X0" nombre="Buscar Animal"/>
        <caso_uso id="X1" nombre="Crear Expediente Clínico"/>
        <caso_uso id="X2" nombre="Consultar Historial Clínico"/>
        <caso_uso id="X3" nombre="Agendar Cita"/>
        <extend de="X1" a="X0"/><extend de="X2" a="X0"/><include de="X3" a="X0"/>
        <asoc actor="veterinario" caso_uso="X3"/>
      </fragmento>
      <fragmento nombre="Ficha clínica">
        <caso_uso id="F0" nombre="Iniciar Sesión"/>
        <caso_uso id="F1" nombre="Buscar Animal"/>
        <caso_uso id="F2" nombre="Registrar Ficha Clínica"/>
        <caso_uso id="F3" nombre="Crear Expediente Clínico"/>
        <include de="F1" a="F0"/><include de="F2" a="F1"/><extend de="F3" a="F1"/>
        <asoc actor="veterinario" caso_uso="F0"/><asoc actor="veterinario" caso_uso="F2"/>
      </fragmento>
    </diagrama_casos_de_uso>

    <nota_importante>
      El texto del PDF describe 4 actores (incluye Cuidador y Sistema), 9 casos de uso en 3 paquetes
      (Atención clínica, Inventario clínico, Administración y reportes) más un paquete "Notificaciones automáticas",
      con CU-09 «extend» CU-03 [requiere refuerzo]. Los diagramas incluidos en el PDF NO muestran esa versión:
      solo muestran veterinario y administrador. Para implementar, usar los requerimientos RF-CLI-xx como fuente de verdad.
    </nota_importante>

    <diagrama_actividades id="ACT-CLI" nombre="Atención clínica (flujo en el PDF, sin carriles dibujados)">
      <nota>El texto menciona 4 carriles (Veterinario, Sistema, Administrador, Cuidador), pero la imagen es un flujo único.
            Los pasos de revisión administrativa y consulta del cuidador en paralelo descritos en el texto no aparecen dibujados.</nota>
      <nodos>
        <nodo id="ini" tipo="inicio"/>
        <nodo id="a1" tipo="accion" texto="Ingresar animal al consultorio veterinario"/>
        <nodo id="a2" tipo="accion" texto="Revisar historial clínico del animal"/>
        <nodo id="a3" tipo="accion" texto="Realizar examen físico y emitir diagnóstico"/>
        <nodo id="d1" tipo="decision" texto="¿Requiere tratamiento?"/>
        <nodo id="a4" tipo="accion" texto="Seleccionar tipo de tratamiento (medicamento / vacuna / vitamina)"/>
        <nodo id="a5" tipo="accion" texto="Registrar diagnóstico en historial clínico"/>
        <nodo id="d2" tipo="decision" texto="¿Hay stock suficiente?"/>
        <nodo id="a6" tipo="accion" texto="Generar alerta de reabastecimiento"/>
        <nodo id="a7" tipo="accion" texto="Registrar aplicación en historial clínico del animal"/>
        <nodo id="a8" tipo="accion" texto="Descontar existencia del inventario clínico"/>
        <nodo id="a9" tipo="accion" texto="Programar próximo chequeo / refuerzo (si aplica)"/>
        <nodo id="a10" tipo="accion" texto="Generar reporte de control clínico"/>
        <nodo id="fin" tipo="fin"/>
      </nodos>
      <aristas>
        <arista de="ini" a="a1"/><arista de="a1" a="a2"/><arista de="a2" a="a3"/><arista de="a3" a="d1"/>
        <arista de="d1" a="a4" guarda="sí"/>
        <arista de="d1" a="a5" guarda="no"/>
        <arista de="a4" a="d2"/>
        <arista de="d2" a="a6" guarda="no"/>
        <arista de="d2" a="a7" guarda="sí"/>
        <arista de="a7" a="a8"/><arista de="a8" a="a9"/>
        <arista de="a5" a="a10"/><arista de="a6" a="a10"/><arista de="a9" a="a10"/>
        <arista de="a10" a="fin"/>
      </aristas>
    </diagrama_actividades>

  </diagramas>
</modulo>
```

---

## 9. Base de datos

Modelo relacional con **26 entidades**: 4 del núcleo compartido (`especie`, `habitat`, `animal`, `empleado`) y 22 repartidas entre los cuatro módulos. El PDF indica que el ER fue hecho en dbdiagram.io y que existe un `.dbml` aparte (no incluido en el PDF); aquí se reconstruye desde el diccionario de datos. Todas las PK son `int`. Las columnas marcadas con `fk` indican la tabla referenciada.

```xml
<base_de_datos motor="MySQL 8" entidades="26">

  <nucleo>
    <tabla nombre="especie" descripcion="Catálogo de especies">
      <col nombre="id_especie" tipo="int" llave="PK"/>
      <col nombre="nombre_cientifico" tipo="varchar(100)"/>
      <col nombre="nombre_comun" tipo="varchar(100)"/>
      <col nombre="clasificacion" tipo="varchar(50)" desc="mamífero, ave, reptil..."/>
      <col nombre="tipo_dieta" tipo="varchar(50)" desc="carnívoro, herbívoro, omnívoro"/>
    </tabla>
    <tabla nombre="habitat" descripcion="Espacios físicos donde residen los animales">
      <col nombre="id_habitat" tipo="int" llave="PK"/>
      <col nombre="nombre" tipo="varchar(100)"/>
      <col nombre="tipo" tipo="varchar(50)" desc="jaula, recinto abierto, acuario..."/>
      <col nombre="ubicacion" tipo="varchar(100)"/>
      <col nombre="capacidad_max" tipo="int"/>
    </tabla>
    <tabla nombre="animal" descripcion="Registro individual de cada animal">
      <col nombre="id_animal" tipo="int" llave="PK"/>
      <col nombre="nombre" tipo="varchar(100)"/>
      <col nombre="id_especie" tipo="int" llave="FK" ref="especie.id_especie"/>
      <col nombre="id_habitat" tipo="int" llave="FK" ref="habitat.id_habitat"/>
      <col nombre="fecha_nacimiento" tipo="date"/>
      <col nombre="sexo" tipo="varchar(10)"/>
      <col nombre="procedencia" tipo="varchar(100)"/>
      <col nombre="estado_salud" tipo="varchar(50)"/>
      <col nombre="fecha_ingreso" tipo="date"/>
    </tabla>
    <tabla nombre="empleado" descripcion="Personal que usa el sistema">
      <col nombre="id_empleado" tipo="int" llave="PK"/>
      <col nombre="nombre" tipo="varchar(100)"/>
      <col nombre="puesto" tipo="varchar(50)"/>
      <col nombre="telefono" tipo="varchar(20)"/>
      <col nombre="email" tipo="varchar(100)"/>
      <col nombre="usuario" tipo="varchar(50)" desc="usuario de acceso"/>
      <col nombre="password_hash" tipo="varchar(255)"/>
      <col nombre="fecha_contratacion" tipo="date"/>
    </tabla>
  </nucleo>

  <modulo_limpieza>
    <tabla nombre="area" descripcion="Espacios sujetos a limpieza">
      <col nombre="id_area" tipo="int" llave="PK"/>
      <col nombre="nombre" tipo="varchar(100)"/>
      <col nombre="tipo" tipo="varchar(30)" desc="jaula / sanitario / jardín / área de juegos / oficina"/>
      <col nombre="id_habitat" tipo="int" llave="FK" ref="habitat.id_habitat" desc="si aplica"/>
      <col nombre="ubicacion" tipo="varchar(100)"/>
    </tabla>
    <tabla nombre="insumo_limpieza" descripcion="Productos de limpieza en bodega">
      <col nombre="id_insumo" tipo="int" llave="PK"/>
      <col nombre="nombre" tipo="varchar(100)"/>
      <col nombre="stock_actual" tipo="decimal"/>
      <col nombre="stock_minimo" tipo="decimal"/>
      <col nombre="unidad_medida" tipo="varchar(20)"/>
    </tabla>
    <tabla nombre="tarea_limpieza" descripcion="Tareas asignadas y ejecutadas por área">
      <col nombre="id_tarea" tipo="int" llave="PK"/>
      <col nombre="id_area" tipo="int" llave="FK" ref="area.id_area"/>
      <col nombre="id_empleado" tipo="int" llave="FK" ref="empleado.id_empleado"/>
      <col nombre="fecha" tipo="date"/>
      <col nombre="hora_inicio" tipo="time"/>
      <col nombre="hora_fin" tipo="time"/>
      <col nombre="estado" tipo="varchar(20)" desc="pendiente / en proceso / completada"/>
      <col nombre="observaciones" tipo="text"/>
    </tabla>
    <tabla nombre="tarea_insumo" descripcion="Insumos usados por tarea (N:M)">
      <col nombre="id_tarea" tipo="int" llave="PK,FK" ref="tarea_limpieza.id_tarea"/>
      <col nombre="id_insumo" tipo="int" llave="PK,FK" ref="insumo_limpieza.id_insumo"/>
      <col nombre="cantidad_usada" tipo="decimal"/>
    </tabla>
  </modulo_limpieza>

  <modulo_alimentacion>
    <tabla nombre="alimento" descripcion="Catálogo de alimentos">
      <col nombre="id_alimento" tipo="int" llave="PK"/>
      <col nombre="nombre" tipo="varchar(100)"/>
      <col nombre="tipo" tipo="varchar(50)"/>
      <col nombre="unidad_medida" tipo="varchar(20)" desc="kg, unidades..."/>
    </tabla>
    <tabla nombre="inventario_alimento" descripcion="Stock disponible por alimento">
      <col nombre="id_inventario" tipo="int" llave="PK"/>
      <col nombre="id_alimento" tipo="int" llave="FK" ref="alimento.id_alimento"/>
      <col nombre="stock_actual" tipo="decimal"/>
      <col nombre="stock_minimo" tipo="decimal"/>
      <col nombre="fecha_actualizacion" tipo="datetime"/>
    </tabla>
    <tabla nombre="dieta" descripcion="Plan de alimentación asignado a cada animal">
      <col nombre="id_dieta" tipo="int" llave="PK"/>
      <col nombre="id_animal" tipo="int" llave="FK" ref="animal.id_animal"/>
      <col nombre="id_alimento" tipo="int" llave="FK" ref="alimento.id_alimento"/>
      <col nombre="cantidad" tipo="decimal"/>
      <col nombre="frecuencia_diaria" tipo="int"/>
      <col nombre="hora" tipo="time"/>
    </tabla>
    <tabla nombre="registro_alimentacion" descripcion="Historial real de alimentación administrada">
      <col nombre="id_registro" tipo="int" llave="PK"/>
      <col nombre="id_dieta" tipo="int" llave="FK" ref="dieta.id_dieta"/>
      <col nombre="id_empleado" tipo="int" llave="FK" ref="empleado.id_empleado"/>
      <col nombre="fecha" tipo="date"/>
      <col nombre="hora" tipo="time"/>
      <col nombre="cantidad_administrada" tipo="decimal"/>
      <col nombre="observaciones" tipo="text"/>
    </tabla>
  </modulo_alimentacion>

  <modulo_clinico>
    <tabla nombre="veterinario" descripcion="Personal médico veterinario">
      <col nombre="id_veterinario" tipo="int" llave="PK"/>
      <col nombre="nombre" tipo="varchar(100)"/>
      <col nombre="especialidad" tipo="varchar(100)"/>
      <col nombre="telefono" tipo="varchar(20)"/>
      <col nombre="email" tipo="varchar(100)"/>
      <col nombre="num_colegiado" tipo="varchar(20)"/>
    </tabla>
    <tabla nombre="medicamento" descripcion="Catálogo de medicamentos">
      <col nombre="id_medicamento" tipo="int" llave="PK"/>
      <col nombre="nombre" tipo="varchar(100)"/>
      <col nombre="tipo" tipo="varchar(50)"/>
      <col nombre="stock_actual" tipo="decimal"/>
      <col nombre="unidad_medida" tipo="varchar(20)"/>
    </tabla>
    <tabla nombre="vacuna" descripcion="Catálogo de vacunas">
      <col nombre="id_vacuna" tipo="int" llave="PK"/>
      <col nombre="nombre" tipo="varchar(100)"/>
      <col nombre="enfermedad_previene" tipo="varchar(100)"/>
      <col nombre="dosis_recomendada" tipo="varchar(50)"/>
    </tabla>
    <tabla nombre="vitamina" descripcion="Catálogo de vitaminas y suplementos">
      <col nombre="id_vitamina" tipo="int" llave="PK"/>
      <col nombre="nombre" tipo="varchar(100)"/>
      <col nombre="dosis_recomendada" tipo="varchar(50)"/>
    </tabla>
    <tabla nombre="consulta_clinica" descripcion="Consultas médicas a animales">
      <col nombre="id_consulta" tipo="int" llave="PK"/>
      <col nombre="id_animal" tipo="int" llave="FK" ref="animal.id_animal"/>
      <col nombre="id_veterinario" tipo="int" llave="FK" ref="veterinario.id_veterinario"/>
      <col nombre="fecha" tipo="date"/>
      <col nombre="diagnostico" tipo="text"/>
      <col nombre="tratamiento" tipo="text"/>
      <col nombre="observaciones" tipo="text"/>
    </tabla>
    <tabla nombre="aplicacion_medicamento" descripcion="Medicamentos aplicados en una consulta">
      <col nombre="id_aplicacion" tipo="int" llave="PK"/>
      <col nombre="id_consulta" tipo="int" llave="FK" ref="consulta_clinica.id_consulta"/>
      <col nombre="id_medicamento" tipo="int" llave="FK" ref="medicamento.id_medicamento"/>
      <col nombre="dosis" tipo="varchar(50)"/>
      <col nombre="fecha_aplicacion" tipo="date"/>
    </tabla>
    <tabla nombre="aplicacion_vacuna" descripcion="Historial de vacunas por animal">
      <col nombre="id_aplicacion" tipo="int" llave="PK"/>
      <col nombre="id_animal" tipo="int" llave="FK" ref="animal.id_animal"/>
      <col nombre="id_vacuna" tipo="int" llave="FK" ref="vacuna.id_vacuna"/>
      <col nombre="id_veterinario" tipo="int" llave="FK" ref="veterinario.id_veterinario"/>
      <col nombre="fecha_aplicacion" tipo="date"/>
      <col nombre="proxima_dosis" tipo="date" desc="base para alertas de refuerzo"/>
    </tabla>
    <tabla nombre="aplicacion_vitamina" descripcion="Historial de vitaminas por animal">
      <col nombre="id_aplicacion" tipo="int" llave="PK"/>
      <col nombre="id_animal" tipo="int" llave="FK" ref="animal.id_animal"/>
      <col nombre="id_vitamina" tipo="int" llave="FK" ref="vitamina.id_vitamina"/>
      <col nombre="id_veterinario" tipo="int" llave="FK" ref="veterinario.id_veterinario"/>
      <col nombre="fecha_aplicacion" tipo="date"/>
      <col nombre="dosis" tipo="varchar(50)"/>
    </tabla>
  </modulo_clinico>

  <modulo_entradas>
    <tabla nombre="usuario_app" descripcion="Usuarios del sitio/app público">
      <col nombre="id_usuario" tipo="int" llave="PK"/>
      <col nombre="nombre" tipo="varchar(100)"/>
      <col nombre="email" tipo="varchar(100)"/>
      <col nombre="password_hash" tipo="varchar(255)"/>
      <col nombre="telefono" tipo="varchar(20)"/>
      <col nombre="fecha_registro" tipo="datetime"/>
    </tabla>
    <tabla nombre="tipo_entrada" descripcion="Tipos de entrada (general, niño, adulto mayor, VIP)">
      <col nombre="id_tipo_entrada" tipo="int" llave="PK"/>
      <col nombre="nombre" tipo="varchar(50)"/>
      <col nombre="descripcion" tipo="varchar(200)"/>
      <col nombre="precio" tipo="decimal" desc="precio unitario"/>
    </tabla>
    <tabla nombre="promocion" descripcion="Promociones y descuentos vigentes">
      <col nombre="id_promocion" tipo="int" llave="PK"/>
      <col nombre="nombre" tipo="varchar(100)"/>
      <col nombre="descripcion" tipo="varchar(200)"/>
      <col nombre="descuento_porcentaje" tipo="decimal"/>
      <col nombre="fecha_inicio" tipo="date"/>
      <col nombre="fecha_fin" tipo="date"/>
    </tabla>
    <tabla nombre="compra" descripcion="Compras de los usuarios">
      <col nombre="id_compra" tipo="int" llave="PK"/>
      <col nombre="id_usuario" tipo="int" llave="FK" ref="usuario_app.id_usuario"/>
      <col nombre="fecha" tipo="datetime"/>
      <col nombre="total" tipo="decimal"/>
      <col nombre="metodo_pago" tipo="varchar(30)"/>
    </tabla>
    <tabla nombre="detalle_compra" descripcion="Entradas incluidas en cada compra">
      <col nombre="id_detalle" tipo="int" llave="PK"/>
      <col nombre="id_compra" tipo="int" llave="FK" ref="compra.id_compra"/>
      <col nombre="id_tipo_entrada" tipo="int" llave="FK" ref="tipo_entrada.id_tipo_entrada"/>
      <col nombre="id_promocion" tipo="int" llave="FK" ref="promocion.id_promocion" desc="nullable: si corresponde"/>
      <col nombre="cantidad" tipo="int"/>
      <col nombre="subtotal" tipo="decimal"/>
    </tabla>
    <tabla nombre="entrada" descripcion="Entradas individuales con QR">
      <col nombre="id_entrada" tipo="int" llave="PK"/>
      <col nombre="id_detalle" tipo="int" llave="FK" ref="detalle_compra.id_detalle"/>
      <col nombre="codigo_qr" tipo="varchar(100)" desc="único"/>
      <col nombre="fecha_visita" tipo="date"/>
      <col nombre="estado" tipo="varchar(20)" desc="válida / usada / vencida"/>
      <col nombre="hora_uso" tipo="time"/>
    </tabla>
  </modulo_entradas>

  <diagrama_er id="ER-GENERAL" nombre="Relaciones (cardinalidad padre 1 → hijo N)">
    <!-- Núcleo -->
    <relacion padre="especie" hijo="animal" fk="id_especie" cardinalidad="1:N"/>
    <relacion padre="habitat" hijo="animal" fk="id_habitat" cardinalidad="1:N"/>
    <!-- Limpieza -->
    <relacion padre="habitat" hijo="area" fk="id_habitat" cardinalidad="1:N" opcional="true"/>
    <relacion padre="area" hijo="tarea_limpieza" fk="id_area" cardinalidad="1:N"/>
    <relacion padre="empleado" hijo="tarea_limpieza" fk="id_empleado" cardinalidad="1:N"/>
    <relacion padre="tarea_limpieza" hijo="tarea_insumo" fk="id_tarea" cardinalidad="1:N"/>
    <relacion padre="insumo_limpieza" hijo="tarea_insumo" fk="id_insumo" cardinalidad="1:N"/>
    <!-- Alimentación -->
    <relacion padre="alimento" hijo="inventario_alimento" fk="id_alimento" cardinalidad="1:N"/>
    <relacion padre="animal" hijo="dieta" fk="id_animal" cardinalidad="1:N"/>
    <relacion padre="alimento" hijo="dieta" fk="id_alimento" cardinalidad="1:N"/>
    <relacion padre="dieta" hijo="registro_alimentacion" fk="id_dieta" cardinalidad="1:N"/>
    <relacion padre="empleado" hijo="registro_alimentacion" fk="id_empleado" cardinalidad="1:N"/>
    <!-- Clínico -->
    <relacion padre="animal" hijo="consulta_clinica" fk="id_animal" cardinalidad="1:N"/>
    <relacion padre="veterinario" hijo="consulta_clinica" fk="id_veterinario" cardinalidad="1:N"/>
    <relacion padre="consulta_clinica" hijo="aplicacion_medicamento" fk="id_consulta" cardinalidad="1:N"/>
    <relacion padre="medicamento" hijo="aplicacion_medicamento" fk="id_medicamento" cardinalidad="1:N"/>
    <relacion padre="animal" hijo="aplicacion_vacuna" fk="id_animal" cardinalidad="1:N"/>
    <relacion padre="vacuna" hijo="aplicacion_vacuna" fk="id_vacuna" cardinalidad="1:N"/>
    <relacion padre="veterinario" hijo="aplicacion_vacuna" fk="id_veterinario" cardinalidad="1:N"/>
    <relacion padre="animal" hijo="aplicacion_vitamina" fk="id_animal" cardinalidad="1:N"/>
    <relacion padre="vitamina" hijo="aplicacion_vitamina" fk="id_vitamina" cardinalidad="1:N"/>
    <relacion padre="veterinario" hijo="aplicacion_vitamina" fk="id_veterinario" cardinalidad="1:N"/>
    <!-- Entradas -->
    <relacion padre="usuario_app" hijo="compra" fk="id_usuario" cardinalidad="1:N"/>
    <relacion padre="compra" hijo="detalle_compra" fk="id_compra" cardinalidad="1:N"/>
    <relacion padre="tipo_entrada" hijo="detalle_compra" fk="id_tipo_entrada" cardinalidad="1:N"/>
    <relacion padre="promocion" hijo="detalle_compra" fk="id_promocion" cardinalidad="1:N" opcional="true"/>
    <relacion padre="detalle_compra" hijo="entrada" fk="id_detalle" cardinalidad="1:N"/>
    <nota>tarea_insumo implementa la relación N:M entre tarea_limpieza e insumo_limpieza (PK compuesta).</nota>
  </diagrama_er>

</base_de_datos>
```

---

## 10. Plan de desarrollo por Sprint

La metodología es Scrum con tres bloques en Jira (la tabla del texto habla de 2 sprints; el tablero de Jira muestra 3, incluyendo Documentación). Cada integrante es dueño de un módulo, y Emilio integra el código en `develop` revisando los Pull Requests.

```xml
<plan_desarrollo>
  <equipo>
    <integrante nombre="Alan"    modulo="Limpieza"/>
    <integrante nombre="Mijeli"  modulo="Alimentación + inventario compartido" rol="Scrum Master"/>
    <integrante nombre="Mario"   modulo="Entradas y Promociones"/>
    <integrante nombre="Daniela" modulo="Control Clínico" extra="plan de seguridad/RBAC y mantenimiento"/>
    <integrante nombre="Emilio"  modulo="Base de datos y arquitectura" extra="integración de ramas, seguridad, middleware"/>
  </equipo>

  <flujo_git>Una rama por módulo → Pull Request en GitHub → revisión (Emilio) → merge a develop (integración diaria en Sprint 2)</flujo_git>

  <sprint nombre="Sprint 1 Análisis" jira="11 sep - 18 sep">
    <tarea id="PDSZ-2">Plantilla maestra y estándares de documentación</tarea>
    <tarea id="PDSZ-3">Documento maestro integrado</tarea>
    <tarea id="PDSZ-4">Módulo Limpieza</tarea><tarea id="PDSZ-5">Módulo Alimentación</tarea>
    <tarea id="PDSZ-6">Módulo Entradas</tarea><tarea id="PDSZ-7">Módulo Clínico</tarea>
    <tarea id="PDSZ-8">Arquitectura y Base de datos</tarea>
  </sprint>
  <sprint nombre="Sprint 2 Desarrollo" jira="18 sep - 22 sep">
    <tarea id="PDSZ-9">Repositorio, base de datos, login, roles y layout base</tarea>
    <tarea id="PDSZ-10">CRUD Agenda de Limpieza</tarea>
    <tarea id="PDSZ-11">CRUD Compra de entradas</tarea>
    <tarea id="PDSZ-12">CRUD Control Clínico</tarea>
    <tarea id="PDSZ-13">CRUD Control de Alimentación</tarea>
    <tarea id="PDSZ-14">Integración de código</tarea>
    <tarea id="PDSZ-15">Campo de pruebas</tarea>
    <tarea id="PDSZ-16">Análisis de seguridad</tarea>
  </sprint>
  <sprint nombre="Sprint 3 Documentación" jira="23 sep - 25 sep">
    <tarea id="PDSZ-17">Manual técnico</tarea><tarea id="PDSZ-18">Manual de usuario</tarea>
    <tarea id="PDSZ-19">Documentación</tarea><tarea id="PDSZ-20">Presentación para exposición</tarea>
  </sprint>

  <backlog_tecnico prioridad="MoSCoW" puntos="1,2,3,5,8">
    <item epic="Arquitectura/BD" prioridad="Debe" puntos="8" responsable="Emilio">Modelo entidad-relación y diccionario de datos</item>
    <item epic="Arquitectura/BD" prioridad="Debe" puntos="5" responsable="Emilio">Diagrama de arquitectura, componentes y despliegue</item>
    <item epic="Arquitectura/BD" prioridad="Debe" puntos="5" responsable="Emilio">Base de datos, migraciones y datos de prueba</item>
    <item epic="Arquitectura/BD" prioridad="Debe" puntos="5" responsable="Emilio">Middleware de seguridad (RBAC, bitácora de auditoría)</item>
    <item epic="Arquitectura/BD" prioridad="Debería" puntos="3" responsable="Emilio">Tablero de indicadores (dashboard)</item>
    <item epic="Limpieza" prioridad="Debe" puntos="3" responsable="Alan">Catálogo de áreas y checklist por tipo de área</item>
    <item epic="Limpieza" prioridad="Debe" puntos="5" responsable="Alan">Programación y asignación de tareas por turno</item>
    <item epic="Limpieza" prioridad="Debe" puntos="3" responsable="Alan">Autorización del cuidador para intervenir jaulas</item>
    <item epic="Limpieza" prioridad="Debe" puntos="5" responsable="Alan">Registro de ejecución y validación del supervisor</item>
    <item epic="Limpieza" prioridad="Debe" puntos="3" responsable="Alan">Reportes de cumplimiento y consumo de insumos</item>
    <item epic="Alimentación" prioridad="Debe" puntos="3" responsable="Mijeli">Dietas por especie o por animal</item>
    <item epic="Alimentación" prioridad="Debe" puntos="8" responsable="Mijeli">Inventario compartido (alimento, medicamento, insumo)</item>
    <item epic="Alimentación" prioridad="Debería" puntos="3" responsable="Mijeli">Alertas de stock bajo y productos por vencer</item>
    <item epic="Entradas" prioridad="Debe" puntos="3" responsable="Mario">Tipos de entrada y promociones con vigencia</item>
    <item epic="Entradas" prioridad="Debe" puntos="5" responsable="Mario">Compra en línea con pago simulado y entrada con QR</item>
    <item epic="Entradas" prioridad="Debe" puntos="3" responsable="Mario">Validación de QR y venta presencial en taquilla</item>
    <item epic="Clínico" prioridad="Debe" puntos="5" responsable="Daniela">Expediente clínico, consultas y tratamientos</item>
    <item epic="Clínico" prioridad="Debería" puntos="3" responsable="Daniela">Calendario de vacunas con alertas de pendientes</item>
    <item epic="Calidad" prioridad="Debe" puntos="3" responsable="Todos">Matriz de pruebas cruzadas del sistema</item>
    <item epic="Calidad" prioridad="Debe" puntos="5" responsable="Emilio">Pruebas de seguridad (inyección SQL, XSS, CSRF, fuerza bruta)</item>
  </backlog_tecnico>

  <pruebas>
    caja blanca y caja negra, validación de formularios, pruebas de estrés en compra de entradas,
    plan de pruebas estructurado, pruebas cruzadas entre integrantes, pruebas de seguridad
  </pruebas>
</plan_desarrollo>
```

---

## 11. Brechas e inconsistencias detectadas

Estas diferencias entre los requerimientos y el modelo de datos/diagramas del PDF no las resuelve el documento. Conviene decidirlas antes de generar código, porque afectan tablas, endpoints y reglas.

```xml
<brechas_y_decisiones_pendientes>

  <grupo nombre="Modelo de datos incompleto frente a requerimientos">
    <brecha id="B1">RBAC: no hay tablas de roles/permisos; empleado no tiene campo de rol (solo "puesto"), y usuario_app no distingue rol. Falta también la tabla de bitácora de auditoría (RF-LIM-22, RNF-ALI-02, RF-CLI-10).</brecha>
    <brecha id="B2">Asignación cuidador-animal (necesaria para RNF-CLI-03, solo ver animales asignados) y cuidador-recinto/horario (RF-ALI-02) no están modeladas.</brecha>
    <brecha id="B3">Limpieza: faltan plan_limpieza, checklist, incidencia y autorización de cuidador para jaulas. tarea_limpieza.estado solo tiene pendiente/en proceso/completada; faltan pendiente de validación, rechazada/devuelta, aprobada, vencida y pospuesta. tarea_limpieza.id_empleado no cubre al supervisor que valida ni al cuidador que autoriza.</brecha>
    <brecha id="B4">Alimentación: faltan proveedor, compra de alimento y lote (con fecha de vencimiento). inventario_alimento guarda un solo stock por alimento, así que no soporta el descuento por lote más próximo a vencer (FEFO). registro_alimentacion no referencia lote. Faltan horarios por recinto y tabla de alertas.</brecha>
    <brecha id="B5">dieta se vincula solo a animal, pero RF-ALI-01 exige dietas por especie o por animal.</brecha>
    <brecha id="B6">Clínico: veterinario es una tabla aparte sin vínculo con empleado ni usuario de login. medicamento tiene stock_actual pero vacuna y vitamina no tienen stock, aunque RF-CLI-04/05 piden inventario clínico de los tres. Faltan movimiento_inventario_clinico, alertas/recordatorios y citas (los diagramas muestran "Programar/Agendar Cita"). aplicacion_medicamento depende de consulta (no de animal directo) mientras vacuna/vitamina cuelgan de animal.</brecha>
    <brecha id="B7">Entradas: faltan aforo por fecha (RN-ENT-02), categorías/membresías/modalidad de vigencia, código promocional (promocion no tiene código), cliente-membresía, y fecha de vencimiento de la entrada. tipo_entrada se describe como general/niño/adulto mayor/VIP, pero los requerimientos hablan de discapacidad y familia numerosa. entrada.estado (válida/usada/vencida) no incluye "cancelada/anulada" del diagrama de estados. No hay tabla de taquilla/ventas presenciales (compra exige id_usuario).</brecha>
    <brecha id="B8">El PDF dice "inventario compartido (alimento, medicamento, insumo)" pero el modelo tiene tres inventarios separados (inventario_alimento, stock en insumo_limpieza, stock en medicamento).</brecha>
  </grupo>

  <grupo nombre="Inconsistencias de documentación">
    <incons id="I1">Stack: Limpieza fija Spring Boot + MySQL 8 + Ubuntu 24.04; la arquitectura general deja "MySQL o PostgreSQL" y backend sin definir.</incons>
    <incons id="I2">Roles: el alcance general lista (público, empleado, veterinario, administrador), pero los módulos usan además supervisor de limpieza, cuidador, encargado de bodega, director y taquillero.</incons>
    <incons id="I3">Entradas: el texto de alcance habla de membresías y pases de varios días, pero ni el modelo ER ni los diagramas los incluyen. El diagrama de actividades pone el código de descuento antes de elegir entradas.</incons>
    <incons id="I4">Clínico: el texto describe 4 actores, 9 casos de uso y 4 carriles; los diagramas solo muestran veterinario y administrador, y el de actividades no tiene carriles.</incons>
    <incons id="I5">Entradas: el diagrama de estados está titulado "Diagrama de Despliegue" en el PDF; no hay diagrama de despliegue real aunque el backlog lo menciona.</incons>
    <incons id="I6">Sprints: el texto de metodología habla de 2 sprints; Jira muestra 3 (Análisis, Desarrollo, Documentación) con fechas distintas al calendario del 23 sep - 3 oct.</incons>
    <incons id="I7">Numeración de páginas: el índice usa numeración interna distinta del número de página PDF (desfase de 4 páginas).</incons>
  </grupo>

</brechas_y_decisiones_pendientes>
```

---

## 12. Recomendaciones técnicas del documento

```xml
<recomendaciones>
  <seguridad>
    <item>Implementar RBAC desde la primera versión; no otorgar permisos individuales fuera de los roles.</item>
    <item>Política de contraseñas por longitud, MFA para roles administrativos, verificación contra contraseñas filtradas (NIST SP 800-63B).</item>
    <item>Denegar por defecto en todos los endpoints; autorización siempre en servidor (OWASP A01).</item>
    <item>Cifrar datos sensibles (clínicos y de pago) en tránsito y en reposo.</item>
    <item>Auditorías trimestrales de roles, permisos y bitácoras.</item>
    <item>Proteger especialmente Entradas (único módulo público): rate limiting, pago en proveedor PCI-DSS, sin manejar tarjeta directamente.</item>
  </seguridad>
  <operacion>
    <item>Automatizar respaldos y probar restauraciones periódicamente.</item>
    <item>Ambiente de pruebas (staging) separado de producción.</item>
    <item>Bitácora de versiones y diccionario de datos siempre actualizado.</item>
    <item>Monitorear disco, tiempos de respuesta y errores.</item>
    <item>Capacitar al personal de cada rol antes de producción.</item>
  </operacion>
  <mejoras_futuras>
    <item>Catálogo único de animales y hábitats compartido entre Limpieza, Alimentación y Clínico (evitar duplicidad).</item>
    <item>Notificaciones push en la app para cuidadores y veterinarios (tareas, refuerzos).</item>
    <item>Sensores IoT en hábitats (temperatura/humedad) cruzados con Limpieza y Clínico.</item>
    <item>Hosting en nube con autoescalado para picos de tráfico en Entradas.</item>
    <item>Política de manejo de datos personales de visitantes (nombre, correo, medios de pago).</item>
  </mejoras_futuras>
</recomendaciones>
```
