import { pgTable, serial, text, varchar, timestamp, pgEnum, index } from "drizzle-orm/pg-core";

// Re-export the enum for consistency
export const userRoleEnum = pgEnum('user_role', ['customer', 'admin']);

// Users table - consistent with main schema.ts
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name'),
  phone: varchar('phone', { length: 256 }),
  role: userRoleEnum('role').default('customer').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_users_email').on(table.email),
  index('idx_users_role').on(table.role),
]);

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
