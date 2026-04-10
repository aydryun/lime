import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import pool, { createUser } from "./src/database.js";

dotenv.config({ path: "../.env" });

async function seed() {
  const users = [
    {
      firstname: "Julie",
      lastname: "Dupont",
      email: "julie@lime.app",
      username: "julie",
      password: "password123",
    },
    {
      firstname: "Lucas",
      lastname: "Martin",
      email: "lucas@lime.app",
      username: "lucas",
      password: "password123",
    },
    {
      firstname: "Admin",
      lastname: "Lime",
      email: "admin@lime.app",
      username: "admin",
      password: "admin123",
    },
  ];

  for (const u of users) {
    try {
      const hashed = await bcrypt.hash(u.password, 10);
      const created = await createUser(
        u.firstname,
        u.lastname,
        u.email,
        u.username,
        hashed,
      );
      console.log(
        `✓ Utilisateur créé : ${created.username} (${created.email})`,
      );
    } catch (error: unknown) {
      const pgError = error as { code?: string };
      if (pgError.code === "23505") {
        console.log(`⏭ ${u.username} existe déjà, ignoré`);
      } else {
        throw error;
      }
    }
  }

  console.log("\n✓ Seed terminé");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
