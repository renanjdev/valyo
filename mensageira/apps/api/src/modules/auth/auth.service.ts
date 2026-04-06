import type { PrismaClient } from '@mensageira/db';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { hashPassword, verifyPassword } from '../../lib/hash.js';
import { AppError } from '../../lib/errors.js';
import type { RegisterInput, LoginInput } from './auth.schemas.js';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_DAYS = 7;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

export class AuthService {
  constructor(
    private db: PrismaClient,
    private jwt: FastifyInstance['jwt'],
  ) {}

  async register(input: RegisterInput) {
    // Email is globally unique (simplifies login — no need for account slug)
    const existingUser = await this.db.user.findFirst({
      where: { email: input.email },
    });
    if (existingUser) {
      throw new AppError(409, 'Email already registered', 'EMAIL_EXISTS');
    }

    const passwordHash = await hashPassword(input.password);
    const slug = slugify(input.accountName) + '-' + randomUUID().slice(0, 6);

    const account = await this.db.account.create({
      data: {
        name: input.accountName,
        slug,
        users: {
          create: {
            name: input.name,
            email: input.email,
            passwordHash,
            role: 'owner',
          },
        },
      },
      include: { users: true },
    });

    const user = account.users[0];
    const tokens = await this.generateTokens(user.id, account.id, user.role);

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      account: { id: account.id, name: account.name, slug: account.slug },
      ...tokens,
    };
  }

  async login(input: LoginInput) {
    const user = await this.db.user.findFirst({
      where: { email: input.email, isActive: true },
      include: { account: true },
    });
    if (!user) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const validPassword = await verifyPassword(input.password, user.passwordHash);
    if (!validPassword) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const tokens = await this.generateTokens(user.id, user.accountId, user.role);

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      account: { id: user.account.id, name: user.account.name, slug: user.account.slug },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const stored = await this.db.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { include: { account: true } } },
    });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) {
        await this.db.refreshToken.delete({ where: { id: stored.id } });
      }
      throw new AppError(401, 'Invalid or expired refresh token', 'INVALID_REFRESH');
    }

    // Rotate refresh token
    await this.db.refreshToken.delete({ where: { id: stored.id } });

    const { user } = stored;
    return this.generateTokens(user.id, user.accountId, user.role);
  }

  async logout(refreshToken: string) {
    await this.db.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  private async generateTokens(userId: string, accountId: string, role: string) {
    const accessToken = this.jwt.sign(
      { userId, accountId, role },
      { expiresIn: ACCESS_TOKEN_EXPIRY },
    );

    const refreshToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

    await this.db.refreshToken.create({
      data: { userId, token: refreshToken, expiresAt },
    });

    return { accessToken, refreshToken };
  }
}
