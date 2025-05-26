const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // or use individual credentials
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

/**
 * Save or update a bot subscriber (upsert by user_id)
 */
async function saveSubscriber(userId, reference, metadata = {}) {
  const { name, team } = metadata;

  await pool.query(
    `
    INSERT INTO bot_subscribers (user_id, conversation_reference, name, team_id, created_at, updated_at)
    VALUES ($1, $2, $3, $4, now(), now())
    ON CONFLICT (user_id)
    DO UPDATE SET
      conversation_reference = EXCLUDED.conversation_reference,
      name = EXCLUDED.name,
      team_id = EXCLUDED.team_id,
      updated_at = now()
    `,
    [userId, reference, name, team]
  );
}

/**
 * Get all bot subscribers
 */
async function getSubscribers() {
  const res = await pool.query(
    `SELECT user_id, conversation_reference FROM bot_subscribers`
  );

  return res.rows.map((row) => ({
    userId: row.user_id,
    reference: row.conversation_reference,
  }));
}

module.exports = {
  pool,
  saveSubscriber,
  getSubscribers,
};
