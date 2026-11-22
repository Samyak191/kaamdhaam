import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { JwtVerifierService } from './jwt-verifier.service';

export interface Principal { id: string; authSubject: string }
export interface AuthenticatedRequest { headers: { authorization?: string }; principal: Principal }

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly verifier: JwtVerifierService, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header || !/^Bearer [A-Za-z0-9._~+/-]+={0,2}$/.test(header)) {
      throw new UnauthorizedException('Bearer access token required');
    }
    const subject = await this.verifier.verify(header.slice(7));
    let user = await this.prisma.user.findUnique({ where: { authSubject: subject } });
    if (!user) {
      try {
        user = await this.prisma.$transaction(async tx => {
          const created = await tx.user.create({ data: { authSubject: subject } });
          await tx.auditLog.create({ data: { actorUserId: created.id, action: 'USER_PROVISIONED', entityType: 'user', entityId: created.id, metadata: {} } });
          return created;
        }, { maxWait: 10000, timeout: 15000 });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
        user = await this.prisma.user.findUniqueOrThrow({ where: { authSubject: subject } });
      }
    }
    if (user.status === 'SUSPENDED') throw new ForbiddenException('Account suspended');
    request.principal = { id: user.id, authSubject: subject };
    return true;
  }
}
