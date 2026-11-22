import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type Principal } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AddRoleDto, CreateOrganizationDto, OnboardingDto, ProfileDto } from './dto';
import { IdentityService } from './identity.service';
import { MeResponseDto, OrganizationResponseDto } from './response.dto';
import { ParseUUIDPipe } from '@nestjs/common';

@ApiTags('Identity')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly identity: IdentityService) {}
  @Get() @ApiOperation({ summary: 'Current application identity' }) @ApiResponse({ status: 200, type: MeResponseDto }) @ApiResponse({ status: 401 }) @ApiResponse({ status: 403 })
  me(@CurrentUser() user: Principal) { return this.identity.me(user.id); }
  @Post('onboarding') @ApiOperation({ summary: 'Complete initial onboarding once' }) @ApiResponse({ status: 201, type: MeResponseDto }) @ApiResponse({ status: 400 }) @ApiResponse({ status: 409 })
  onboard(@CurrentUser() user: Principal, @Body() input: OnboardingDto) { return this.identity.onboard(user.id, input); }
  @Patch('profile') @ApiOperation({ summary: 'Update own profile' }) @ApiResponse({ status: 200, type: MeResponseDto }) @ApiResponse({ status: 400 }) @ApiResponse({ status: 403 })
  profile(@CurrentUser() user: Principal, @Body() input: ProfileDto) { return this.identity.updateProfile(user.id, input); }
  @Post('roles') @ApiOperation({ summary: 'Add one self-service role' }) @ApiResponse({ status: 201, type: MeResponseDto }) @ApiResponse({ status: 400 }) @ApiResponse({ status: 403 })
  role(@CurrentUser() user: Principal, @Body() input: AddRoleDto) { return this.identity.addRole(user.id, input); }
  @Get('organizations') @ApiOperation({ summary: 'List own organizations' }) @ApiResponse({ status: 200, type: [OrganizationResponseDto] })
  organizations(@CurrentUser() user: Principal) { return this.identity.organizations(user.id); }
}

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly identity: IdentityService) {}
  @Post() @ApiOperation({ summary: 'Create a client organization' }) @ApiResponse({ status: 201, type: OrganizationResponseDto }) @ApiResponse({ status: 400 }) @ApiResponse({ status: 403 })
  create(@CurrentUser() user: Principal, @Body() input: CreateOrganizationDto) { return this.identity.createOrganization(user.id, input); }
  @Get(':id') @ApiOperation({ summary: 'Get an organization where you are a member' }) @ApiResponse({ status: 200, type: OrganizationResponseDto }) @ApiResponse({ status: 404 })
  get(@CurrentUser() user: Principal, @Param('id', new ParseUUIDPipe()) id: string) { return this.identity.organization(user.id, id); }
}
