import { MigrationInterface, QueryRunner } from 'typeorm';

export class Foundation1790858790295 implements MigrationInterface {
  name = 'Foundation1790858790295';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostGIS powers every geospatial query (nearby stores, driver dispatch, distances).
    // Requires a database user allowed to create extensions (the postgis/postgis image's superuser).
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);

    await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "actor_user_id" uuid, "actor_email" character varying(255), "actor_roles" character varying(100), "action" character varying(100) NOT NULL, "entity_type" character varying(60) NOT NULL, "entity_id" character varying(100), "before" jsonb, "after" jsonb, "metadata" jsonb, "ip" character varying(64), "user_agent" character varying(255), "request_id" character varying(64), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "pk_audit_logs" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_action" ON "audit_logs" ("action") `);
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" ("created_at") `);
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_actor_user_id" ON "audit_logs" ("actor_user_id") `);
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id") `);
    await queryRunner.query(`CREATE TABLE "roles" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(30) NOT NULL, "description" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_roles_name" UNIQUE ("name"), CONSTRAINT "pk_roles" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "first_name" character varying(100) NOT NULL, "last_name" character varying(100) NOT NULL, "phone" character varying(20), "avatar_url" character varying(500), "is_active" boolean NOT NULL DEFAULT true, "email_verified_at" TIMESTAMP WITH TIME ZONE, "last_login_at" TIMESTAMP WITH TIME ZONE, "failed_login_attempts" integer NOT NULL DEFAULT '0', "locked_until" TIMESTAMP WITH TIME ZONE, "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "uq_users_email" UNIQUE ("email"), CONSTRAINT "chk_users_email_lowercase" CHECK ("email" = lower("email")), CONSTRAINT "pk_users" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "idx_users_phone" ON "users" ("phone") `);
    await queryRunner.query(`CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "family_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "revoked_reason" character varying(30), "user_agent" character varying(255), "ip" character varying(64), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_refresh_tokens_token_hash" UNIQUE ("token_hash"), CONSTRAINT "pk_refresh_tokens" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "idx_refresh_tokens_expires_at" ON "refresh_tokens" ("expires_at") `);
    await queryRunner.query(`CREATE INDEX "idx_refresh_tokens_family_id" ON "refresh_tokens" ("family_id") `);
    await queryRunner.query(`CREATE INDEX "idx_refresh_tokens_user_id" ON "refresh_tokens" ("user_id") `);
    await queryRunner.query(`CREATE TABLE "customers" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "marketing_opt_in" boolean NOT NULL DEFAULT false, CONSTRAINT "uq_customers_user_id" UNIQUE ("user_id"), CONSTRAINT "rel_customers_user_id" UNIQUE ("user_id"), CONSTRAINT "pk_customers" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "platform_settings" ("key" character varying(100) NOT NULL, "value" jsonb NOT NULL, "updated_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "pk_platform_settings" PRIMARY KEY ("key"))`);
    await queryRunner.query(`CREATE TABLE "user_roles" ("user_id" uuid NOT NULL, "role_id" uuid NOT NULL, CONSTRAINT "pk_user_roles" PRIMARY KEY ("user_id", "role_id"))`);
    await queryRunner.query(`CREATE INDEX "idx_user_roles_user_id" ON "user_roles" ("user_id") `);
    await queryRunner.query(`CREATE INDEX "idx_user_roles_role_id" ON "user_roles" ("role_id") `);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "fk_refresh_tokens_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "customers" ADD CONSTRAINT "fk_customers_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles_role_id" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`);

    // Reference data: the four platform roles.
    await queryRunner.query(`
      INSERT INTO "roles" ("name", "description") VALUES
        ('CUSTOMER', 'Orders hardware and building materials for delivery'),
        ('STORE', 'Hardware store staff managing listings, stock and orders'),
        ('DRIVER', 'Delivers orders from stores to customers'),
        ('ADMIN', 'Platform administrator')
      ON CONFLICT ("name") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "fk_user_roles_role_id"`);
    await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "fk_user_roles_user_id"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP CONSTRAINT "fk_customers_user_id"`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "fk_refresh_tokens_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_user_roles_role_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_user_roles_user_id"`);
    await queryRunner.query(`DROP TABLE "user_roles"`);
    await queryRunner.query(`DROP TABLE "platform_settings"`);
    await queryRunner.query(`DROP TABLE "customers"`);
    await queryRunner.query(`DROP INDEX "public"."idx_refresh_tokens_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_refresh_tokens_family_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_refresh_tokens_expires_at"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP INDEX "public"."idx_users_phone"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_entity"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_actor_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_action"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
  }
}
