import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicOrganizationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
}
export class JobResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: PublicOrganizationDto }) organization!: PublicOrganizationDto;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ example: '250000', description: 'Integer INR paise as a decimal string' }) budgetPaise!: string;
  @ApiProperty({ enum: ['DRAFT', 'OPEN', 'HIRED', 'COMPLETED', 'CANCELLED'] }) status!: string;
  @ApiPropertyOptional({ nullable: true }) deadline?: Date | null;
  @ApiPropertyOptional({ nullable: true }) publishedAt?: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ type: [String] }) skills!: string[];
}
export class FreelancerResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() headline!: string;
  @ApiPropertyOptional({ nullable: true }) bio?: string | null;
  @ApiPropertyOptional({ nullable: true }) locationCity?: string | null;
  @ApiPropertyOptional({ nullable: true }) locationState?: string | null;
  @ApiProperty() countryCode!: string;
  @ApiProperty({ type: [String] }) skills!: string[];
}
export class ProposalMilestoneResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() sequence!: number;
  @ApiProperty() title!: string;
  @ApiProperty({ example: '100000' }) amountPaise!: string;
}
export class ProposalResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) jobId!: string;
  @ApiProperty({ format: 'uuid' }) freelancerUserId!: string;
  @ApiProperty() coverLetter!: string;
  @ApiProperty({ example: '200000' }) bidPaise!: string;
  @ApiProperty() deliveryDays!: number;
  @ApiProperty({ enum: ['SUBMITTED', 'SHORTLISTED', 'REJECTED', 'WITHDRAWN', 'HIRED'] }) status!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ type: [ProposalMilestoneResponseDto] }) milestones!: ProposalMilestoneResponseDto[];
}
export class ContractMilestoneResponseDto extends ProposalMilestoneResponseDto {
  @ApiProperty({ enum: ['PLANNED', 'SUBMITTED', 'REVISION_REQUESTED', 'APPROVED', 'CANCELLED', 'COMPLETED'] }) status!: string;
  @ApiPropertyOptional() revisionNumber?: number;
  @ApiPropertyOptional({ nullable: true }) submittedAt?: Date | null;
  @ApiPropertyOptional({ nullable: true }) approvedAt?: Date | null;
  @ApiPropertyOptional({ type: () => [MilestoneSubmissionResponseDto] }) submissions?: MilestoneSubmissionResponseDto[];
}
export class MilestoneSubmissionResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() revisionNumber!: number;
  @ApiProperty() description!: string;
  @ApiPropertyOptional({ nullable: true }) deliverableUrl?: string | null;
  @ApiProperty() submittedAt!: Date;
  @ApiPropertyOptional({ nullable: true }) revisionReason?: string | null;
  @ApiPropertyOptional({ nullable: true }) revisionRequestedAt?: Date | null;
}
export class ContractResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) jobId!: string;
  @ApiProperty({ format: 'uuid' }) proposalId!: string;
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiProperty({ format: 'uuid' }) freelancerUserId!: string;
  @ApiProperty({ example: '200000' }) agreedPaise!: string;
  @ApiProperty({ enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'] }) status!: string;
  @ApiProperty() createdAt!: Date;
  @ApiPropertyOptional() jobTitle?: string;
  @ApiPropertyOptional({ type: PublicOrganizationDto }) organization?: PublicOrganizationDto;
  @ApiPropertyOptional({ format: 'uuid' }) conversationId?: string;
  @ApiPropertyOptional({ nullable: true }) completedAt?: Date | null;
  @ApiPropertyOptional({ nullable: true }) cancelledAt?: Date | null;
  @ApiPropertyOptional({ nullable: true }) cancellationReason?: string | null;
  @ApiProperty({ type: [ContractMilestoneResponseDto] }) milestones!: ContractMilestoneResponseDto[];
}
export class JobPageResponseDto {
  @ApiProperty({ type: [JobResponseDto] }) items!: JobResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() offset!: number;
}
export class FreelancerPageResponseDto {
  @ApiProperty({ type: [FreelancerResponseDto] }) items!: FreelancerResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() offset!: number;
}
export class ProposalPageResponseDto {
  @ApiProperty({ type: [ProposalResponseDto] }) items!: ProposalResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() offset!: number;
}
