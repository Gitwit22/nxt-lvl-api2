import { Injectable, UnauthorizedException } from '@nestjs/common';
import { compare } from 'bcrypt';
import { sign } from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(dto: LoginDto) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const isValidPassword = await compare(dto.password, admin.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const token = sign(
      {
        sub: admin.id,
        role: admin.role,
        organizationId: admin.organizationId,
      },
      process.env.JWT_SECRET as string,
      {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '1d') as unknown as number,
      },
    );

    return {
      accessToken: token,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        organizationId: admin.organizationId,
      },
    };
  }
}
