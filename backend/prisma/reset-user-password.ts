import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const username = process.argv[2]?.trim();
  const password = process.argv[3]?.trim();

  if (!username || !password) {
    console.log('Uso: npx tsx prisma/reset-user-password.ts <usuario> <nueva-contraseña>');
    console.log('Ejemplo: npx tsx prisma/reset-user-password.ts auditor CencoicAudit2026');
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
  });

  if (!user) {
    console.log(`ERROR: no existe el usuario "${username}"`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(password, 10),
      status: 'ACTIVE',
    },
  });

  const ok = await bcrypt.compare(password, (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash);
  console.log('Usuario:', user.username);
  console.log('Rol:', user.role);
  console.log('Estado: ACTIVE');
  console.log('Contraseña actualizada:', ok ? 'OK' : 'ERROR');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
