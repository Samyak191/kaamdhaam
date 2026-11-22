import { BadRequestException, Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type Principal } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateJobDto, EditJobDto, FreelancerQuery, JobQuery, PageQuery, SkillNamesDto, SubmitProposalDto } from './dto';
import { MarketplaceService } from './marketplace.service';
import { ContractResponseDto, FreelancerPageResponseDto, FreelancerResponseDto, JobPageResponseDto, JobResponseDto, ProposalPageResponseDto, ProposalResponseDto } from './response.dto';

@ApiTags('Jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly market: MarketplaceService) {}
  @Get() @ApiOperation({ summary: 'Public open jobs; bounded offset pagination, filters and whitelisted sort' }) @ApiResponse({ status: 200, type: JobPageResponseDto })
  list(@Query() query: JobQuery) { return this.market.listJobs(query); }
  @Get(':id') @ApiOperation({ summary: 'Public open job details' }) @ApiResponse({ status: 200, type: JobResponseDto }) @ApiResponse({ status: 404 })
  get(@Param('id', ParseUUIDPipe) id: string) { return this.market.publicJob(id); }
  @Post() @UseGuards(AuthGuard) @ApiBearerAuth() @ApiBody({ type: CreateJobDto }) @ApiOperation({ summary: 'Owner creates draft job' }) @ApiResponse({ status: 201, type: JobResponseDto }) @ApiResponse({ status: 401 }) @ApiResponse({ status: 404 })
  create(@CurrentUser() user: Principal, @Body() body: CreateJobDto) { return this.market.createJob(user.id, body); }
  @Patch(':id') @UseGuards(AuthGuard) @ApiBearerAuth() @ApiBody({ type: EditJobDto }) @ApiOperation({ summary: 'Owner edits a draft job' }) @ApiResponse({ status: 200, type: JobResponseDto }) @ApiResponse({ status: 409 })
  edit(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string, @Body() body: EditJobDto) { return this.market.editJob(user.id, id, body); }
  @Post(':id/publish') @UseGuards(AuthGuard) @ApiBearerAuth() @ApiOperation({ summary: 'Owner atomically publishes a draft' }) @ApiResponse({ status: 201, type: JobResponseDto }) @ApiResponse({ status: 409 })
  publish(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string) { return this.market.publishJob(user.id, id); }
  @Post(':id/proposals') @UseGuards(AuthGuard) @ApiBearerAuth() @ApiBody({ type: SubmitProposalDto }) @ApiOperation({ summary: 'Freelancer submits one proposal per job' }) @ApiResponse({ status: 201, type: ProposalResponseDto }) @ApiResponse({ status: 409 })
  propose(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string, @Body() body: SubmitProposalDto) { return this.market.submitProposal(user.id, id, body); }
  @Get(':id/proposals') @UseGuards(AuthGuard) @ApiBearerAuth() @ApiOperation({ summary: 'Organization members list private job proposals' }) @ApiResponse({ status: 200, type: ProposalPageResponseDto }) @ApiResponse({ status: 404 })
  proposals(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string, @Query() page: PageQuery) { return this.market.jobProposals(user.id, id, page.limit, page.offset); }
}

@ApiTags('Freelancers')
@Controller('freelancers')
export class FreelancersController {
  constructor(private readonly market: MarketplaceService) {}
  @Get() @ApiOperation({ summary: 'Public complete freelancer profiles' }) @ApiResponse({ status: 200, type: FreelancerPageResponseDto })
  list(@Query() query: FreelancerQuery) { return this.market.listFreelancers(query); }
  @Get(':id') @ApiOperation({ summary: 'Public freelancer profile' }) @ApiResponse({ status: 200, type: FreelancerResponseDto }) @ApiResponse({ status: 404 })
  get(@Param('id', ParseUUIDPipe) id: string) { return this.market.publicFreelancer(id); }
}

@ApiTags('Marketplace identity')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('me')
export class MyMarketplaceController {
  constructor(private readonly market: MarketplaceService) {}
  @Get('jobs') @ApiOperation({ summary: 'Jobs in organizations where I am a member' }) @ApiResponse({ status: 200, type: JobPageResponseDto })
  jobs(@CurrentUser() user: Principal, @Query() page: PageQuery) { return this.market.myJobs(user.id, page.limit, page.offset); }
  @Get('jobs/:id') @ApiOperation({ summary: 'Owner reads own draft or published job' }) @ApiResponse({ status: 200, type: JobResponseDto }) @ApiResponse({ status: 404 })
  job(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string) { return this.market.myJob(user.id, id); }
  @Get('proposals') @ApiOperation({ summary: 'My private proposals' }) @ApiResponse({ status: 200, type: ProposalPageResponseDto })
  proposals(@CurrentUser() user: Principal, @Query() page: PageQuery) { return this.market.myProposals(user.id, page.limit, page.offset); }
  @Patch('skills') @ApiBody({ type: SkillNamesDto }) @ApiOperation({ summary: 'Set my normalized freelancer skills' }) @ApiResponse({ status: 200 })
  skills(@CurrentUser() user: Principal, @Body() body: SkillNamesDto) { return this.market.setMySkills(user.id, body.skills); }
}

@ApiTags('Proposals')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly market: MarketplaceService) {}
  @Post(':id/shortlist') @ApiOperation({ summary: 'Owner shortlists an open proposal' }) @ApiResponse({ status: 201, type: ProposalResponseDto }) @ApiResponse({ status: 409 })
  shortlist(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string) { return this.market.transitionProposal(user.id, id, 'SHORTLISTED'); }
  @Post(':id/reject') @ApiOperation({ summary: 'Owner rejects a submitted or shortlisted proposal' }) @ApiResponse({ status: 201, type: ProposalResponseDto }) @ApiResponse({ status: 409 })
  reject(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string) { return this.market.transitionProposal(user.id, id, 'REJECTED'); }
  @Post(':id/hire') @ApiHeader({ name: 'Idempotency-Key', required: true, description: '8–128 URL-safe characters; retained permanently per actor' }) @ApiOperation({ summary: 'Owner atomically hires one proposal and creates one contract' }) @ApiResponse({ status: 201, type: ContractResponseDto }) @ApiResponse({ status: 409 })
  hire(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string, @Headers('idempotency-key') key?: string) {
    if (!key) throw new BadRequestException('Idempotency-Key required');
    return this.market.hire(user.id, id, key);
  }
}
