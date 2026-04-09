import { DbConnection } from "./chat-client/src/module_bindings/index";
const conn = DbConnection.builder().withUri("ws://localhost").withDatabaseName("test").build();
conn.db.message.onInsert(() => {});
conn.db.user.iter();
