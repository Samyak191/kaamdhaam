import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SelfRole } from './dto';

export class FreelancerProfileResponseDto {
  @ApiProperty({ nullable: true }) headline!: string | null;
  @ApiProperty({ nullable: true }) bio!: string | null;
  @ApiProperty({ nullable: true }) locationCity!: string | null;
  @ApiProperty({ nullable: true }) locationState!: string | null;
  @ApiProperty({ example: 'IN' }) countryCode!: string;
}

export class MeResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ nullable: true }) displayName!: string | null;
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED'] }) status!: string;
  @ApiProperty({ enum: SelfRole, isArray: true }) roles!: SelfRole[];
  @ApiProperty() onboardingComplete!: boolean;
  @ApiProperty({ type: FreelancerProfileResponseDto, nullable: true }) freelancerProfile!: FreelancerProfileResponseDto | null;
  @ApiProperty({ type: [String], format: 'uuid' }) organizationIds!: string[];
}

export class OrganizationResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() createdAt!: Date;
  @ApiPropertyOptional({ enum: ['OWNER', 'MEMBER'] }) membershipRole?: string;
}
