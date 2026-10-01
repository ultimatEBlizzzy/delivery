import { Global, Module } from '@nestjs/common';
import { LocalStorageProvider } from './local-storage.provider';
import { FilesController } from './files.controller';
import { StorageService } from './storage.service';
import { STORAGE_PROVIDER } from './storage.types';

/**
 * Selecting a provider: add its class here and branch on `STORAGE_PROVIDER` config in the factory.
 * Everything else depends only on StorageService.
 */
@Global()
@Module({
  controllers: [FilesController],
  providers: [
    LocalStorageProvider,
    { provide: STORAGE_PROVIDER, useExisting: LocalStorageProvider },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
