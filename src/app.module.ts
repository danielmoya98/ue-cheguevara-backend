import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { InstitutionsModule } from './institutions/institutions.module';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { AcademicYearsModule } from './academic-years/academic-years.module';
import { ClassroomsModule } from './classrooms/classrooms.module';
import { SubjectsModule } from './subjects/subjects.module';
import { TeacherAssignmentsModule } from './teacher-assignments/teacher-assignments.module';
import { TimetablesModule } from './timetables/timetables.module';
import { BullModule } from '@nestjs/bullmq'; // <-- IMPORTACIÓN NUEVA
import { StudentsModule } from './students/students.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { ScheduleModule } from '@nestjs/schedule';
import { PhysicalSpacesModule } from './physical-spaces/physical-spaces.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),

    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          url: 'redis://localhost:6379',
          ttl: 60000,
        }),
      }),
    }),

    // 🔥 NUEVO: Conexión Global a Redis para las Colas de BullMQ
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    }),

    PrismaModule,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
