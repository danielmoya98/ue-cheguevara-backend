import { Module } from '@nestjs/common';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Módulos de Dominio
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { InstitutionsModule } from './institutions/institutions.module';
import { AcademicYearsModule } from './academic-years/academic-years.module';
import { ClassroomsModule } from './classrooms/classrooms.module';
import { SubjectsModule } from './subjects/subjects.module';
import { TeacherAssignmentsModule } from './teacher-assignments/teacher-assignments.module';
import { TimetablesModule } from './timetables/timetables.module';
import { StudentsModule } from './students/students.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { PhysicalSpacesModule } from './physical-spaces/physical-spaces.module';
import { DataUpdatesModule } from './data-updates/data-updates.module';
import { GuardiansModule } from './guardians/guardians.module';
import { IdentityModule } from './identity/identity.module';
import { AttendanceModule } from './attendance/attendance.module';
import { ClassPeriodsModule } from './class-periods/class-periods.module';
import { GradesModule } from './grades/grades.module';
import { TrimestersModule } from './trimesters/trimesters.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    InfrastructureModule, // 🛠️ Toda la configuración pesada vive aquí
    UsersModule,
    AuthModule,
    InstitutionsModule,
    AcademicYearsModule,
    ClassroomsModule,
    SubjectsModule,
    TeacherAssignmentsModule,
    TimetablesModule,
    StudentsModule,
    EnrollmentsModule,
    PhysicalSpacesModule,
    DataUpdatesModule,
    GuardiansModule,
    IdentityModule,
    AttendanceModule,
    ClassPeriodsModule,
    GradesModule,
    TrimestersModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
