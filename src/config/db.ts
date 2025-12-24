import { Pool } from "pg";
import config from ".";

export const pool = new Pool({
  connectionString: `${config.connectionString}`,
});

export const initDB = async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ===============================
       EXTENSIONS
    =============================== */
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    /* ===============================
       ENUM TYPES
    =============================== */
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE company_status AS ENUM ('ACTIVE', 'INACTIVE');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'STAFF', 'CUSTOMER');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE payment_status AS ENUM ('INITIATED', 'PAID', 'FAILED', 'REFUNDED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE payment_method AS ENUM ('CARD', 'CASH', 'BANK');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE invoice_status AS ENUM ('UNPAID', 'PAID', 'PARTIAL');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    /* ===============================
       COMPANIES (TENANTS)
    =============================== */
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        status company_status NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      );
    `);

    /* ===============================
       USERS
    =============================== */
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role user_role NOT NULL DEFAULT 'CUSTOMER',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      );
    `);

    /* ===============================
       REFRESH TOKENS
    =============================== */
    // await client.query(`
    //   CREATE TABLE IF NOT EXISTS refresh_tokens (
    //     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    //     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    //     token TEXT NOT NULL,
    //     expires_at TIMESTAMP NOT NULL,
    //     is_revoked BOOLEAN DEFAULT false,
    //     created_at TIMESTAMP DEFAULT NOW()
    //   );
    // `);

    /* ===============================
       BOOKINGS
    =============================== */
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        created_by UUID NOT NULL REFERENCES users(id),
        customer_name VARCHAR(150) NOT NULL,
        service_name VARCHAR(150) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        status booking_status NOT NULL DEFAULT 'PENDING',
        total_price NUMERIC(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP,
        CONSTRAINT booking_time_check CHECK (end_time > start_time)
      );
    `);

    /* ===============================
       PAYMENTS
    =============================== */
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        amount NUMERIC(10,2) NOT NULL,
        payment_method payment_method NOT NULL,
        status payment_status NOT NULL DEFAULT 'INITIATED',
        transaction_reference VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    /* ===============================
       INVOICES
    =============================== */
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        invoice_number VARCHAR(100) UNIQUE NOT NULL,
        total_amount NUMERIC(10,2) NOT NULL,
        status invoice_status NOT NULL DEFAULT 'UNPAID',
        issued_at TIMESTAMP DEFAULT NOW()
      );
    `);

    /* ===============================
       AUDIT LOGS
    =============================== */
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        entity VARCHAR(100) NOT NULL,
        entity_id UUID,
        old_value JSONB,
        new_value JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    /* ===============================
       INDEXES (PERFORMANCE)
    =============================== */
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_company_id ON bookings(company_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
      CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);
    `);

    await client.query("COMMIT");
    console.log("✅ Database initialized successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Database initialization failed", error);
    throw error;
  } finally {
    client.release();
  }
};

export default initDB;
