export const SystemPermissions = {
  // GESTIÓN ACADÉMICA
  ACADEMIC_YEARS_CREATE: 'academic_years:create',
  ACADEMIC_YEARS_UPDATE: 'academic_years:update',
  ACADEMIC_YEARS_DELETE: 'academic_years:delete',
  // ==========================================
  // CONTROL DE ASISTENCIA
  // ==========================================
  ATTENDANCE_READ: 'attendance:read', // Ver monitores e historial
  ATTENDANCE_WRITE: 'attendance:write', // Marcar asistencia (QR o Manual)
  ATTENDANCE_JUSTIFY: 'attendance:justify', // Convertir faltas en Licencias
  // ==========================================
  // CONFIGURACIÓN DE HORARIOS (Campanario)
  // ==========================================
  CLASS_PERIODS_CREATE: 'class_periods:create',
  CLASS_PERIODS_UPDATE: 'class_periods:update',
  CLASS_PERIODS_DELETE: 'class_periods:delete',
  // ==========================================
  // CURSOS Y PARALELOS (Aulas)
  // ==========================================
  CLASSROOMS_CREATE: 'classrooms:create',
  CLASSROOMS_UPDATE: 'classrooms:update',
  CLASSROOMS_DELETE: 'classrooms:delete',
  // ==========================================
  // ACTUALIZACIÓN DE DATOS (RUDE)
  // ==========================================
  RUDE_READ: 'rude:read', // Ver panel de solicitudes pendientes
  RUDE_WRITE: 'rude:write', // Aprobar, rechazar, marcar entrega física
  RUDE_CAMPAIGN: 'rude:campaign', // Enviar notificaciones push/email por curso
  RUDE_MASSIVE: 'rude:massive', // ☢️ PODER NUCLEAR: Push a todo el colegio
  // ==========================================
  // INSCRIPCIONES (Kardex / RUDE)
  // ==========================================
  ENROLLMENTS_READ: 'enrollments:read', // Ver listado y Kardex
  ENROLLMENTS_WRITE: 'enrollments:write', // Crear, actualizar, transferir, retirar
  ENROLLMENTS_DELETE: 'enrollments:delete', // Borrado físico (Raro, pero posible)
  // ==========================================
  // CALIFICACIONES Y LIBRETA
  // ==========================================
  GRADES_READ: 'grades:read', // Ver planillas de notas
  GRADES_WRITE: 'grades:write', // Ingresar o editar notas
  // ==========================================
  // APP MÓVIL (Padres / Tutores)
  // ==========================================
  GUARDIAN_PROFILE_READ: 'guardian_profile:read', // Permite al padre ver a sus propios hijos
  // ==========================================
  // IDENTIDAD Y CARNETIZACIÓN (Credenciales QR)
  // ==========================================
  IDENTITY_READ: 'identity:read', // Consultar el estado del QR de un alumno
  IDENTITY_WRITE: 'identity:write', // Generar o revocar credenciales
  IDENTITY_EXPORT: 'identity:export', // Generar el lote .zip para la imprenta
  // ==========================================
  // CONFIGURACIÓN INSTITUCIONAL (RUE)
  // ==========================================
  INSTITUTION_WRITE: 'institution:write', // Crear o actualizar datos y reglas del colegio
  // ==========================================
  // INFRAESTRUCTURA (Espacios Físicos)
  // ==========================================
  PHYSICAL_SPACES_WRITE: 'physical_spaces:write', // Crear, editar o eliminar aulas/canchas
  // ==========================================
  // ESTUDIANTES (Importaciones y RUDE)
  // ==========================================
  STUDENTS_WRITE: 'students:write', // Permite registrar alumnos completos o importar Excels
  // ==========================================
  // CATÁLOGO DE MATERIAS
  // ==========================================
  SUBJECTS_WRITE: 'subjects:write', // Crear, editar o eliminar materias del catálogo
  // ==========================================
  // CARGA HORARIA (Asignaciones)
  // ==========================================
  TEACHER_ASSIGNMENTS_READ: 'teacher_assignments:read', // Ver materias asignadas
  TEACHER_ASSIGNMENTS_WRITE: 'teacher_assignments:write', // Asignar, clonar o quitar materias
  // ==========================================
  // HORARIOS ESCOLARES (Campanario y Casilleros)
  // ==========================================
  TIMETABLES_READ: 'timetables:read', // Ver y descargar horarios en PDF
  TIMETABLES_WRITE: 'timetables:write', // Asignar, mover o eliminar materias del horario
  // ==========================================
  // CONFIGURACIÓN DE TRIMESTRES
  // ==========================================
  TRIMESTERS_WRITE: 'trimesters:write', // Modificar fechas y abrir/cerrar sistema de notas
  // ==========================================
  // GESTIÓN DE USUARIOS
  // ==========================================
  USERS_READ: 'users:read', // Ver listado de usuarios del sistema
  USERS_WRITE: 'users:write', // Crear, editar, desactivar o resetear contraseñas

  // INSTITUCIÓN
  INSTITUTION_MANAGE: 'institution:manage',

  // PERMISO SUPREMO (Root)
  MANAGE_ALL: 'manage:all',
} as const;

export type PermissionType =
  (typeof SystemPermissions)[keyof typeof SystemPermissions];
