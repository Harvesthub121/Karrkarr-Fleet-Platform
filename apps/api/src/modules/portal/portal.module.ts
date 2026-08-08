import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

@Module({
  imports: [
    // DocumentsModule exports S3Service which PortalService depends on
    DocumentsModule,
  ],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
