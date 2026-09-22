// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const learningWorkspaces = sqliteTable('learning_workspaces', {
  userId: text('user_id').primaryKey(), state: text('state').notNull(),
  revision: integer('revision').notNull().default(0), updatedAt: integer('updated_at').notNull(),
});
