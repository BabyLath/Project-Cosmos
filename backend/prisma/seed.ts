import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/services/auth.service";
import { env } from "../src/config/env";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD || !env.SEED_ADMIN_NAME) {
    console.log("SEED_ADMIN_* env vars not set — skipping admin seed.");
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { email: env.SEED_ADMIN_EMAIL },
  });

  if (existing) {
    console.log(`Admin account ${env.SEED_ADMIN_EMAIL} already exists — skipping.`);
    return;
  }

  const passwordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);

  await prisma.user.create({
    data: {
      fullName: env.SEED_ADMIN_NAME,
      email: env.SEED_ADMIN_EMAIL,
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log(`Created admin account: ${env.SEED_ADMIN_EMAIL}`);
  console.log("Remember to change this password after first login.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());