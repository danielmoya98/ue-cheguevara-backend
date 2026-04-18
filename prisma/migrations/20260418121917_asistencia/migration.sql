-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED');

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('MANUAL', 'QR', 'BIOMETRIC');

-- CreateEnum
CREATE TYPE "NotificationFrequency" AS ENUM ('ALERTS_ONLY', 'ENTRY_EXIT', 'PER_CLASS');

-- AlterTable
ALTER TABLE "institutions" ADD COLUMN     "absent_tolerance_minutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "enable_biometric_attendance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enable_qr_attendance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "late_tolerance_minutes" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "notification_frequency" "NotificationFrequency" NOT NULL DEFAULT 'ALERTS_ONLY';

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "class_period_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "method" "AttendanceMethod" NOT NULL DEFAULT 'MANUAL',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "marked_by_id" TEXT,
    "justification" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_enrollment_id_class_period_id_date_key" ON "attendance_records"("enrollment_id", "class_period_id", "date");

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_class_period_id_fkey" FOREIGN KEY ("class_period_id") REFERENCES "class_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_marked_by_id_fkey" FOREIGN KEY ("marked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
