import { schema, table, t } from "spacetimedb/server";

// 1. LA TABLE (La base de données)
// On stocke juste l'ID du message, le pseudo de l'auteur et le texte.
const Message = table(
  { name: "message", public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    sender: t.string(),
    text: t.string(),
  }
);

// On exporte notre base de données
const spacetimedb = schema({ message: Message });
export default spacetimedb;


// 2. LE REDUCER (L'action pour modifier la base)
// C'est la seule fonction que notre client pourra appeler.
export const sendMessage = spacetimedb.reducer(
  { sender: t.string(), text: t.string() },
  (ctx, { sender, text }) => {
    // On insère le message. "0n" est obligatoire pour dire "génère l'ID tout seul".
    ctx.db.message.insert({ id: 0n, sender, text });
  }
);
