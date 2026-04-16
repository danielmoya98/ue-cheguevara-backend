-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SECRETARIA', 'DOCENTE', 'PADRE', 'ESTUDIANTE');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('FISCAL', 'PRIVADA', 'CONVENIO');

-- CreateEnum
CREATE TYPE "Department" AS ENUM ('CHUQUISACA', 'LA_PAZ', 'COCHABAMBA', 'ORURO', 'POTOSI', 'TARIJA', 'SANTA_CRUZ', 'BENI', 'PANDO');

-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('MANANA', 'TARDE', 'NOCHE');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('INICIAL', 'PRIMARIA', 'SECUNDARIA');

-- CreateEnum
CREATE TYPE "AcademicStatus" AS ENUM ('PLANNING', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MASCULINO', 'FEMENINO');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('REVISION_SIE', 'INSCRITO', 'RETIRADO', 'TRASLADO', 'RECHAZADO', 'OBSERVADO');

-- CreateEnum
CREATE TYPE "EnrollmentType" AS ENUM ('NUEVO', 'ANTIGUO', 'TRASPASO', 'EXTRANJERO');

-- CreateEnum
CREATE TYPE "SchedulingMode" AS ENUM ('FIXED_BASE', 'DYNAMIC');

-- CreateEnum
CREATE TYPE "SpaceType" AS ENUM ('SALON', 'LABORATORIO', 'CANCHA', 'AUDITORIO', 'OTRO');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('PUSH_APP', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "UpdateRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'DOCENTE',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "requires_password_change" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ci" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "specialty" TEXT,
    "institution_id" TEXT,
    "guardian_id" TEXT,
    "student_id" TEXT,
    "recovery_email" TEXT,
    "reset_code" TEXT,
    "reset_code_expires_at" TIMESTAMP(3),
    "fcm_tokens" TEXT[],

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutions" (
    "id" TEXT NOT NULL,
    "rue_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dependency_type" "DependencyType" NOT NULL,
    "department" "Department" NOT NULL,
    "municipality" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "founded_year" INTEGER,
    "shifts" "Shift"[],
    "levels" "EducationLevel"[],
    "director_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "scheduling_mode" "SchedulingMode" NOT NULL DEFAULT 'FIXED_BASE',
    "enable_digital_updates" BOOLEAN NOT NULL DEFAULT false,
    "max_rude_updates_per_year" INTEGER NOT NULL DEFAULT 2,
    "active_notification_channels" "NotificationChannel"[] DEFAULT ARRAY['PUSH_APP']::"NotificationChannel"[],

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_years" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" "AcademicStatus" NOT NULL DEFAULT 'PLANNING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "EducationLevel" NOT NULL,
    "area" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classrooms" (
    "id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "level" "EducationLevel" NOT NULL,
    "shift" "Shift" NOT NULL,
    "grade" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 35,
    "advisor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "base_room_id" TEXT,

    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_assignments" (
    "id" TEXT NOT NULL,
    "classroom_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_periods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "shift" "Shift" NOT NULL,
    "isBreak" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,

    CONSTRAINT "class_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_slots" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "class_period_id" TEXT NOT NULL,
    "teacher_assignment_id" TEXT NOT NULL,
    "classroom_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "physical_space_id" TEXT,

    CONSTRAINT "schedule_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "rudeCode" TEXT,
    "documentType" TEXT NOT NULL DEFAULT 'CI',
    "ci" TEXT,
    "complement" TEXT,
    "expedition" TEXT,
    "lastNamePaterno" TEXT,
    "lastNameMaterno" TEXT,
    "names" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "birthCountry" TEXT NOT NULL DEFAULT 'BOLIVIA',
    "birthDepartment" TEXT,
    "birthProvince" TEXT,
    "birthLocality" TEXT,
    "certOficialia" TEXT,
    "certLibro" TEXT,
    "certPartida" TEXT,
    "certFolio" TEXT,
    "hasDisability" BOOLEAN NOT NULL DEFAULT false,
    "disabilityCode" TEXT,
    "disabilityType" TEXT,
    "disabilityDegree" TEXT,
    "hasAutism" BOOLEAN NOT NULL DEFAULT false,
    "autismType" TEXT,
    "learningDisability" BOOLEAN NOT NULL DEFAULT false,
    "extraordinaryTalent" BOOLEAN NOT NULL DEFAULT false,
    "disabilityRegistry" TEXT,
    "disabilityOrigin" TEXT,
    "learningDisabilityStatus" TEXT NOT NULL DEFAULT 'NO',
    "learningDisabilityTypes" TEXT[],
    "learningSupportLocation" TEXT[],
    "hasExtraordinaryTalent" BOOLEAN NOT NULL DEFAULT false,
    "talentType" TEXT,
    "talentSpecifics" TEXT[],
    "talentIQ" TEXT,
    "talentModality" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "enrollmentType" "EnrollmentType" NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'REVISION_SIE',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_documents" JSONB,
    "rude_update_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" TEXT NOT NULL,
    "ci" TEXT,
    "complement" TEXT,
    "expedition" TEXT,
    "lastNamePaterno" TEXT,
    "lastNameMaterno" TEXT,
    "names" TEXT NOT NULL,
    "occupation" TEXT,
    "educationLevel" TEXT,
    "phone" TEXT,
    "language" TEXT,
    "birthDate" TIMESTAMP(3),
    "jobTitle" TEXT,
    "institution" TEXT,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGuardian" (
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,

    CONSTRAINT "StudentGuardian_pkey" PRIMARY KEY ("studentId","guardianId")
);

-- CreateTable
CREATE TABLE "RudeRecord" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "department" TEXT,
    "province" TEXT,
    "municipality" TEXT,
    "locality" TEXT,
    "zone" TEXT,
    "street" TEXT,
    "houseNumber" TEXT,
    "phone" TEXT,
    "cellphone" TEXT,
    "nativeLanguage" TEXT,
    "frequentLanguages" TEXT[],
    "culturalIdentity" TEXT,
    "medicalVisits" TEXT,
    "nearestHealthCenter" BOOLEAN NOT NULL DEFAULT false,
    "healthCareLocations" TEXT[],
    "healthCenterVisits" TEXT,
    "healthInsurance" BOOLEAN NOT NULL DEFAULT false,
    "water" BOOLEAN,
    "bathroom" BOOLEAN,
    "sewage" BOOLEAN,
    "electricity" BOOLEAN,
    "garbage" BOOLEAN,
    "housingType" TEXT,
    "internetAccess" TEXT[],
    "internetFrequency" TEXT,
    "didWork" TEXT,
    "workType" TEXT,
    "workShift" TEXT[],
    "workFrequency" TEXT,
    "gotPaid" TEXT,
    "workedMonths" TEXT[],
    "transportType" TEXT,
    "transportTime" TEXT,
    "abandonedLastYear" BOOLEAN,
    "abandonReasons" TEXT[],
    "livesWith" TEXT,

    CONSTRAINT "RudeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "physical_spaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SpaceType" NOT NULL DEFAULT 'SALON',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "physical_spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_update_requests" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "proposed_data" JSONB NOT NULL,
    "status" "UpdateRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,

    CONSTRAINT "data_update_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_guardian_id_key" ON "users"("guardian_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_student_id_key" ON "users"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_rue_code_key" ON "institutions"("rue_code");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_director_id_key" ON "institutions"("director_id");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_year_key" ON "academic_years"("year");

-- CreateIndex
CREATE UNIQUE INDEX "classrooms_academic_year_id_level_grade_section_shift_key" ON "classrooms"("academic_year_id", "level", "grade", "section", "shift");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_assignments_classroom_id_subject_id_key" ON "teacher_assignments"("classroom_id", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_slots_classroom_id_dayOfWeek_class_period_id_key" ON "schedule_slots"("classroom_id", "dayOfWeek", "class_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_slots_teacher_id_dayOfWeek_class_period_id_key" ON "schedule_slots"("teacher_id", "dayOfWeek", "class_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "Student_rudeCode_key" ON "Student"("rudeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Student_ci_key" ON "Student"("ci");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_academicYearId_key" ON "Enrollment"("studentId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_ci_key" ON "Guardian"("ci");

-- CreateIndex
CREATE UNIQUE INDEX "RudeRecord_enrollmentId_key" ON "RudeRecord"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "data_update_requests_enrollment_id_status_key" ON "data_update_requests"("enrollment_id", "status");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_director_id_fkey" FOREIGN KEY ("director_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_advisor_id_fkey" FOREIGN KEY ("advisor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_base_room_id_fkey" FOREIGN KEY ("base_room_id") REFERENCES "physical_spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_class_period_id_fkey" FOREIGN KEY ("class_period_id") REFERENCES "class_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_teacher_assignment_id_fkey" FOREIGN KEY ("teacher_assignment_id") REFERENCES "teacher_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_physical_space_id_fkey" FOREIGN KEY ("physical_space_id") REFERENCES "physical_spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "classrooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RudeRecord" ADD CONSTRAINT "RudeRecord_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_update_requests" ADD CONSTRAINT "data_update_requests_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
