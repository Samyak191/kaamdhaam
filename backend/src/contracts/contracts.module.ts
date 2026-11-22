import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContractsController, MyContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

@Module({ imports: [AuthModule], controllers: [ContractsController, MyContractsController], providers: [ContractsService] })
export class ContractsModule {}
