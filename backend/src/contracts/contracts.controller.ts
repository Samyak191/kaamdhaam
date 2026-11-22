import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type Principal } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PageQuery } from '../marketplace/dto';
import { ContractResponseDto } from '../marketplace/response.dto';
import { ContractsService } from './contracts.service';
import { CancelContractDto, RevisionDto, SubmitMilestoneDto } from './dto';

@ApiTags('Contracts')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}
  @Get(':id') @ApiOperation({ summary: 'Contract details for a contracting party' }) @ApiResponse({ status: 200, type: ContractResponseDto }) @ApiResponse({ status: 404 })
  get(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string) { return this.contracts.get(user.id, id); }
  @Post(':id/milestones/:milestoneId/submit') @ApiOperation({ summary: 'Assigned freelancer submits or resubmits work' }) @ApiResponse({ status: 201, type: ContractResponseDto }) @ApiResponse({ status: 409 })
  submit(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string, @Param('milestoneId', ParseUUIDPipe) milestoneId: string, @Body() input: SubmitMilestoneDto) { return this.contracts.submit(user.id, id, milestoneId, input); }
  @Post(':id/milestones/:milestoneId/approve') @ApiOperation({ summary: 'Organization owner approves submitted milestone; no money moves' }) @ApiResponse({ status: 201, type: ContractResponseDto }) @ApiResponse({ status: 409 })
  approve(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string, @Param('milestoneId', ParseUUIDPipe) milestoneId: string) { return this.contracts.approve(user.id, id, milestoneId); }
  @Post(':id/milestones/:milestoneId/request-revision') @ApiOperation({ summary: 'Organization owner requests a revision' }) @ApiResponse({ status: 201, type: ContractResponseDto }) @ApiResponse({ status: 409 })
  revise(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string, @Param('milestoneId', ParseUUIDPipe) milestoneId: string, @Body() input: RevisionDto) { return this.contracts.requestRevision(user.id, id, milestoneId, input); }
  @Post(':id/complete') @ApiOperation({ summary: 'Owner completes contract after all milestones are approved' }) @ApiResponse({ status: 201, type: ContractResponseDto }) @ApiResponse({ status: 409 })
  complete(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string) { return this.contracts.complete(user.id, id); }
  @Post(':id/cancel') @ApiOperation({ summary: 'Owner cancels only before work is submitted; no refund or payment action' }) @ApiResponse({ status: 201, type: ContractResponseDto }) @ApiResponse({ status: 409 })
  cancel(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string, @Body() input: CancelContractDto) { return this.contracts.cancel(user.id, id, input); }
}

@ApiTags('Contracts')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('me/contracts')
export class MyContractsController {
  constructor(private readonly contracts: ContractsService) {}
  @Get() @ApiOperation({ summary: 'My contracts, including organization membership' }) @ApiResponse({ status: 200 })
  list(@CurrentUser() user: Principal, @Query() page: PageQuery) { return this.contracts.myContracts(user.id, page.limit, page.offset); }
}
