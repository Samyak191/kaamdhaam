import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class MessageQuery {
  @ApiPropertyOptional({ default: 30, minimum: 1, maximum: 50 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 30;
  @ApiPropertyOptional({ description: 'Sequence before which older messages are returned' }) @IsOptional() @Matches(/^[1-9][0-9]{0,18}$/) before?: string;
}
export class SendMessageDto {
  @ApiProperty({ minLength: 1, maxLength: 4000 }) @IsString() @Length(1, 4000) body!: string;
}
export class MarkReadDto {
  @ApiProperty({ example: '42', description: 'Highest displayed message sequence' }) @Matches(/^(0|[1-9][0-9]{0,18})$/) throughSequence!: string;
}
