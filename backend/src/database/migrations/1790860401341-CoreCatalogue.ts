import { MigrationInterface, QueryRunner } from 'typeorm';

export class CoreCatalogue1790860401341 implements MigrationInterface {
  name = 'CoreCatalogue1790860401341';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "parent_id" uuid, "name" character varying(100) NOT NULL, "slug" character varying(120) NOT NULL, "description" character varying(500), "icon" character varying(50), "image_url" character varying(500), "sort_order" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "uq_categories_slug" UNIQUE ("slug"), CONSTRAINT "pk_categories" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "idx_categories_parent_id" ON "categories" ("parent_id") `);
    await queryRunner.query(`CREATE TABLE "product_images" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "product_id" uuid NOT NULL, "url" character varying(500) NOT NULL, "storage_key" character varying(300), "alt" character varying(200), "sort_order" integer NOT NULL DEFAULT '0', "is_primary" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "pk_product_images" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "idx_product_images_product_id" ON "product_images" ("product_id") `);
    await queryRunner.query(`CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "category_id" uuid NOT NULL, "name" character varying(200) NOT NULL, "slug" character varying(230) NOT NULL, "sku" character varying(60) NOT NULL, "brand" character varying(100), "description" text, "unit" character varying(30) NOT NULL DEFAULT 'each', "pack_size" character varying(60), "weight_kg" numeric(10,3) NOT NULL DEFAULT '0', "length_cm" numeric(8,1), "width_cm" numeric(8,1), "height_cm" numeric(8,1), "is_active" boolean NOT NULL DEFAULT true, "created_by_store_id" uuid, "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "uq_products_slug" UNIQUE ("slug"), CONSTRAINT "uq_products_sku" UNIQUE ("sku"), CONSTRAINT "chk_products_weight" CHECK ("weight_kg" >= 0), CONSTRAINT "pk_products" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "idx_products_active" ON "products" ("is_active") `);
    await queryRunner.query(`CREATE INDEX "idx_products_category_id" ON "products" ("category_id") `);
    await queryRunner.query(`CREATE TYPE "public"."store_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`);
    await queryRunner.query(`CREATE TABLE "hardware_stores" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(150) NOT NULL, "slug" character varying(170) NOT NULL, "description" text, "logo_url" character varying(500), "banner_url" character varying(500), "phone" character varying(20), "email" character varying(255), "street_address" character varying(255) NOT NULL, "suburb" character varying(100), "city" character varying(100) NOT NULL, "province" character varying(50) NOT NULL, "postal_code" character varying(10), "location" geography(Point,4326) NOT NULL, "operating_hours" jsonb NOT NULL, "status" "public"."store_status" NOT NULL DEFAULT 'PENDING', "rejection_reason" character varying(500), "is_active" boolean NOT NULL DEFAULT true, "accepting_orders" boolean NOT NULL DEFAULT true, "commission_percent" numeric(5,2), "rating_average" numeric(3,2) NOT NULL DEFAULT '0', "rating_count" integer NOT NULL DEFAULT '0', "approved_at" TIMESTAMP WITH TIME ZONE, "approved_by" uuid, "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "uq_hardware_stores_slug" UNIQUE ("slug"), CONSTRAINT "chk_hardware_stores_commission" CHECK ("commission_percent" IS NULL OR ("commission_percent" >= 0 AND "commission_percent" <= 50)), CONSTRAINT "pk_hardware_stores" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "idx_hardware_stores_location" ON "hardware_stores" USING GiST ("location") `);
    await queryRunner.query(`CREATE INDEX "idx_hardware_stores_status" ON "hardware_stores" ("status", "is_active") `);
    await queryRunner.query(`CREATE TABLE "store_products" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "store_id" uuid NOT NULL, "product_id" uuid NOT NULL, "store_sku" character varying(60), "price" numeric(12,2) NOT NULL, "sale_price" numeric(12,2), "stock_quantity" integer NOT NULL DEFAULT '0', "minimum_quantity" integer NOT NULL DEFAULT '1', "maximum_quantity" integer, "low_stock_threshold" integer NOT NULL DEFAULT '5', "available" boolean NOT NULL DEFAULT true, "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "chk_store_products_quantities" CHECK ("minimum_quantity" >= 1 AND ("maximum_quantity" IS NULL OR "maximum_quantity" >= "minimum_quantity")), CONSTRAINT "chk_store_products_stock" CHECK ("stock_quantity" >= 0), CONSTRAINT "chk_store_products_sale_price" CHECK ("sale_price" IS NULL OR ("sale_price" > 0 AND "sale_price" < "price")), CONSTRAINT "chk_store_products_price" CHECK ("price" > 0), CONSTRAINT "pk_store_products" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "idx_store_products_store_available" ON "store_products" ("store_id", "available") `);
    await queryRunner.query(`CREATE INDEX "idx_store_products_product_id" ON "store_products" ("product_id") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_store_products_store_product" ON "store_products" ("store_id", "product_id") WHERE "deleted_at" IS NULL`);
    await queryRunner.query(`CREATE TYPE "public"."inventory_reason" AS ENUM('INITIAL_STOCK', 'RESTOCK', 'ADJUSTMENT', 'CORRECTION', 'SALE', 'ORDER_CANCELLED')`);
    await queryRunner.query(`CREATE TABLE "inventory" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "store_product_id" uuid NOT NULL, "change" integer NOT NULL, "quantity_after" integer NOT NULL, "reason" "public"."inventory_reason" NOT NULL, "order_id" uuid, "actor_user_id" uuid, "note" character varying(300), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_inventory_change" CHECK ("change" <> 0), CONSTRAINT "pk_inventory" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "idx_inventory_order_id" ON "inventory" ("order_id") `);
    await queryRunner.query(`CREATE INDEX "idx_inventory_listing_created" ON "inventory" ("store_product_id", "created_at") `);
    await queryRunner.query(`CREATE TYPE "public"."store_staff_role" AS ENUM('OWNER', 'MANAGER', 'STAFF')`);
    await queryRunner.query(`CREATE TABLE "store_staff" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "store_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" "public"."store_staff_role" NOT NULL DEFAULT 'STAFF', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "pk_store_staff" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "idx_store_staff_user_id" ON "store_staff" ("user_id") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_store_staff_store_user" ON "store_staff" ("store_id", "user_id") `);
    await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "fk_categories_parent_id" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "product_images" ADD CONSTRAINT "fk_product_images_product_id" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "products" ADD CONSTRAINT "fk_products_category_id" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "store_products" ADD CONSTRAINT "fk_store_products_store_id" FOREIGN KEY ("store_id") REFERENCES "hardware_stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "store_products" ADD CONSTRAINT "fk_store_products_product_id" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "inventory" ADD CONSTRAINT "fk_inventory_store_product_id" FOREIGN KEY ("store_product_id") REFERENCES "store_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "store_staff" ADD CONSTRAINT "fk_store_staff_store_id" FOREIGN KEY ("store_id") REFERENCES "hardware_stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "store_staff" ADD CONSTRAINT "fk_store_staff_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "store_staff" DROP CONSTRAINT "fk_store_staff_user_id"`);
    await queryRunner.query(`ALTER TABLE "store_staff" DROP CONSTRAINT "fk_store_staff_store_id"`);
    await queryRunner.query(`ALTER TABLE "inventory" DROP CONSTRAINT "fk_inventory_store_product_id"`);
    await queryRunner.query(`ALTER TABLE "store_products" DROP CONSTRAINT "fk_store_products_product_id"`);
    await queryRunner.query(`ALTER TABLE "store_products" DROP CONSTRAINT "fk_store_products_store_id"`);
    await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "fk_products_category_id"`);
    await queryRunner.query(`ALTER TABLE "product_images" DROP CONSTRAINT "fk_product_images_product_id"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "fk_categories_parent_id"`);
    await queryRunner.query(`DROP INDEX "public"."uq_store_staff_store_user"`);
    await queryRunner.query(`DROP INDEX "public"."idx_store_staff_user_id"`);
    await queryRunner.query(`DROP TABLE "store_staff"`);
    await queryRunner.query(`DROP TYPE "public"."store_staff_role"`);
    await queryRunner.query(`DROP INDEX "public"."idx_inventory_listing_created"`);
    await queryRunner.query(`DROP INDEX "public"."idx_inventory_order_id"`);
    await queryRunner.query(`DROP TABLE "inventory"`);
    await queryRunner.query(`DROP TYPE "public"."inventory_reason"`);
    await queryRunner.query(`DROP INDEX "public"."uq_store_products_store_product"`);
    await queryRunner.query(`DROP INDEX "public"."idx_store_products_product_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_store_products_store_available"`);
    await queryRunner.query(`DROP TABLE "store_products"`);
    await queryRunner.query(`DROP INDEX "public"."idx_hardware_stores_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_hardware_stores_location"`);
    await queryRunner.query(`DROP TABLE "hardware_stores"`);
    await queryRunner.query(`DROP TYPE "public"."store_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_products_category_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_products_active"`);
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(`DROP INDEX "public"."idx_product_images_product_id"`);
    await queryRunner.query(`DROP TABLE "product_images"`);
    await queryRunner.query(`DROP INDEX "public"."idx_categories_parent_id"`);
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}
