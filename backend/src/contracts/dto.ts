import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, Length } from 'class-validator';

export class SubmitMilestoneDto {
  @ApiProperty({ minLength: 20, maxLength: 5000 }) @IsString() @Length(20, 5000) description!: string;
  @ApiPropertyOptional({ description: 'HTTPS link to the deliverable; no file upload in this MVP' }) @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: false }) @Length(8, 2048) deliverableUrl?: string;
}
export class RevisionDto {
  @ApiProperty({ minLength: 10, maxLength: 2000 }) @IsString() @Length(10, 2000) reason!: string;
}
export class CancelContractDto {
  @ApiProperty({ minLength: 10, maxLength: 1000 }) @IsString() @Length(10, 1000) reason!: string;
}
