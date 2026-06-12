import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('CencoicAdmin2026', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
      fullName: 'Administrador',
      role: UserRole.ADMIN,
    },
  });

  const filter = await prisma.user.upsert({
    where: { username: 'filtro' },
    update: {},
    create: {
      username: 'filtro',
      passwordHash: await bcrypt.hash('CencoicFiltro2026', 10),
      fullName: 'Operador Filtro',
      role: UserRole.FILTER,
    },
  });

  const maria = await prisma.user.upsert({
    where: { username: 'maria' },
    update: {},
    create: {
      username: 'maria',
      passwordHash: await bcrypt.hash('CencoicVent2026', 10),
      fullName: 'María Gómez',
      role: UserRole.WINDOW,
    },
  });

  const juan = await prisma.user.upsert({
    where: { username: 'juan' },
    update: {},
    create: {
      username: 'juan',
      passwordHash: await bcrypt.hash('CencoicVent2026', 10),
      fullName: 'Juan Pérez',
      role: UserRole.WINDOW,
    },
  });

  const carlos = await prisma.user.upsert({
    where: { username: 'carlos' },
    update: {},
    create: {
      username: 'carlos',
      passwordHash: await bcrypt.hash('CencoicVent2026', 10),
      fullName: 'Carlos Ruiz',
      role: UserRole.WINDOW,
    },
  });

  const priorities = await Promise.all([
    prisma.priority.upsert({
      where: { code: 'PRI' },
      update: {},
      create: { name: 'Prioritario', code: 'PRI', sortOrder: 1 },
    }),
    prisma.priority.upsert({
      where: { code: 'PEN' },
      update: {},
      create: { name: 'Pendiente', code: 'PEN', sortOrder: 2 },
    }),
    prisma.priority.upsert({
      where: { code: 'GEN' },
      update: {},
      create: { name: 'General', code: 'GEN', sortOrder: 3 },
    }),
    prisma.priority.upsert({
      where: { code: 'AM' },
      update: {},
      create: { name: 'Adulto Mayor', code: 'AM', sortOrder: 2 },
    }),
    prisma.priority.upsert({
      where: { code: 'ENT' },
      update: {},
      create: { name: 'Entrega', code: 'ENT', sortOrder: 4 },
    }),
  ]);

  const [pri, pen, gen] = priorities;

  const windows = await Promise.all([
    prisma.window.upsert({
      where: { number: 1 },
      update: {},
      create: { name: 'Ventanilla 1', number: 1 },
    }),
    prisma.window.upsert({
      where: { number: 2 },
      update: {},
      create: { name: 'Ventanilla 2', number: 2 },
    }),
    prisma.window.upsert({
      where: { number: 3 },
      update: {},
      create: { name: 'Ventanilla 3', number: 3 },
    }),
  ]);

  await prisma.windowOperator.upsert({
    where: { windowId_userId: { windowId: windows[0].id, userId: maria.id } },
    update: {},
    create: { windowId: windows[0].id, userId: maria.id },
  });
  await prisma.windowOperator.upsert({
    where: { windowId_userId: { windowId: windows[1].id, userId: juan.id } },
    update: {},
    create: { windowId: windows[1].id, userId: juan.id },
  });
  await prisma.windowOperator.upsert({
    where: { windowId_userId: { windowId: windows[2].id, userId: carlos.id } },
    update: {},
    create: { windowId: windows[2].id, userId: carlos.id },
  });

  for (const w of windows) {
    for (const p of [pri, gen]) {
      await prisma.windowPriority.upsert({
        where: { windowId_priorityId: { windowId: w.id, priorityId: p.id } },
        update: {},
        create: { windowId: w.id, priorityId: p.id },
      });
    }
  }

  await prisma.windowPriority.upsert({
    where: { windowId_priorityId: { windowId: windows[0].id, priorityId: pen.id } },
    update: {},
    create: { windowId: windows[0].id, priorityId: pen.id },
  });

  await prisma.tickerMessage.createMany({
    data: [
      { message: 'Bienvenido al dispensario.', sortOrder: 1 },
      { message: 'Recuerde presentar su documento de identidad.', sortOrder: 2 },
      { message: 'Horario de atención de 7 AM a 5 PM.', sortOrder: 3 },
    ],
    skipDuplicates: true,
  });

  console.log('Seed completado');
  console.log({ admin: admin.username, filter: filter.username });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
