import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FreelancersController, JobsController, MyMarketplaceController, ProposalsController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

@Module({ imports: [AuthModule], controllers: [JobsController, FreelancersController, MyMarketplaceController, ProposalsController], providers: [MarketplaceService] })
export class MarketplaceModule {}
