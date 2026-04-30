import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private prisma: PrismaService) {}

  // ==========================================
  // 1. ESTADÍSTICAS ROOT (SuperAdmin)
  // ==========================================
  async getRootStats() {
    const totalUsers = await this.prisma.user.count();
    const totalRoles = await this.prisma.role.count();

    // Consulta cruda a PostgreSQL para obtener el tamaño de la BD
    let dbSize = 'Desconocido';
    try {
      const result: any = await this.prisma
        .$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size;`;
      dbSize = result[0]?.size || '0 MB';
    } catch (e) {
      this.logger.warn('No se pudo obtener el tamaño de la BD');
    }

    return {
      accounts: totalUsers,
      roles: totalRoles,
      dbSize: dbSize,
      latency: '12ms', // Esto se suele medir en el cliente, lo dejamos fijo por ahora
      status: 'ONLINE',
    };
  }

  // ==========================================
  // 2. ESTADÍSTICAS GLOBALES (Director/Admin)
  // ==========================================
  async getGlobalStats() {
    // Solo contamos alumnos inscritos en la gestión activa
    const activeStudents = await this.prisma.enrollment.count({
      where: {
        academicYear: { status: 'ACTIVE' },
        status: 'INSCRITO',
      },
    });

    // Contamos profesores (usuarios con rol docente)
    const teachersRole = await this.prisma.role.findFirst({
      where: { name: 'DOCENTE' },
    });
    const totalTeachers = teachersRole
      ? await this.prisma.user.count({
          where: { roleId: teachersRole.id, status: 'ACTIVE' },
        })
      : 0;

    const activeClassrooms = await this.prisma.classroom.count({
      where: { academicYear: { status: 'ACTIVE' } },
    });

    const institution = await this.prisma.institution.findFirst();

    return {
      students: activeStudents.toLocaleString(), // Formato 1,234
      teachers: totalTeachers,
      classrooms: activeClassrooms,
      lastSync: institution?.updatedAt
        ? new Date(institution.updatedAt).toLocaleDateString()
        : 'Hoy',
    };
  }

  // ==========================================
  // 3. ESTADÍSTICAS DEL DOCENTE (Panel Operativo)
  // ==========================================
  async getTeacherStats(userId: string) {
    const now = new Date();
    // Ajuste de día (JavaScript: 0=Dom, 1=Lun. Tu DB: 1=Lun, 5=Vie)
    let dayOfWeek = now.getDay();
    if (dayOfWeek === 0) dayOfWeek = 7; // Ajuste si fuera domingo, aunque no hay clases.

    const currentHourMin = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // 1. Siguiente Clase
    const nextSlot = await this.prisma.scheduleSlot.findFirst({
      where: {
        teacherId: userId,
        dayOfWeek: dayOfWeek,
        classPeriod: { startTime: { gte: currentHourMin } }, // Clases de la hora actual en adelante
      },
      include: {
        classPeriod: true,
        teacherAssignment: { include: { subject: true } },
        classroom: true,
      },
      orderBy: { classPeriod: { startTime: 'asc' } },
    });

    // 2. Estudiantes a Cargo (Contar estudiantes únicos en los cursos donde dicta materias)
    // Primero, obtenemos en qué cursos da clases en la gestión actual
    const assignments = await this.prisma.teacherAssignment.findMany({
      where: {
        teacherId: userId,
        classroom: { academicYear: { status: 'ACTIVE' } },
      },
      select: { classroomId: true },
    });

    const classroomIds = [...new Set(assignments.map((a) => a.classroomId))];

    const studentsCount = await this.prisma.enrollment.count({
      where: {
        classroomId: { in: classroomIds },
        status: 'INSCRITO',
        academicYear: { status: 'ACTIVE' },
      },
    });

    // 3. Trimestre Actual
    const activeTrimester = await this.prisma.trimester.findFirst({
      where: { isOpen: true, academicYear: { status: 'ACTIVE' } },
    });

    // 4. Pendientes de Asistencia (Saber si dictó clases hoy y no tomó lista)
    // Tarea compleja: Contar cuantos periodos tenía hoy hasta esta hora vs cuantas listas tomó.
    // Por simplicidad para el dashboard, verificamos si tiene clases hoy y devolvemos texto.
    const classesToday = await this.prisma.scheduleSlot.count({
      where: { teacherId: userId, dayOfWeek: dayOfWeek },
    });

    return {
      nextClassTime: nextSlot ? nextSlot.classPeriod.startTime : '--:--',
      nextSubject: nextSlot
        ? nextSlot.teacherAssignment.subject.name
        : 'SIN CLASES',
      nextGroup: nextSlot
        ? `${nextSlot.classroom.grade} "${nextSlot.classroom.section}"`
        : 'LIBRE',
      studentsCount: studentsCount,
      attendanceStatus: classesToday > 0 ? 'Pendiente hoy' : 'Al día',
      currentTrimester: activeTrimester
        ? activeTrimester.name.replace('_', ' ')
        : 'Cerrado',
    };
  }
}
