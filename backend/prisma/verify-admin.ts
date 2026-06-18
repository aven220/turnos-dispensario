import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!user) {
    console.log('ERROR: usuario admin no existe en esta base de datos.');
    console.log('Ejecute: npm run db:seed');
    process.exit(1);
  }

  const ok = await bcrypt.compare('CencoicAdmin2026', user.passwordHash);
  console.log('Usuario admin:', user.username);
  console.log('Estado:', user.status);
  console.log('Rol:', user.role);
  console.log('Contraseña CencoicAdmin2026:', ok ? 'OK' : 'NO COINCIDE');
  console.log('DATABASE_URL host:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));

  if (!ok) {
    console.log('Solucion: npm run db:seed');
    process.exit(1);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
