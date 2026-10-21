import { sql } from "drizzle-orm";
import { db } from "./db";

/**
 * Profile badge columns and post likes.
 *  users.profile_role      farmer | buyer | company | expert   (picked on the role screen)
 *  users.farming_category  crops | vegetables | fruits | dairy | poultry | fish | livestock | organic | mixed
 * profile_role is kept apart from users.role, which the server uses for its own access rules.
 * post_likes gets one row per person per post.
 */
export const PROFILE_ROLES = ["farmer", "buyer", "company", "expert"];
export const FARMING_CATEGORIES = ["crops", "vegetables", "fruits", "dairy", "poultry", "fish", "livestock", "organic", "mixed"];

let ready: Promise<void> | null = null;

export function ensureProfileColumns(): Promise<void> {
  if (!db) return Promise.resolve();
  if (!ready) {
    ready = (async () => {
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_role text`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS farming_category text`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS post_likes (
        post_id varchar NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE)`);
      // One like per person per post.
      await db.execute(sql`DELETE FROM post_likes a USING post_likes b
        WHERE a.ctid < b.ctid AND a.post_id = b.post_id AND a.user_id = b.user_id`);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS post_likes_post_user ON post_likes (post_id, user_id)`);
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}
