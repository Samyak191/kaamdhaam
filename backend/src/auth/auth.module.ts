import { Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { JwtVerifierService } from './jwt-verifier.service';

@Module({ providers: [JwtVerifierService, AuthGuard], exports: [JwtVerifierService, AuthGuard] })
export class AuthModule {}
