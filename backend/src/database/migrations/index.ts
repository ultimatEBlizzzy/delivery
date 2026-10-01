import { CoreCatalogue1790860401341 } from './1790860401341-CoreCatalogue';
import { Foundation1790858790295 } from './1790858790295-Foundation';
import type { MigrationInterface } from 'typeorm';

/** Ordered list of migrations. Add new migrations here (the generator script does it for you). */
export const ALL_MIGRATIONS: Array<new () => MigrationInterface> = [Foundation1790858790295, CoreCatalogue1790860401341];
