import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('CencoicAdmin2026', 10);
  const filterPassword = await bcrypt.hash('CencoicFiltro2026', 10);
  const windowPassword = await bcrypt.hash('CencoicVent2026', 10);

  const areaPassword = await bcrypt.hash('CencoicJefe2026', 10);
  const auditorPassword = await bcrypt.hash('CencoicAudit2026', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: adminPassword, status: UserStatus.ACTIVE },
    create: {
      username: 'admin',
      passwordHash: adminPassword,
      fullName: 'Administrador',
      role: UserRole.ADMIN,
    },
  });

  const filter = await prisma.user.upsert({
    where: { username: 'filtro' },
    update: { passwordHash: filterPassword, status: UserStatus.ACTIVE },
    create: {
      username: 'filtro',
      passwordHash: filterPassword,
      fullName: 'Operador Filtro',
      role: UserRole.FILTER,
    },
  });

  const maria = await prisma.user.upsert({
    where: { username: 'maria' },
    update: { passwordHash: windowPassword, status: UserStatus.ACTIVE },
    create: {
      username: 'maria',
      passwordHash: windowPassword,
      fullName: 'María Gómez',
      role: UserRole.WINDOW,
    },
  });

  const juan = await prisma.user.upsert({
    where: { username: 'juan' },
    update: { passwordHash: windowPassword, status: UserStatus.ACTIVE },
    create: {
      username: 'juan',
      passwordHash: windowPassword,
      fullName: 'Juan Pérez',
      role: UserRole.WINDOW,
    },
  });

  const carlos = await prisma.user.upsert({
    where: { username: 'carlos' },
    update: { passwordHash: windowPassword, status: UserStatus.ACTIVE },
    create: {
      username: 'carlos',
      passwordHash: windowPassword,
      fullName: 'Carlos Ruiz',
      role: UserRole.WINDOW,
    },
  });

  const jefe = await prisma.user.upsert({
    where: { username: 'jefe' },
    update: { passwordHash: areaPassword, status: UserStatus.ACTIVE },
    create: {
      username: 'jefe',
      passwordHash: areaPassword,
      fullName: 'Jefe de Área',
      role: UserRole.AREA_MANAGER,
    },
  });

  const auditor = await prisma.user.upsert({
    where: { username: 'auditor' },
    update: { passwordHash: auditorPassword, status: UserStatus.ACTIVE },
    create: {
      username: 'auditor',
      passwordHash: auditorPassword,
      fullName: 'Jefe Auditoría',
      role: UserRole.AUDITOR,
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
    where: { userId: maria.id },
    update: { windowId: windows[0].id },
    create: { windowId: windows[0].id, userId: maria.id },
  });
  await prisma.windowOperator.upsert({
    where: { userId: juan.id },
    update: { windowId: windows[1].id },
    create: { windowId: windows[1].id, userId: juan.id },
  });
  await prisma.windowOperator.upsert({
    where: { userId: carlos.id },
    update: { windowId: windows[2].id },
    create: { windowId: windows[2].id, userId: carlos.id },
  });

  async function upsertWindowPriority(
    windowId: string,
    priorityId: string,
    sortOrder: number
  ) {
    await prisma.windowPriority.upsert({
      where: { windowId_priorityId: { windowId, priorityId } },
      update: { sortOrder },
      create: { windowId, priorityId, sortOrder },
    });
  }

  // Ventanilla 1: General primero, luego Pendientes
  for (const [priority, order] of [
    [gen, 1],
    [pen, 2],
    [pri, 3],
  ] as const) {
    await upsertWindowPriority(windows[0].id, priority.id, order);
  }

  // Ventanilla 2: Pendientes primero, luego General
  for (const [priority, order] of [
    [pen, 1],
    [gen, 2],
    [pri, 3],
  ] as const) {
    await upsertWindowPriority(windows[1].id, priority.id, order);
  }

  // Ventanilla 3: General primero, luego Prioritario
  for (const [priority, order] of [
    [gen, 1],
    [pri, 2],
  ] as const) {
    await upsertWindowPriority(windows[2].id, priority.id, order);
  }

  await prisma.tickerMessage.createMany({
    data: [
      { message: 'Bienvenido al dispensario.', sortOrder: 1 },
      { message: 'Recuerde presentar su documento de identidad.', sortOrder: 2 },
      { message: 'Horario de atención de 7 AM a 5 PM.', sortOrder: 3 },
    ],
    skipDuplicates: true,
  });

  console.log('Seed completado');
  console.log({
    admin: admin.username,
    filter: filter.username,
    jefe: jefe.username,
    auditor: auditor.username,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
