/**
 * mongo-auth-state.js
 * ============================================================
 * Custom Baileys AuthState that persists WhatsApp sessions
 * to MongoDB Atlas instead of the local filesystem.
 *
 * This enables session survival across Render restarts/redeploys
 * without requiring a paid Persistent Disk.
 *
 * Usage:
 *   const { useMongoDBAuthState } = require('./mongo-auth-state');
 *   const collection = db.collection(`session-${role}`);
 *   const { state, saveCreds } = await useMongoDBAuthState(collection);
 * ============================================================
 */

const {
  proto,
  initAuthCreds,
  BufferJSON
} = require('@whiskeysockets/baileys');

/**
 * Creates a Baileys-compatible AuthState backed by a MongoDB collection.
 *
 * @param {import('mongodb').Collection} collection - One collection per WhatsApp role
 * @returns {Promise<{ state: import('@whiskeysockets/baileys').AuthenticationState, saveCreds: () => Promise<void> }>}
 */
async function useMongoDBAuthState(collection) {
  // ── Helpers ──────────────────────────────────────────────

  const readData = async (id) => {
    try {
      const doc = await collection.findOne({ _id: id });
      return doc?.value
        ? JSON.parse(doc.value, BufferJSON.reviver)
        : null;
    } catch (err) {
      console.error(`[MongoAuth] readData(${id}) error:`, err.message);
      return null;
    }
  };

  const writeData = async (id, data) => {
    try {
      await collection.updateOne(
        { _id: id },
        {
          $set: {
            value: JSON.stringify(data, BufferJSON.replacer),
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
    } catch (err) {
      console.error(`[MongoAuth] writeData(${id}) error:`, err.message);
    }
  };

  const removeData = async (id) => {
    try {
      await collection.deleteOne({ _id: id });
    } catch (err) {
      console.error(`[MongoAuth] removeData(${id}) error:`, err.message);
    }
  };

  // ── Credentials ───────────────────────────────────────────

  const creds = (await readData('creds')) || initAuthCreds();

  // ── Auth State ────────────────────────────────────────────

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          for (const id of ids) {
            let value = await readData(`${type}-${id}`);
            if (type === 'app-state-sync-key' && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            data[id] = value;
          }
          return data;
        },

        set: async (data) => {
          const writes = [];
          for (const [type, ids] of Object.entries(data)) {
            for (const [id, value] of Object.entries(ids || {})) {
              const docId = `${type}-${id}`;
              writes.push(
                value ? writeData(docId, value) : removeData(docId)
              );
            }
          }
          await Promise.all(writes);
        }
      }
    },

    saveCreds: () => writeData('creds', creds)
  };
}

module.exports = { useMongoDBAuthState };
