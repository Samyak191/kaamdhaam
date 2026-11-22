import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, Length, ArrayNotEmpty, ArrayUnique, IsUUID, Matches } from 'class-validator';

export enum SelfRole { CLIENT = 'CLIENT', FREELANCER = 'FREELANCER' }

export class FreelancerFields {
  @ApiPropertyOptional({ maxLength: 160 }) @IsOptional() @IsString() @Length(1, 160) headline?: string;
  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @Length(1, 2000) bio?: string;
  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @Length(1, 100) locationCity?: string;
  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @Length(1, 100) locationState?: string;
}

export class OnboardingDto extends FreelancerFields {
  @ApiProperty({ maxLength: 120 }) @IsString() @IsNotEmpty() @Length(1, 120) displayName!: string;
  @ApiProperty({ enum: SelfRole, isArray: true }) @IsArray() @ArrayNotEmpty() @ArrayUnique() @IsEnum(SelfRole, { each: true }) roles!: SelfRole[];
  @ApiPropertyOptional({ maxLength: 160 }) @IsOptional() @IsString() @Length(1, 160) organizationName?: string;
}

export class ProfileDto extends FreelancerFields {
  @ApiPropertyOptional({ maxLength: 120 }) @IsOptional() @IsString() @Length(1, 120) displayName?: string;
}

export class AddRoleDto {
  @ApiProperty({ enum: SelfRole }) @IsEnum(SelfRole) role!: SelfRole;
}

export class CreateOrganizationDto {
  @ApiProperty({ maxLength: 160 }) @IsString() @IsNotEmpty() @Length(1, 160) name!: string;
}

export class OrganizationIdDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() id!: string;
}
