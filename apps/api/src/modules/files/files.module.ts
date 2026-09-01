import { Module } from '@nestjs/common';
import { ApiKeyModule } from '../api-keys/api-keys.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  // AuthModule — `JwtGuard` (PATCH); ApiKeyModule — `RequestIdentityService` (GET, спека 012).
  imports: [StorageModule, AuthModule, ApiKeyModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
