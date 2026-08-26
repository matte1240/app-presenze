CREATE TABLE "billing_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"legal_name" text NOT NULL,
	"address_line" text NOT NULL,
	"postal_code" text NOT NULL,
	"city" text NOT NULL,
	"province" text,
	"country" text DEFAULT 'IT' NOT NULL,
	"vat_number" text,
	"tax_code" text,
	"sdi_code" text,
	"pec" text,
	"billing_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "billing_profiles_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "billing_profiles" ADD CONSTRAINT "billing_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;