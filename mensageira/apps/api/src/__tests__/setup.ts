import { beforeAll, afterAll, afterEach } from 'vitest';
import { PrismaClient } from '@mensageira/db';

// IMPORTANT: Tests use a separate database to avoid destroying dev data
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://mensageira:mensageira@localhost:5432/mensageira_test';

const prisma = new PrismaClient({
  datasourceUrl: TEST_DB_URL,
});

beforeAll(async () => {
  await prisma.$connect();
});

afterEach(async () => {
  // Clean tables in correct order (foreign key constraints)
  await prisma.refreshToken.deleteMany();
  await prisma.leadEvent.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.leadSequence.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.sequence.deleteMany();
  await prisma.whatsAppSession.deleteMany();
  await prisma.user.deleteMany();
  await prisma.account.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
