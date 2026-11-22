import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IdentityService } from './identity.service';
import { AddRoleDto, OnboardingDto, SelfRole } from './dto';
import { PrismaService } from '../database/prisma.service';

describe('identity boundaries', () => {
  it('rejects ADMIN in self-service role input', async () => {
    const dto = plainToInstance(AddRoleDto, { role: 'ADMIN' });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('rejects malformed onboarding roles and overlong names', async () => {
    const dto = plainToInstance(OnboardingDto, { displayName: 'x'.repeat(121), roles: ['ADMIN'] });
    expect(await validate(dto)).toHaveLength(2);
  });

  it('scopes organization lookup to the authenticated member', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = new IdentityService({ clientOrganization: { findFirst } } as unknown as PrismaService);
    const userId = 'aa413e8b-e661-424a-a4e2-ed6885e45e6b';
    const orgId = 'f8d0dcc4-c595-41cc-9e1e-13fa732cc041';
    await expect(service.organization(userId, orgId)).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: orgId, members: { some: { userId } } } }));
  });

  it('requires onboarding before self-service role addition', async () => {
    const service = new IdentityService({ user: { findUniqueOrThrow: async () => ({ displayName: null, roles: [] }) } } as unknown as PrismaService);
    await expect(service.addRole('user-id', { role: SelfRole.CLIENT })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
