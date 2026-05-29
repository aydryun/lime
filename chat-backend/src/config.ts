import dotenv from "dotenv";

// Charge le .env racine (partagé avec les migrations et le seed).
dotenv.config({ path: "../.env" });

const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error(
    "JWT_SECRET manquant : définissez-le dans l'environnement avant de démarrer.",
  );
}

/** Secret de signature des JWT (obligatoire, aucun fallback). */
export const JWT_SECRET: string = secret;
