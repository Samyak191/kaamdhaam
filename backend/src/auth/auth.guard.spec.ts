import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { JwtVerifierService } from './jwt-verifier.service';
import { PrismaService } from '../database/prisma.service';

describe('AuthGuard', () => {
  const request = (authorization?: string) => ({ headers: { authorization } });
  const context = (req: object) => ({ switchToHttp: () => ({ getRequest: () => req }) }) as ExecutionContext;
  const verifier = { verify: jest.fn().mockResolvedValue('c67ec9b4-a79c-4ac4-af64-f607a44824f9') } as unknown as JwtVerifierService;

  it('rejects missing and malformed bearer headers before verification', async () => {
    const guard = new AuthGuard(verifier, {} as PrismaService);
    await expect(guard.canActivate(context(request()))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(context(request('Bearer')))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it('blocks suspended application users', async () => {
    const db = { user: { findUnique: async () => ({ id: 'user', status: 'SUSPENDED' }) } } as unknown as PrismaService;
    const guard = new AuthGuard(verifier, db);
    await expect(guard.canActivate(context(request('Bearer token')))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('assigns identity from a verified subject, not request body', async () => {
    const req = { ...request('Bearer token'), body: { userId: 'attacker' } };
    const db = { user: { findUnique: async () => ({ id: 'real-user', status: 'ACTIVE' }) } } as unknown as PrismaService;
    const guard = new AuthGuard(verifier, db);
    await expect(guard.canActivate(context(req))).resolves.toBe(true);
    expect((req as any).principal).toEqual({ id: 'real-user', authSubject: 'c67ec9b4-a79c-4ac4-af64-f607a44824f9' });
  });
});
