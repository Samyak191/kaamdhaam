import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '../generated/prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { AddRoleDto, CreateOrganizationDto, OnboardingDto, ProfileDto, SelfRole } from './dto';

@Injectable()
export class IdentityService {
  constructor(private readonly db: PrismaService) {}

  async me(userId: string) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, include: { roles: true, profile: true, memberships: true } });
    return {
      id: user.id, displayName: user.displayName, status: user.status,
      roles: user.roles.map(x => x.role),
      onboardingComplete: Boolean(user.displayName && user.roles.length),
      freelancerProfile: user.profile && { headline: user.profile.headline, bio: user.profile.bio, locationCity: user.profile.locationCity, locationState: user.profile.locationState, countryCode: user.profile.countryCode },
      organizationIds: user.memberships.map(x => x.organizationId),
    };
  }

  async onboard(userId: string, input: OnboardingDto) {
    if (input.organizationName && !input.roles.includes(SelfRole.CLIENT)) throw new BadRequestException('CLIENT role required for organization');
    if ((input.headline || input.bio || input.locationCity || input.locationState) && !input.roles.includes(SelfRole.FREELANCER)) throw new BadRequestException('FREELANCER role required for profile');
    try {
      await this.db.$transaction(async tx => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, include: { roles: true } });
      if (user.displayName || user.roles.length) throw new ConflictException('Onboarding already completed');
      await tx.user.update({ where: { id: userId }, data: { displayName: input.displayName.trim() } });
      await tx.userRoleAssignment.createMany({ data: input.roles.map(role => ({ userId, role })), skipDuplicates: true });
      if (input.roles.includes(SelfRole.FREELANCER)) {
        await tx.freelancerProfile.create({ data: { userId, headline: input.headline?.trim(), bio: input.bio?.trim(), locationCity: input.locationCity?.trim(), locationState: input.locationState?.trim() } });
      }
      if (input.organizationName) {
        await this.createOrganizationRecord(tx, userId, input.organizationName);
      }
      await tx.auditLog.create({ data: { actorUserId: userId, action: 'ONBOARDING_COMPLETED', entityType: 'user', entityId: userId, metadata: { roles: input.roles } } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 15000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
        throw new ConflictException('Onboarding already completed');
      }
      throw error;
    }
    return this.me(userId);
  }

  async addRole(userId: string, input: AddRoleDto) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, include: { roles: true } });
    if (!user.displayName || !user.roles.length) throw new ForbiddenException('Complete onboarding first');
    await this.db.$transaction(async tx => {
      const result = await tx.userRoleAssignment.createMany({ data: [{ userId, role: input.role }], skipDuplicates: true });
      if (result.count) {
        if (input.role === SelfRole.FREELANCER) await tx.freelancerProfile.upsert({ where: { userId }, create: { userId }, update: {} });
        await tx.auditLog.create({ data: { actorUserId: userId, action: 'ROLE_ADDED', entityType: 'user', entityId: userId, metadata: { role: input.role } } });
      }
    }, { maxWait: 10000, timeout: 15000 });
    return this.me(userId);
  }

  async updateProfile(userId: string, input: ProfileDto) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, include: { roles: true } });
    if (!user.displayName || !user.roles.length) throw new ForbiddenException('Complete onboarding first');
    await this.db.$transaction(async tx => {
      if (input.displayName !== undefined) await tx.user.update({ where: { id: userId }, data: { displayName: input.displayName.trim() } });
      const fields = { headline: input.headline?.trim(), bio: input.bio?.trim(), locationCity: input.locationCity?.trim(), locationState: input.locationState?.trim() };
      if (Object.values(fields).some(value => value !== undefined)) {
        const role = await tx.userRoleAssignment.findUnique({ where: { userId_role: { userId, role: UserRole.FREELANCER } } });
        if (!role) throw new ForbiddenException('FREELANCER role required');
        await tx.freelancerProfile.update({ where: { userId }, data: fields });
      }
      await tx.auditLog.create({ data: { actorUserId: userId, action: 'PROFILE_UPDATED', entityType: 'user', entityId: userId, metadata: { fields: Object.keys(input) } } });
    }, { maxWait: 10000, timeout: 15000 });
    return this.me(userId);
  }

  private async createOrganizationRecord(tx: Prisma.TransactionClient, userId: string, name: string) {
    const normalized = name.trim();
    const base = normalized.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 130) || 'organization';
    const organization = await tx.clientOrganization.create({
      data: { name: normalized, slug: `${base}-${randomUUID().slice(0, 8)}`, createdByUserId: userId,
        members: { create: { userId, membershipRole: 'OWNER' } } },
    });
    await tx.auditLog.create({ data: { actorUserId: userId, action: 'ORGANIZATION_CREATED', entityType: 'organization', entityId: organization.id, metadata: {} } });
    return { id: organization.id, name: organization.name, slug: organization.slug, createdAt: organization.createdAt };
  }

  async createOrganization(userId: string, input: CreateOrganizationDto) {
    const role = await this.db.userRoleAssignment.findUnique({ where: { userId_role: { userId, role: UserRole.CLIENT } } });
    if (!role) throw new ForbiddenException('CLIENT role required');
    return this.db.$transaction(tx => this.createOrganizationRecord(tx, userId, input.name), { maxWait: 10000, timeout: 15000 });
  }

  organizations(userId: string) {
    return this.db.clientOrganization.findMany({ where: { members: { some: { userId } } }, select: { id: true, name: true, slug: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async organization(userId: string, id: string) {
    const organization = await this.db.clientOrganization.findFirst({ where: { id, members: { some: { userId } } }, select: { id: true, name: true, slug: true, createdAt: true, members: { where: { userId }, select: { membershipRole: true } } } });
    if (!organization) throw new NotFoundException('Organization not found');
    return { id: organization.id, name: organization.name, slug: organization.slug, createdAt: organization.createdAt, membershipRole: organization.members[0].membershipRole };
  }
}
