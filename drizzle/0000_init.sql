CREATE TYPE "public"."approval_mode" AS ENUM('APP', 'INTERCOM', 'CODE');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('CONFIRMED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."classified_by" AS ENUM('AI', 'RULES', 'STAFF');--> statement-breakpoint
CREATE TYPE "public"."complaint_status" AS ENUM('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."ledger_kind" AS ENUM('MAINTENANCE', 'INTEREST', 'AMENITY', 'PAYMENT', 'ADJUSTMENT', 'REVERSAL');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('CREATED', 'PAID', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."pay_method" AS ENUM('UPI', 'NEFT', 'IMPS', 'CHEQUE', 'CARD', 'NETBANKING', 'CASH', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."pay_source" AS ENUM('GATEWAY', 'BANK', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."relation" AS ENUM('OWNER', 'TENANT', 'FAMILY');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('RESIDENT', 'GUARD', 'HELPDESK', 'ACCOUNTS', 'COMMITTEE', 'MANAGER', 'TECHNICIAN');--> statement-breakpoint
CREATE TYPE "public"."txn_status" AS ENUM('AUTO_MATCHED', 'NEEDS_REVIEW', 'MATCHED', 'IGNORED', 'SETTLEMENT');--> statement-breakpoint
CREATE TYPE "public"."urgency" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'EMERGENCY');--> statement-breakpoint
CREATE TYPE "public"."visitor_status" AS ENUM('PENDING', 'APPROVED', 'DENIED', 'INSIDE', 'LEFT');--> statement-breakpoint
CREATE TABLE "amenities" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "amenities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"slot_minutes" integer NOT NULL,
	"open_minute" integer NOT NULL,
	"close_minute" integer NOT NULL,
	"fee_paise" integer NOT NULL,
	"max_per_week" integer NOT NULL,
	"advance_days" integer NOT NULL,
	"rules" text NOT NULL,
	CONSTRAINT "amenities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"actor_id" integer,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_imports" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bank_imports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"file_name" text NOT NULL,
	"uploaded_by" integer NOT NULL,
	"rows" integer DEFAULT 0 NOT NULL,
	"credits" integer DEFAULT 0 NOT NULL,
	"auto_matched" integer DEFAULT 0 NOT NULL,
	"needs_review" integer DEFAULT 0 NOT NULL,
	"duplicates" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_txns" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bank_txns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"import_id" integer NOT NULL,
	"fingerprint" text NOT NULL,
	"txn_date" date NOT NULL,
	"narration" text NOT NULL,
	"ref_no" text,
	"amount" integer NOT NULL,
	"method" "pay_method",
	"payer_vpa" text,
	"payer_name" text,
	"utr" text,
	"status" "txn_status" NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"reasons" jsonb NOT NULL,
	"suggestions" jsonb NOT NULL,
	"flat_id" text,
	"payment_id" integer,
	"resolved_by" integer,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_txns_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bills_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"flat_id" text NOT NULL,
	"period" text NOT NULL,
	"bill_date" date NOT NULL,
	"due_date" date NOT NULL,
	"area_sqft" integer NOT NULL,
	"rate_paise" integer NOT NULL,
	"maintenance" integer NOT NULL,
	"interest" integer DEFAULT 0 NOT NULL,
	"arrears" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bookings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"amenity_id" integer NOT NULL,
	"flat_id" text NOT NULL,
	"booked_by" integer NOT NULL,
	"date" date NOT NULL,
	"start_minute" integer NOT NULL,
	"status" "booking_status" DEFAULT 'CONFIRMED' NOT NULL,
	"fee_paise" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "complaint_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "complaint_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"complaint_id" integer NOT NULL,
	"actor_id" integer,
	"kind" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "complaints_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"flat_id" text NOT NULL,
	"raised_by" integer NOT NULL,
	"description" text NOT NULL,
	"title" text,
	"photo_id" integer,
	"category" text NOT NULL,
	"urgency" "urgency" NOT NULL,
	"classified_by" "classified_by" NOT NULL,
	"ai_confidence" integer,
	"needs_triage" boolean DEFAULT false NOT NULL,
	"safety" boolean DEFAULT false NOT NULL,
	"status" "complaint_status" DEFAULT 'OPEN' NOT NULL,
	"assigned_to" integer,
	"parent_id" integer,
	"response_due_at" timestamp with time zone NOT NULL,
	"first_response_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"rating" integer,
	"rating_comment" text,
	"reopen_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flat_members" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "flat_members_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"flat_id" text NOT NULL,
	"user_id" integer NOT NULL,
	"relation" "relation" NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flats" (
	"id" text PRIMARY KEY NOT NULL,
	"tower" integer NOT NULL,
	"floor" integer NOT NULL,
	"unit" integer NOT NULL,
	"area_sqft" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gateway_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"flat_id" text NOT NULL,
	"amount" integer NOT NULL,
	"status" "order_status" DEFAULT 'CREATED' NOT NULL,
	"created_by" integer NOT NULL,
	"payment_id" integer,
	"settlement_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "guest_codes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "guest_codes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"flat_id" text NOT NULL,
	"created_by" integer NOT NULL,
	"code_hash" text NOT NULL,
	"guest_name" text NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ledger_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"flat_id" text NOT NULL,
	"kind" "ledger_kind" NOT NULL,
	"amount" integer NOT NULL,
	"date" date NOT NULL,
	"due_date" date,
	"bill_id" integer,
	"payment_id" integer,
	"memo" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"body" text NOT NULL,
	"tower" integer,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"channel" text DEFAULT 'APP' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_challenges" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "otp_challenges_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payer_accounts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payer_accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vpa" text NOT NULL,
	"flat_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"flat_id" text NOT NULL,
	"amount" integer NOT NULL,
	"method" "pay_method" NOT NULL,
	"source" "pay_source" NOT NULL,
	"paid_on" date NOT NULL,
	"reference" text,
	"payer_vpa" text,
	"payer_name" text,
	"gateway_payment_id" text,
	"bank_txn_id" integer,
	"created_by" integer,
	"reversed_at" timestamp with time zone,
	"reversal_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_gatewayPaymentId_unique" UNIQUE("gateway_payment_id")
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "photos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"mime" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"role" "role" DEFAULT 'RESIDENT' NOT NULL,
	"team" text,
	"lang" text DEFAULT 'en' NOT NULL,
	"privacy_accepted_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "visitors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "visitors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"client_id" text NOT NULL,
	"flat_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"purpose" text NOT NULL,
	"gate" integer NOT NULL,
	"guard_id" integer NOT NULL,
	"photo_id" integer,
	"status" "visitor_status" DEFAULT 'PENDING' NOT NULL,
	"approval_mode" "approval_mode",
	"decided_by" integer,
	"guest_code_id" integer,
	"arrived_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"entered_at" timestamp with time zone,
	"left_at" timestamp with time zone,
	"photo_purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visitors_clientId_unique" UNIQUE("client_id")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_imports" ADD CONSTRAINT "bank_imports_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_txns" ADD CONSTRAINT "bank_txns_import_id_bank_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."bank_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_txns" ADD CONSTRAINT "bank_txns_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_txns" ADD CONSTRAINT "bank_txns_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_txns" ADD CONSTRAINT "bank_txns_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_amenity_id_amenities_id_fk" FOREIGN KEY ("amenity_id") REFERENCES "public"."amenities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_booked_by_users_id_fk" FOREIGN KEY ("booked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_events" ADD CONSTRAINT "complaint_events_complaint_id_complaints_id_fk" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_events" ADD CONSTRAINT "complaint_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_raised_by_users_id_fk" FOREIGN KEY ("raised_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_parent_id_complaints_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."complaints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flat_members" ADD CONSTRAINT "flat_members_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flat_members" ADD CONSTRAINT "flat_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_orders" ADD CONSTRAINT "gateway_orders_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_orders" ADD CONSTRAINT "gateway_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_orders" ADD CONSTRAINT "gateway_orders_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_codes" ADD CONSTRAINT "guest_codes_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_codes" ADD CONSTRAINT "guest_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payer_accounts" ADD CONSTRAINT "payer_accounts_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_guard_id_users_id_fk" FOREIGN KEY ("guard_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_guest_code_id_guest_codes_id_fk" FOREIGN KEY ("guest_code_id") REFERENCES "public"."guest_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_txns_status_idx" ON "bank_txns" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "bills_flat_period_uq" ON "bills" USING btree ("flat_id","period");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_slot_uq" ON "bookings" USING btree ("amenity_id","date","start_minute") WHERE status = 'CONFIRMED';--> statement-breakpoint
CREATE INDEX "bookings_flat_idx" ON "bookings" USING btree ("flat_id");--> statement-breakpoint
CREATE INDEX "complaint_events_complaint_idx" ON "complaint_events" USING btree ("complaint_id");--> statement-breakpoint
CREATE INDEX "complaints_flat_idx" ON "complaints" USING btree ("flat_id");--> statement-breakpoint
CREATE INDEX "complaints_status_idx" ON "complaints" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "flat_members_uq" ON "flat_members" USING btree ("flat_id","user_id");--> statement-breakpoint
CREATE INDEX "flat_members_user_idx" ON "flat_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "guest_codes_hash_idx" ON "guest_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "ledger_flat_idx" ON "ledger" USING btree ("flat_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "otp_phone_idx" ON "otp_challenges" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "payer_accounts_uq" ON "payer_accounts" USING btree ("vpa","flat_id");--> statement-breakpoint
CREATE INDEX "payments_flat_idx" ON "payments" USING btree ("flat_id");--> statement-breakpoint
CREATE INDEX "visitors_flat_idx" ON "visitors" USING btree ("flat_id");--> statement-breakpoint
CREATE INDEX "visitors_arrived_idx" ON "visitors" USING btree ("arrived_at");