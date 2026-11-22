import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IdentityService } from './identity.service';
import { MeController, OrganizationsController } from './identity.controller';

@Module({ imports: [AuthModule], providers: [IdentityService], controllers: [MeController, OrganizationsController] })
export class IdentityModule {}
