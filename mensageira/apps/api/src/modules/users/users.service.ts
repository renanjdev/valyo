import type { PrismaClient } from '@mensageira/db';
import { hashPassword } from '../../lib/hash.js';
import { AppError } from '../../lib/errors.js';
import { generateId } from '@mensageira/shared';

export class UsersService {
  constructor(private db: PrismaClient) {}

  async list(accountId: string) {
    return this.db.user.findMany({
      where: { accountId },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async me(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, accountId: true },
    });
    if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');
    return user;
  }

  async invite(accountId: string, name: string, email: string, role: string) {
    const existing = await this.db.user.findFirst({ where: { email } });
    if (existing) throw new AppError(409, 'Email already in use', 'EMAIL_EXISTS');

    const tempPassword = generateId().slice(0, 12);
    const passwordHash = await hashPassword(tempPassword);

    const user = await this.db.user.create({
      data: { accountId, name, email, passwordHash, role },
      select: { id: true, name: true, email: true, role: true },
    });

    return { ...user, tempPassword };
  }

  async update(accountId: string, userId: string, data: { role?: string; isActive?: boolean }) {
    const user = await this.db.user.findFirst({ where: { id: userId, accountId } });
    if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');
    if (user.role === 'owner' && data.role && data.role !== 'owner') {
      throw new AppError(400, 'Cannot change owner role', 'CANNOT_CHANGE_OWNER');
    }

    return this.db.user.update({
      where: { id: userId }, data,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
  }
}
