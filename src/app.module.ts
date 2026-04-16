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
import { BullModule } from '@nestjs/bullmq';
import { StudentsModule } from './students/students.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { ScheduleModule } from '@nestjs/schedule';
import { PhysicalSpacesModule } from './physical-spaces/physical-spaces.module';
import { DataUpdatesModule } from './data-updates/data-updates.module';
import { FirebaseModule } from './firebase/firebase.module';
import { GuardiansModule } from './guardians/guardians.module';
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
          url: process.env.REDIS_URL,
        }),
      }),
    }),

    // 🔥 NUEVO: Conexión Global a Redis para las Colas de BullMQ
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL,
      },
    }),
    PrismaModule,
    FirebaseModule,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
