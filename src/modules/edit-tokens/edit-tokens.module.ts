import { Module } from '@nestjs/common';
import { EditTokensController } from './edit-tokens.controller';
import { EditTokensService } from './edit-tokens.service';

@Module({
	controllers: [EditTokensController],
	providers: [EditTokensService],
	exports: [EditTokensService],
})
export class EditTokensModule {}
