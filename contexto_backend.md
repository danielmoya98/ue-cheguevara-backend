# Contexto del Backend: NestJS + Prisma RESTful API

Este documento es la "fuente de la verdad" del backend, estructurado detalladamente para facilitar el consumo de la API desde el frontend, escalar funcionalidades, o integrarse en futuros módulos en perfecta sincronía.

---

## 1. Base de Datos y Modelado (CRÍTICO)

A continuación, se detalla el esquema completo de Prisma (`schema.prisma`), el cual incluye las definiciones de Base de Datos PostgreSQL, Enums nativos, y los Modelos relacionados de los módulos core del negocio.

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

// Looking for ways to speed up your queries, or scale easily with your serverless or edge functions?
// Try Prisma Accelerate: https://pris.ly/cli/accelerate-init

generator client {
  provider     = "prisma-client"
  output       = "../generated"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
}

// ==========================================
// ENUMS (Dominios de datos estrictos oficiales)
// ==========================================

enum Role {
  ADMIN // Director / Administrador principal
  SECRETARIA // Secretaría Académica
  DOCENTE // Plantel Docente (Web & App)
}

enum UserStatus {
  ACTIVE // Puede ingresar al sistema
  INACTIVE // Cuenta bloqueada/suspendida
}

enum DependencyType {
  FISCAL // Público
  PRIVADA // Privado
  CONVENIO // Mixto / Iglesia
}

enum Department {
  CHUQUISACA
  LA_PAZ
  COCHABAMBA
  ORURO
  POTOSI
  TARIJA
  SANTA_CRUZ
  BENI
  PANDO
}

enum Shift {
  MANANA
  TARDE
  NOCHE
}

enum EducationLevel {
  INICIAL
  PRIMARIA
  SECUNDARIA
}

// ==========================================
// MODELOS
// ==========================================

model User {
  id       String @id @default(uuid())
  email    String @unique
  password String // Hash de la contraseña (NUNCA en texto plano)
  fullName String @map("full_name")

  // Control de Accesos
  role   Role       @default(DOCENTE)
  status UserStatus @default(ACTIVE)

  // Flujo de Onboarding (Setup Password)
  requiresPasswordChange Boolean @default(true) @map("requires_password_change")

  // Auditoría
  lastLoginAt DateTime? @map("last_login_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  // --- NUEVOS CAMPOS DE PERFIL (Agrega esto) ---
  ci        String? // Carnet de Identidad
  phone     String? // Teléfono
  address   String? // Dirección
  specialty String? // Especialidad (Ej. Matemáticas)

  // ==========================================
  // RELACIONES CON INSTITUCIÓN
  // ==========================================

  // 1. Relación: El colegio donde trabaja este usuario (Docente, Secretaria o Admin)
  institutionId String?      @map("institution_id")
  institution   Institution? @relation("InstitutionStaff", fields: [institutionId], references: [id])

  // 2. Relación Inversa: El colegio que este usuario dirige (Solo aplica si es el Director General)
  directedInstitution Institution?        @relation("InstitutionDirector")
  classrooms          Classroom[]         @relation("ClassroomAdvisor")
  teacherAssignments  TeacherAssignment[] @relation("TeacherAssignments")
  scheduleSlots       ScheduleSlot[]

  @@map("users")
}

model Institution {
  id             String         @id @default(uuid())
  rueCode        String         @unique @map("rue_code") // Código RUE / SIE (Ej. 80730145)
  name           String // Nombre oficial (Ej. Unidad Educativa Che Guevara)
  dependencyType DependencyType @map("dependency_type")

  // Ubicación Geográfica (Estructura SIE)
  department   Department
  municipality String // Ej. Sucre
  district     String // Distrito Educativo (Ej. Sucre 1)
  address      String

  // Contacto e Información
  phone       String?
  email       String?
  foundedYear Int?    @map("founded_year")

  // Capacidades Operativas autorizadas
  shifts Shift[] // Ej. [MANANA, TARDE]
  levels EducationLevel[] // Ej. [PRIMARIA, SECUNDARIA]

  // ==========================================
  // RELACIONES CON USUARIOS
  // ==========================================

  // 1. El Director actual del colegio (Conexión 1 a 1)
  directorId String? @unique @map("director_id")
  director   User?   @relation("InstitutionDirector", fields: [directorId], references: [id])

  // 2. Lista de todo el personal que trabaja aquí (Conexión 1 a Muchos)
  staff User[] @relation("InstitutionStaff")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("institutions")
}

// ==========================================
// MÓDULO ACADÉMICO (Estructura Base)
// ==========================================

enum AcademicStatus {
  PLANNING // Gestión futura en planificación (Ej. Diciembre preparando el próximo año)
  ACTIVE // Gestión actual en curso
  CLOSED // Gestión histórica cerrada (Solo lectura, libretas selladas)
}

// 1. GESTIÓN ESCOLAR (El Año Lectivo)
model AcademicYear {
  id        String         @id @default(uuid())
  year      Int            @unique // Ej. 2026
  name      String // Ej. "Gestión Académica 2026"
  startDate DateTime       @map("start_date")
  endDate   DateTime       @map("end_date")
  status    AcademicStatus @default(PLANNING)

  classrooms Classroom[]

  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")
  enrollments Enrollment[]

  @@map("academic_years")
}

// 2. MATERIAS / ASIGNATURAS (Catálogo Global)
model Subject {
  id    String         @id @default(uuid())
  name  String // Ej. "Matemáticas", "Física"
  level EducationLevel // Para filtrar (Ej. Física solo sale en Secundaria)
  area  String? // Ej. "Ciencias Exactas", "Ciencias Sociales"

  assignments TeacherAssignment[]

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("subjects")
}

// 3. CURSO / AULA (La intersección física/lógica de todo)
model Classroom {
  id             String       @id @default(uuid())
  academicYearId String       @map("academic_year_id")
  academicYear   AcademicYear @relation(fields: [academicYearId], references: [id])

  // Reglas RUE
  level   EducationLevel // Ej. SECUNDARIA
  shift   Shift // Ej. MANANA
  grade   String // Ej. "Primero", "Segundo", "Sexto"
  section String // PARALELO: Ej. "A", "B", "C"

  capacity Int @default(35) // Límite de alumnos por aula

  // Docente Asesor / Tutor del Curso
  advisorId String? @map("advisor_id")
  advisor   User?   @relation("ClassroomAdvisor", fields: [advisorId], references: [id])

  // Relaciones
  subjectAssignments TeacherAssignment[]
  // enrollments     Enrollment[]        // <-- Lo activaremos en el próximo módulo (Estudiantes)

  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime       @updatedAt @map("updated_at")
  scheduleSlots ScheduleSlot[]
  enrollments   Enrollment[]

  // REGLA DE ORO DE BASE DE DATOS:
  // No pueden existir dos "1ro A de Secundaria en la Mañana" en el mismo año.
  @@unique([academicYearId, level, grade, section, shift])
  @@map("classrooms")
}

// 4. DISTRIBUCIÓN DE CARGA HORARIA (Docente <-> Materia <-> Curso)
model TeacherAssignment {
  id String @id @default(uuid())

  classroomId String    @map("classroom_id")
  classroom   Classroom @relation(fields: [classroomId], references: [id], onDelete: Cascade)

  subjectId String  @map("subject_id")
  subject   Subject @relation(fields: [subjectId], references: [id], onDelete: Cascade)

  teacherId String @map("teacher_id")
  teacher   User   @relation("TeacherAssignments", fields: [teacherId], references: [id])

  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime       @updatedAt @map("updated_at")
  scheduleSlots ScheduleSlot[]

  // REGLA: En un mismo curso, una materia solo la dicta un profesor titular
  @@unique([classroomId, subjectId])
  @@map("teacher_assignments")
}

// 1. Catálogo de Periodos de Clase (Los horarios fijos del colegio)
model ClassPeriod {
  id        String  @id @default(uuid())
  name      String // Ej. "1er Periodo" o "Recreo"
  startTime String // Ej. "08:00"
  endTime   String // Ej. "08:40"
  shift     Shift // MANANA, TARDE, NOCHE
  isBreak   Boolean @default(false) // Si es true, la UI lo pinta como recreo y no deja soltar materias
  order     Int // Para ordenarlos cronológicamente (1, 2, 3...)

  schedules ScheduleSlot[]

  @@map("class_periods")
}

// 2. El Casillero del Horario (La celda donde cae la materia)
model ScheduleSlot {
  id        String @id @default(uuid())
  dayOfWeek Int // 1 = Lunes, 2 = Martes, ..., 5 = Viernes

  classPeriodId       String @map("class_period_id")
  teacherAssignmentId String @map("teacher_assignment_id")

  // 🔥 DESNORMALIZACIÓN ESTRATÉGICA PARA REGLAS DE ORO
  classroomId String @map("classroom_id")
  teacherId   String @map("teacher_id")

  // Relaciones
  classPeriod       ClassPeriod       @relation(fields: [classPeriodId], references: [id])
  teacherAssignment TeacherAssignment @relation(fields: [teacherAssignmentId], references: [id], onDelete: Cascade)
  classroom         Classroom         @relation(fields: [classroomId], references: [id], onDelete: Cascade)
  teacher           User              @relation(fields: [teacherId], references: [id], onDelete: Cascade)

  // 🛡️ REGLA DE ORO 1: Un curso NO puede tener dos materias a la misma hora
  @@unique([classroomId, dayOfWeek, classPeriodId])
  // 🛡️ REGLA DE ORO 2: Un profesor NO puede dictar clases en dos cursos distintos a la misma hora
  @@unique([teacherId, dayOfWeek, classPeriodId])
  @@map("schedule_slots")
}

// ==========================================
// MÓDULO 3: ESTUDIANTES E INSCRIPCIONES (RUDE)
// ==========================================

enum Gender {
  MASCULINO
  FEMENINO
}

enum EnrollmentStatus {
  REVISION_SIE // Esperando que el director valide el RUDE en el Ministerio
  INSCRITO // Oficialmente activo en el curso
  RETIRADO // Abandonó el colegio a medio año
  TRASPASO // Se trasladó a otra unidad educativa
  RECHAZADO // 👈 ¡Faltaba este para la acción de la secretaria!
  OBSERVADO // (Opcional) Por si le falta algún documento
}

enum EnrollmentType {
  NUEVO // Entra por primera vez al colegio o al sistema escolar
  ANTIGUO // Ratificación automática
  TRASPASO // Viene trasladado de otro colegio en Bolivia
  EXTRANJERO // Viene de otro país (Requiere homologación)
}

// 1. EL ESTUDIANTE (Catálogo Inmutable Global)
model Student {
  id       String  @id @default(uuid())
  rudeCode String? @unique // Nullable porque los NUEVOS aún no lo tienen

  // Identificación
  documentType String  @default("CI") // CI, DNI, PASAPORTE, DECLARACION
  ci           String? @unique
  complement   String?
  expedition   String? // LP, CB, SC, etc.

  // Nombres
  lastNamePaterno String?
  lastNameMaterno String?
  names           String

  gender          Gender
  birthDate       DateTime
  birthCountry    String   @default("BOLIVIA")
  birthDepartment String?
  birthProvince   String?
  birthLocality   String?

  // Certificado de Nacimiento Oficial (Para cotejo SIE)
  certOficialia String?
  certLibro     String?
  certPartida   String?
  certFolio     String?

  // Capacidades Diferentes (Salud Crónica)
  hasDisability       Boolean @default(false)
  disabilityCode      String? // IBC/CODEPEDIS
  disabilityType      String?
  disabilityDegree    String?
  hasAutism           Boolean @default(false)
  autismType          String?
  learningDisability  Boolean @default(false)
  extraordinaryTalent Boolean @default(false)
  disabilityRegistry  String? // Para guardar si es "CODEPEDIS" o "IBC"
  disabilityOrigin    String? // Para guardar "DE_NACIMIENTO" o "ADQUIRIDA"

  // 2.10 Dificultades de Aprendizaje
  learningDisabilityStatus String   @default("NO") // DIAGNOSTICO, INFORME, SIN_DIAGNOSTICO, NO
  learningDisabilityTypes  String[] // ["LECTURA_ESCRITURA", "RAZONAMIENTO", "CALCULO"]
  learningSupportLocation  String[] // ["UNIDAD_EDUCATIVA", "CENTRO_ESPECIAL", ...]

  // 2.11 Talento Extraordinario
  hasExtraordinaryTalent Boolean  @default(false)
  talentType             String? // GENERAL, ESPECIFICO, DOBLE
  talentSpecifics        String[] // ["ARTISTICO", "MUSICAL", ...] (Solo si es Específico)
  talentIQ               String? // Coeficiente Intelectual
  talentModality         String[] // Modalidades marcadas

  // Relaciones
  enrollments Enrollment[]
  guardians   StudentGuardian[] // Relación con padres/tutores

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// 2. LA INSCRIPCIÓN (El evento Anual)
model Enrollment {
  id             String @id @default(uuid())
  studentId      String
  classroomId    String
  academicYearId String

  enrollmentType EnrollmentType
  status         EnrollmentStatus @default(REVISION_SIE)

  date DateTime @default(now())

  // Relaciones
  student      Student      @relation(fields: [studentId], references: [id])
  classroom    Classroom    @relation(fields: [classroomId], references: [id])
  academicYear AcademicYear @relation(fields: [academicYearId], references: [id])

  // El Formulario RUDE está anclado a esta inscripción anual
  rudeRecord RudeRecord?

  // Regla de Negocio: Un estudiante NO puede inscribirse dos veces en el mismo año
  @@unique([studentId, academicYearId])
}

// 3. PADRES Y TUTORES (Reutilizables si tienen varios hijos)
model Guardian {
  id              String    @id @default(uuid())
  ci              String?   @unique
  complement      String?
  expedition      String?
  lastNamePaterno String?
  lastNameMaterno String?
  names           String
  occupation      String?
  educationLevel  String?
  phone           String?
  language        String? // "CASTELLANO", "QUECHUA", etc.
  birthDate       DateTime? // Fecha de nacimiento
  // (Opcional, para Tutor Extraordinario 5.5)
  jobTitle        String? // Cargo actual
  institution     String? // Nombre de la Institución

  students StudentGuardian[]
}

// Tabla Pivote para relación Estudiante <-> Tutor
model StudentGuardian {
  studentId    String
  guardianId   String
  relationship String // PADRE, MADRE, TUTOR

  student  Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  guardian Guardian @relation(fields: [guardianId], references: [id], onDelete: Cascade)

  @@id([studentId, guardianId])
}

// 4. EL FORMULARIO RUDE (Fotografía Anual Socioeconómica)
model RudeRecord {
  id           String @id @default(uuid())
  enrollmentId String @unique

  // III. Dirección Actual
  department   String?
  province     String?
  municipality String?
  locality     String?
  zone         String?
  street       String?
  houseNumber  String?
  phone        String?
  cellphone    String?

  // IV. 4.1 Idioma y Cultura
  nativeLanguage    String?
  frequentLanguages String[] // Ej: ["Castellano", "Quechua"]
  culturalIdentity  String?

  // IV. 4.2 Salud
  medicalVisits       String?
  nearestHealthCenter Boolean  @default(false)
  healthCareLocations String[] // ["SUS", "CAJA", "PRIVADO", "FARMACIA"]
  healthCenterVisits  String? // "1_A_2", "3_A_5", "6_MAS", "NINGUNA"
  healthInsurance     Boolean  @default(false)

  // IV. 4.3 Servicios Básicos
  water       Boolean?
  bathroom    Boolean?
  sewage      Boolean?
  electricity Boolean?
  garbage     Boolean?
  housingType String?

  // IV. 4.4 Internet
  internetAccess    String[]
  internetFrequency String?

  // IV. 4.5 Trabajo
  didWork       String?
  workType      String?
  workShift     String[]
  workFrequency String?
  gotPaid       String?
  workedMonths  String[] // ["ENE", "FEB", ...]

  // IV. 4.6 Transporte
  transportType String?
  transportTime String?

  // IV. 4.7 Abandono
  abandonedLastYear Boolean?
  abandonReasons    String[]

  // V. 5.1 Vive Habitualmente Con
  livesWith String? // "AMBOS", "PADRE", "MADRE", "TUTOR", "SOLO", "CENTRO_ACOGIDA"

  enrollment Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
}
```

---

## 2. Arquitectura y Stack Tecnológico

El proyecto está diseñado bajo una arquitectura modular propia de NestJS. 

### Dependencias Core (package.json)
- **Framework:** `@nestjs/core`, `@nestjs/common` (v11.1.13)
- **ORM & Base de Datos:** `@prisma/client`, `@prisma/adapter-pg`, `prisma` (v7.3.0)
- **Validación y Transformación:** `class-validator` (v0.14.4), `class-transformer` (v0.5.1)
- **Seguridad y Autenticación:** `@nestjs/passport` (v11.0.5), `@nestjs/jwt` (v11.0.2), `passport-jwt`, `bcrypt` (v6.0.0), `helmet`
- **Documentación de API:** `@nestjs/swagger` (v11.2.6)
- **Colas / Tareas en Segundo Plano:** `@nestjs/bullmq` (v11.0.4), `bullmq`
- **Caché:** `@nestjs/cache-manager` (v3.1.0), `cache-manager-redis-yet`
- **Websockets:** `@nestjs/websockets`, `@nestjs/platform-socket.io` (v11.1.17)

### Estructura de Directorios Modular (`src/`)
La lógica de negocio está altamente modularizada dividiéndose por dominios (features):

```text
src/
 ├── academic-years/       # Gestión de gestiones escolares y lectivas
 ├── auth/                 # Lógica de autenticación, decorators, y guards de seguridad
 ├── classrooms/           # Cursos y Aulas
 ├── common/               # Interceptores (ej. response.interceptor), filtros y utilidades
 ├── config/               # Configuración global
 ├── enrollments/          # Control de inscripciones (Status de RUDE y tipos)
 ├── institutions/         # Unidades Educativas y sedes
 ├── prisma/               # Servicio de Prisma inyectable en la aplicación
 ├── students/             # Estudiantes, Formularios RUDE, Tutores e importaciones
 ├── subjects/             # Materias / Asignaturas
 ├── teacher-assignments/  # Distribución de Carga Horaria (Docentes <-> Materias)
 ├── timetables/           # Horarios de clase
 └── users/                # Gestión de Usuarios del Sistema y Roles
```

---

## 3. Seguridad, Autenticación y Autorización (Guards)

El sistema de seguridad hace uso de **Passport** y **JWT** para el control en todas las endpoints.

### 3.1 Guards Principales
Protegen las rutas requiriendo un token válido en `Authorization: Bearer <token>`.

`JwtAuthGuard` es la entrada base:
```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

`RolesGuard` protege las acciones limitándolas según el Rol (`Role`) configurado en la base de datos (Ej: ADMIN, SECRETARIA, DOCENTE):
```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../../../prisma/generated/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        'No tienes los privilegios necesarios para realizar esta acción',
      );
    }
    return true;
  }
}
```

### 3.2 Decoradores Personalizados (Roles)
```typescript
import { SetMetadata } from '@nestjs/common';
import { Role } from '../../../prisma/generated/client';

export const ROLES_KEY = 'roles';
// Permite usar @Roles(Role.ADMIN, Role.SECRETARIA) sobre los endpoints
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```
*(Nota: Actualmente no existe un decorador `@CurrentUser()` específico global en `src/common/decorators`. La extracción del usuario en los endpoints se realiza accediendo directamente a `req.user`.)*

---

## 4. Validaciones y DTOs (Data Transfer Objects)

El backend exige precisión estricta a través de `class-validator` y `class-transformer`. El siguiente DTO es un excelente ejemplo de complejidad con validación de arrays y objetos anidados (`@ValidateNested`), el cual mapea la inscripción completa de un estudiante incluyendo el Formulario RUDE.

### DTO: `CreateFullRudeDto` (`src/students/dto/create-student.dto.ts`)

```typescript
import {
  IsString, IsNotEmpty, IsOptional, IsBoolean, IsDateString,
  IsEnum, ValidateNested, IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Gender, EnrollmentType } from '../../../prisma/generated/client';

class GuardianDto {
  @IsString() @IsNotEmpty() relationship: string;
  @IsString() @IsNotEmpty() ci: string;
  @IsString() @IsOptional() complement?: string;
  @IsString() @IsOptional() expedition?: string;
  @IsString() @IsNotEmpty() lastNamePaterno: string;
  @IsString() @IsOptional() lastNameMaterno?: string;
  @IsString() @IsNotEmpty() names: string;
  @IsString() @IsOptional() language?: string;
  @IsString() @IsOptional() occupation?: string;
  @IsString() @IsOptional() educationLevel?: string;
  @IsString() @IsOptional() birthDate?: string;
  @IsString() @IsNotEmpty() phone: string;
  @IsString() @IsOptional() jobTitle?: string;
  @IsString() @IsOptional() institution?: string;
}

class RudeDataDto {
  // Dirección
  @IsString() @IsNotEmpty() department: string;
  @IsString() @IsNotEmpty() province: string;
  @IsString() @IsNotEmpty() municipality: string;
  @IsString() @IsOptional() locality?: string;
  @IsString() @IsOptional() zone?: string;
  @IsString() @IsNotEmpty() street: string;
  @IsString() @IsOptional() houseNumber?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsNotEmpty() cellphone: string;

  // Idioma y Cultura
  @IsString() @IsNotEmpty() nativeLanguage: string;
  @IsArray() @IsOptional() frequentLanguages?: string[];
  @IsString() @IsOptional() culturalIdentity?: string;

  // Salud
  @IsBoolean() @IsOptional() nearestHealthCenter?: boolean;
  @IsArray() @IsOptional() healthCareLocations?: string[];
  @IsString() @IsOptional() healthCenterVisits?: string;
  @IsBoolean() @IsOptional() healthInsurance?: boolean;

  // Servicios Básicos
  @IsBoolean() @IsOptional() water?: boolean;
  @IsBoolean() @IsOptional() bathroom?: boolean;
  @IsBoolean() @IsOptional() sewage?: boolean;
  @IsBoolean() @IsOptional() electricity?: boolean;
  @IsBoolean() @IsOptional() garbage?: boolean;
  @IsString() @IsOptional() housingType?: string;

  // Internet
  @IsArray() @IsOptional() internetAccess?: string[];
  @IsString() @IsOptional() internetFrequency?: string;

  // Trabajo
  @IsString() @IsOptional() didWork?: string;
  @IsArray() @IsOptional() workedMonths?: string[];
  @IsString() @IsOptional() workType?: string;
  @IsArray() @IsOptional() workShift?: string[];
  @IsString() @IsOptional() workFrequency?: string;
  @IsString() @IsOptional() gotPaid?: string;

  // Transporte
  @IsString() @IsNotEmpty() transportType: string;
  @IsString() @IsNotEmpty() transportTime: string;

  // Abandono
  @IsBoolean() @IsOptional() abandonedLastYear?: boolean;
  @IsArray() @IsOptional() abandonReasons?: string[];

  // Con quién vive
  @IsString() @IsNotEmpty() livesWith: string;
}

export class CreateFullRudeDto {
  @IsString() @IsNotEmpty() classroomId: string;
  @IsString() @IsNotEmpty() academicYearId: string;
  @IsEnum(EnrollmentType) @IsNotEmpty() enrollmentType: EnrollmentType;
  @IsString() @IsOptional() rudeCode?: string;

  // Datos del Estudiante
  @IsString() @IsOptional() ci?: string;
  @IsString() @IsOptional() complement?: string;
  @IsString() @IsOptional() expedition?: string;
  @IsString() @IsNotEmpty() documentType: string;
  @IsString() @IsNotEmpty() names: string;
  @IsString() @IsNotEmpty() lastNamePaterno: string;
  @IsString() @IsOptional() lastNameMaterno?: string;
  @IsDateString() @IsNotEmpty() birthDate: string;
  @IsEnum(Gender) @IsNotEmpty() gender: Gender;

  @IsString() @IsNotEmpty() birthCountry: string;
  @IsString() @IsOptional() birthDepartment?: string;
  @IsString() @IsOptional() birthProvince?: string;
  @IsString() @IsOptional() birthLocality?: string;

  @IsString() @IsOptional() certOficialia?: string;
  @IsString() @IsOptional() certLibro?: string;
  @IsString() @IsOptional() certPartida?: string;
  @IsString() @IsOptional() certFolio?: string;

  // Capacidades Especiales
  @IsBoolean() @IsOptional() hasDisability?: boolean;
  @IsString() @IsOptional() disabilityRegistry?: string;
  @IsString() @IsOptional() disabilityCode?: string;
  @IsString() @IsOptional() disabilityType?: string;
  @IsString() @IsOptional() disabilityDegree?: string;
  @IsString() @IsOptional() disabilityOrigin?: string;

  @IsBoolean() @IsOptional() hasAutism?: boolean;
  @IsString() @IsOptional() autismType?: string;

  @IsString() @IsOptional() learningDisabilityStatus?: string;
  @IsArray() @IsOptional() learningDisabilityTypes?: string[];
  @IsArray() @IsOptional() learningSupportLocation?: string[];

  @IsBoolean() @IsOptional() hasExtraordinaryTalent?: boolean;
  @IsString() @IsOptional() talentType?: string;
  @IsArray() @IsOptional() talentSpecifics?: string[];
  @IsString() @IsOptional() talentIQ?: string;
  @IsArray() @IsOptional() talentModality?: string[];

  // Relaciones
  @ValidateNested({ each: true })
  @Type(() => GuardianDto)
  @IsArray()
  guardians: GuardianDto[];

  @ValidateNested()
  @Type(() => RudeDataDto)
  @IsOptional()
  rudeData?: RudeDataDto;
}
```

---

## 5. Controladores y Estructura de Rutas

Los controladores inyectan la capa de negocio y decoran las rutas para Swagger Documentations (`@ApiTags`, `@ApiOperation`). El siguiente ejemplo es el `StudentsController`.

```typescript
import {
  Controller, Post, Body, HttpCode, HttpStatus,
  UseInterceptors, UploadedFile, Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StudentsService } from './students.service';
import { CreateFullRudeDto } from './dto/create-student.dto';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';

@ApiTags('Inscripciones y RUDE')
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post('register-rude')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registra a un estudiante, sus tutores y su RUDE en una sola transacción',
  })
  createFullRude(@Body() createDto: CreateFullRudeDto) {
    return this.studentsService.registerFullRude(createDto);
  }

  @Post('import-excel/:academicYearId')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Importa estudiantes masivamente desde un archivo Excel',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  importExcel(
    @UploadedFile() file: Express.Multer.File,
    @Param('academicYearId') academicYearId: string,
  ) {
    return this.studentsService.importStudentsFromExcel(file, academicYearId);
  }
}
```

---

## 6. Servicios y Lógica de Negocio (Prisma)

Los servicios encapsulan el ORM. En flujos complejos se utilizan exclusívamente **Transacciones ACID de Prisma** (`this.prisma.$transaction`), permitiendo hacer rollback completo si falla la inserción de un estudiante, su tutor escolar o su registro en un aula.

Fíjate en cómo controla el límite de aulas disparando un `ConflictException`:

### Lógica transaccional compleja: `StudentsService`

```typescript
import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFullRudeDto } from './dto/create-student.dto';
import { EnrollmentStatus } from '../../prisma/generated/client';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  async registerFullRude(data: CreateFullRudeDto) {
    // 🔥 Uso de Transacciones de Prisma para asegurar consistencia
    return await this.prisma.$transaction(async (tx) => {
      // 1. VALIDACIÓN DE CUPOS DEL CURSO
      const classroom = await tx.classroom.findUnique({
        where: { id: data.classroomId },
        include: {
          _count: { select: { enrollments: true } },
        },
      });

      if (!classroom) throw new BadRequestException('El curso no existe');
      if (classroom._count.enrollments >= classroom.capacity) {
        throw new ConflictException(
          `El paralelo ${classroom.grade} "${classroom.section}" ha alcanzado su límite máximo de ${classroom.capacity} cupos.`,
        );
      }

      // Se omiten los pasos 2 a 5 por brevedad, los cuales manejan: 
      // 2. Buscar/Crear Estudiante.
      // 3. Validar inscripciones previas (ConflictException).
      // 4. Crear/Enlazar array de `Guardianes` (Tutores).
      // 5. Crear la inscripción (`Enrollment`)
      
      const enrollment = await tx.enrollment.create({
        data: {
          studentId: 'uuid', // Referencia generada en paso 2
          classroomId: data.classroomId,
          academicYearId: data.academicYearId,
          enrollmentType: data.enrollmentType,
          status: EnrollmentStatus.REVISION_SIE,
        },
      });

      // 6. GUARDAR EL FORMULARIO RUDE SOCIOECONÓMICO
      if (data.rudeData) {
        await tx.rudeRecord.create({
          data: {
            enrollmentId: enrollment.id,
            ...data.rudeData,
          },
        });
      }

      return {
        message: 'Inscripción y Formulario RUDE procesados con éxito',
        studentId: 'uuid', // Mapeado correctamente
        enrollmentId: enrollment.id,
      };
    });
  }
}
```

---

## 7. Interceptores y Formato de Respuesta

Para el formateo estandarizado de la API existe el interceptor `ResponseInterceptor`. 
El frontend SIEMPRE recibirá una respuesta envuelta en este esquema:
`{ success: boolean, message: string, data: any }`.

- Si es un listado, el array vendrá dentro de `data`.
- Esto debe ser reflejado en la inyección de tipos del cliente (Ej. Axios/fetch).

### Interceptor: `src/common/interceptors/response.interceptor.ts`

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResponseFormat<T> {
  success: boolean;
  message?: string;
  data: T;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ResponseFormat<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseFormat<T>> {
    return next.handle().pipe(
      map((res) => {
        // Validación para endpoints con metadata paginada
        if (res?.data && res?.meta) {
          return {
            success: true,
            message: res.message || 'Operación exitosa',
            data: res.data,
            meta: res.meta,
          };
        }
        
        // Formato estándar garantizado para el Frontend
        return {
          success: true,
          message: res?.message || 'Operación exitosa',
          data: res?.data !== undefined ? res.data : res,
        };
      }),
    );
  }
}
```
