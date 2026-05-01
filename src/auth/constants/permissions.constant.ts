// 🔥 El Diccionario Oficial ABAC para TypeScript
export enum SystemPermissions {
  // ROOT
  MANAGE_ALL = 'manage:all:all',

  // ACADEMIC YEAR (Gestión Académica)
  MANAGE_ALL_ACADEMIC_YEAR = 'manage:all:AcademicYear',

  // DASHBOARD
  READ_ALL_DASHBOARD = 'read:all:Dashboard',
  READ_OWN_DASHBOARD = 'read:own:Dashboard',

  // STUDENT (Estudiantes)
  READ_ALL_STUDENT = 'read:all:Student',
  READ_OWN_STUDENT = 'read:own:Student',
  UPDATE_ALL_STUDENT = 'update:all:Student',

  // ENROLLMENT (Inscripciones)
  READ_ALL_ENROLLMENT = 'read:all:Enrollment',
  READ_OWN_ENROLLMENT = 'read:own:Enrollment',
  WRITE_ANY_ENROLLMENT = 'write:any:Enrollment',

  // ATTENDANCE (Asistencia)
  READ_ALL_ATTENDANCE = 'read:all:Attendance',
  CREATE_OWN_ATTENDANCE = 'create:own:Attendance',
  MANAGE_ALL_ATTENDANCE = 'manage:all:Attendance', // 🔥 Añade este para justificar faltas y escáner

  // GRADE (Calificaciones)
  READ_ALL_GRADE = 'read:all:Grade',
  UPDATE_OWN_GRADE = 'update:own:Grade',

  // TIMETABLE (Horarios)
  MANAGE_ALL_TIMETABLE = 'manage:all:Timetable',
  READ_OWN_TIMETABLE = 'read:own:Timetable',

  // IDENTITY (Carnets)
  CREATE_ANY_IDENTITY = 'create:any:Identity',

  // GESTIÓN ACADÉMICA Y FÍSICA
  MANAGE_ALL_CLASSROOM = 'manage:all:Classroom',
  MANAGE_ALL_SUBJECT = 'manage:all:Subject',
  MANAGE_ALL_TEACHER_ASSIGNMENT = 'manage:all:TeacherAssignment',
  MANAGE_ALL_PHYSICAL_SPACE = 'manage:all:PhysicalSpace',

  // ROOT / CONFIGURACIONES
  MANAGE_ALL_USER = 'manage:all:User',
  MANAGE_ALL_ROLE = 'manage:all:Role',
  MANAGE_ALL_INSTITUTION = 'manage:all:Institution',
  READ_ALL_AUDIT = 'read:all:Audit',

  // GUARDIANS (App Móvil)
  READ_OWN_GUARDIAN = 'read:own:Guardian', // 🔥 Permiso exclusivo para Padres
}

// Mantenemos tu tipo original para que el decorador no explote
export type PermissionType = SystemPermissions;
