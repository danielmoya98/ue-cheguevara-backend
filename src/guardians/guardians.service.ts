import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GuardiansService {
  constructor(private prisma: PrismaService) {}

  async getMyProfileAndStudents(userId: string) {
    // 1. Buscamos al usuario y navegamos por las relaciones hasta el aula
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true, // 🔥 IMPORTANTE: Incluimos el rol para no romper el Frontend
        guardian: {
          include: {
            students: {
              include: {
                student: {
                  include: {
                    // Traemos solo la inscripción del año activo para saber su curso actual
                    enrollments: {
                      where: {
                        academicYear: { status: 'ACTIVE' },
                      },
                      include: { classroom: true },
                      orderBy: { date: 'desc' },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.guardian) {
      throw new NotFoundException(
        'No se encontró el perfil de tutor asociado a esta cuenta.',
      );
    }

    // 2. Formateamos los datos exactamente como los pide el Frontend (Flutter)
    const studentsMapped = user.guardian.students.map((pivot) => {
      const student = pivot.student;
      const currentEnrollment = student.enrollments[0];

      // Armamos el nombre del curso (Ej: "3ro A" o "Sin Asignar")
      let courseString = 'Sin Asignar';
      if (currentEnrollment && currentEnrollment.classroom) {
        courseString = `${currentEnrollment.classroom.grade} "${currentEnrollment.classroom.section}"`;
      }

      return {
        id: student.id,
        firstName: student.names.split(' ')[0], // Solo el primer nombre para la UI
        lastName:
          `${student.lastNamePaterno || ''} ${student.lastNameMaterno || ''}`.trim(),
        course: courseString,
        ci: student.ci,
      };
    });

    // 3. Retornamos el contrato JSON estricto
    return {
      success: true,
      data: {
        id: user.id,
        // 🔥 CORRECCIÓN: Accedemos al nombre de la tabla relacionada (Si es null por seguridad, mandamos 'PADRE')
        role: user.role?.name || 'PADRE',
        firstName: user.guardian.names.split(' ')[0], // Solo el primer nombre
        lastName:
          `${user.guardian.lastNamePaterno || ''} ${user.guardian.lastNameMaterno || ''}`.trim(),
        students: studentsMapped,
      },
    };
  }
}
