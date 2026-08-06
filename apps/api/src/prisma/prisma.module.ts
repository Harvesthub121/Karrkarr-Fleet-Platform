import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global so every module can inject PrismaService without re-importing this
 * module. One PrismaClient instance for the whole process is intentional:
 * PrismaClient manages its own connection pool; multiple instances compete
 * for connections and waste memory.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
