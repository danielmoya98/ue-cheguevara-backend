import { IsEnum } from 'class-validator';
import { UpdateRequestStatus } from '../../../prisma/generated/client';
import { ApiProperty } from '@nestjs/swagger';

export class ResolveChangeRequestDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsEnum(UpdateRequestStatus)
  status!: UpdateRequestStatus;
}