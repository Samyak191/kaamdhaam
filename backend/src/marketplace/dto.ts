import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PageQuery {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 10000 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) offset = 0;
}

export enum JobSort { NEWEST = 'newest', BUDGET_ASC = 'budget_asc', BUDGET_DESC = 'budget_desc' }
export class JobQuery extends PageQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 100) q?: string;
  @ApiPropertyOptional({ description: 'Exact normalized skill name' }) @IsOptional() @IsString() @Length(1, 80) skill?: string;
  @ApiPropertyOptional({ minimum: 10000 }) @IsOptional() @Type(() => Number) @IsInt() @Min(10000) @Max(100000000000) minBudgetPaise?: number;
  @ApiPropertyOptional({ maximum: 100000000000 }) @IsOptional() @Type(() => Number) @IsInt() @Min(10000) @Max(100000000000) maxBudgetPaise?: number;
  @ApiPropertyOptional({ enum: JobSort, default: JobSort.NEWEST }) @IsOptional() @IsEnum(JobSort) sort = JobSort.NEWEST;
}
export class FreelancerQuery extends PageQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 100) q?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 80) skill?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 100) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 100) state?: string;
}
export class SkillNamesDto {
  @ApiProperty({ type: [String], maxItems: 10 }) @IsArray() @ArrayMaxSize(10) @ArrayUnique() @IsString({ each: true }) skills!: string[];
}
export class CreateJobDto extends SkillNamesDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() organizationId!: string;
  @ApiProperty({ maxLength: 160 }) @IsString() @Length(5, 160) title!: string;
  @ApiProperty({ maxLength: 10000 }) @IsString() @Length(30, 10000) description!: string;
  @ApiProperty({ minimum: 10000, maximum: 100000000000, description: 'Integer INR paise' }) @IsInt() @Min(10000) @Max(100000000000) budgetPaise!: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() deadline?: string;
}
export class EditJobDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(5, 160) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(30, 10000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(10000) @Max(100000000000) budgetPaise?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() deadline?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(10) @ArrayUnique() @IsString({ each: true }) skills?: string[];
}
export class MilestonePlanDto {
  @ApiProperty() @IsString() @Length(3, 160) title!: string;
  @ApiProperty({ description: 'Integer INR paise' }) @IsInt() @Min(1) @Max(100000000000) amountPaise!: number;
}
export class SubmitProposalDto {
  @ApiProperty() @IsString() @Length(30, 5000) coverLetter!: string;
  @ApiProperty({ description: 'Integer INR paise' }) @IsInt() @Min(10000) @Max(100000000000) bidPaise!: number;
  @ApiProperty() @IsInt() @Min(1) @Max(365) deliveryDays!: number;
  @ApiPropertyOptional({ type: [MilestonePlanDto], maxItems: 20 }) @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => MilestonePlanDto) milestones?: MilestonePlanDto[];
}
