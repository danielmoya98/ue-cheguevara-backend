import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client'; // Ajusta según tu salida
import * as bcrypt from 'bcrypt';

// 1. Configuramos el adaptador igual que en tu PrismaService para que TS sea feliz
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// 2. Ahora pasamos el objeto de configuración que el constructor espera
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Iniciando siembra de Roles y Usuarios...');

  // Roles base
  const roles = [
    { name: 'SUPER_ADMIN', description: 'Acceso total al sistema' },
    {
      name: 'DIRECTOR',
      description: 'Gestión administrativa de la unidad educativa',
    },
    { name: 'DOCENTE', description: 'Gestión académica y pedagógica' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  const roleSuperAdmin = await prisma.role.findUnique({
    where: { name: 'SUPER_ADMIN' },
  });
  const roleDirector = await prisma.role.findUnique({
    where: { name: 'DIRECTOR' },
  });
  const roleDocente = await prisma.role.findUnique({
    where: { name: 'DOCENTE' },
  });

  if (!roleSuperAdmin || !roleDirector || !roleDocente) {
    throw new Error('No se pudieron encontrar los roles creados.');
  }

  const hashedPassword = await bcrypt.hash('admin123', 10);

  const users = [
    {
      email: 'superadmin@uecg.edu.bo',
      fullName: 'Daniel Moya Superadmin',
      roleId: roleSuperAdmin.id,
    },
    {
      email: 'director@uecg.edu.bo',
      fullName: 'Director Ernesto Che Guevara',
      roleId: roleDirector.id,
    },
    {
      email: 'docente@uecg.edu.bo',
      fullName: 'Profesor Joaquin Bergman',
      roleId: roleDocente.id,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        fullName: user.fullName,
        password: hashedPassword,
        roleId: user.roleId,
        status: 'ACTIVE',
        requiresPasswordChange: false,
      },
    });
  }

  console.log('✅ Semilla plantada con éxito.');
}

main()
  .catch((e) => {
    console.error('❌ Error en el proceso de seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
