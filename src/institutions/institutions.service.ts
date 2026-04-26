import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { NotificationChannel } from '../../prisma/generated/client';

@Injectable()
export class InstitutionsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateInstitutionDto) {
    const existing = await this.prisma.institution.findUnique({
      where: { rueCode: data.rueCode },
    });
    if (existing)
      throw new ConflictException('El Código RUE ya está registrado');

    const institution = await this.prisma.institution.create({ data });
    return {
      data: institution,
      message: 'Institución registrada exitosamente',
    };
  }

  async findAll(query: PaginationDto) {
    const { page = 1, limit = 10, search, sort } = query;
    const skip = (page - 1) * limit;

    const whereCondition = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as any } },
            { rueCode: { contains: search } },
          ],
        }
      : {};

    let orderBy = {};
    if (sort) {
      const isDesc = sort.startsWith('-');
      const field = isDesc ? sort.substring(1) : sort;
      orderBy = { [field]: isDesc ? 'desc' : 'asc' };
    } else {
      orderBy = { createdAt: 'desc' };
    }

    const [total, data] = await Promise.all([
      this.prisma.institution.count({ where: whereCondition }),
      this.prisma.institution.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy,
        include: { director: { select: { fullName: true, email: true } } },
      }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id },
      include: { director: { select: { fullName: true, email: true } } },
    });
    if (!institution) throw new NotFoundException('Institución no encontrada');
    return { data: institution };
  }

  async update(id: string, updateData: UpdateInstitutionDto) {
    const institution = await this.prisma.institution.findUnique({
      where: { id },
    });
    if (!institution) throw new NotFoundException('Institución no encontrada');

    const updated = await this.prisma.institution.update({
      where: { id },
      data: updateData,
    });
    return { data: updated, message: 'Datos institucionales actualizados' };
  }

  // ==========================================
  // 🔥 CAMPAÑA RUDE DIGITAL (OMNICANAL)
  // ==========================================

  async getCampaignSettings() {
    const institution = await this.prisma.institution.findFirst({
      select: {
        enableDigitalRudeUpdates: true,
        maxRudeUpdatesPerYear: true,
        activeNotificationChannels: true,
      },
    });

    if (!institution) {
      throw new NotFoundException(
        'No se encontró la configuración de la Institución.',
      );
    }

    return institution;
  }

  async updateCampaignSettings(data: {
    enableDigitalRudeUpdates?: boolean;
    maxRudeUpdatesPerYear?: number;
    activeNotificationChannels?: string[];
  }) {
    const institution = await this.prisma.institution.findFirst();

    if (!institution) {
      throw new NotFoundException(
        'No se encontró la configuración de la Institución.',
      );
    }

    let channels;
    if (data.activeNotificationChannels) {
      channels = data.activeNotificationChannels.map(
        (channel) =>
          NotificationChannel[channel as keyof typeof NotificationChannel],
      );
    }

    const updated = await this.prisma.institution.update({
      where: { id: institution.id },
      data: {
        enableDigitalRudeUpdates: data.enableDigitalRudeUpdates,
        maxRudeUpdatesPerYear: data.maxRudeUpdatesPerYear,
        activeNotificationChannels: channels,
      },
      select: {
        enableDigitalRudeUpdates: true,
        maxRudeUpdatesPerYear: true,
        activeNotificationChannels: true,
      },
    });

    return {
      data: updated,
      message: 'Configuración de la Campaña RUDE actualizada exitosamente',
    };
  }

  // ==========================================
  // 🔥 MOTOR DE ASISTENCIA Y NOTIFICACIONES
  // ==========================================

  async getAttendanceSettings() {
    const institution = await this.prisma.institution.findFirst({
      select: {
        enableQrAttendance: true,
        enableBiometricAttendance: true,
        lateToleranceMinutes: true,
        absentToleranceMinutes: true,
        notificationFrequency: true,
      },
    });

    if (!institution)
      throw new NotFoundException('No se encontró la configuración.');
    return institution;
  }

  async updateAttendanceSettings(data: {
    enableQrAttendance?: boolean;
    enableBiometricAttendance?: boolean;
    lateToleranceMinutes?: number;
    absentToleranceMinutes?: number;
    notificationFrequency?: string;
  }) {
    const institution = await this.prisma.institution.findFirst();
    if (!institution)
      throw new NotFoundException('No se encontró la configuración.');

    const updated = await this.prisma.institution.update({
      where: { id: institution.id },
      data: {
        enableQrAttendance: data.enableQrAttendance,
        enableBiometricAttendance: data.enableBiometricAttendance,
        lateToleranceMinutes: data.lateToleranceMinutes,
        absentToleranceMinutes: data.absentToleranceMinutes,
        notificationFrequency: data.notificationFrequency as any,
      },
      select: {
        enableQrAttendance: true,
        enableBiometricAttendance: true,
        lateToleranceMinutes: true,
        absentToleranceMinutes: true,
        notificationFrequency: true,
      },
    });

    return { data: updated, message: 'Configuración de Asistencia guardada.' };
  }
}
