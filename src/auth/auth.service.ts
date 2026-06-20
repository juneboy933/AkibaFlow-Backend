import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateRegisterDto } from './dto/register.dto';
import { CreateLoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import argon2 from 'argon2';
import { LoggerService } from 'src/logger/logger.service';

interface User {
  sub: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly logger: LoggerService,
  ) {}

  async registerUser(dto: CreateRegisterDto) {
    // Check if the user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      select: { id: true },
    });

    // If the user exists, return an error message
    if (existingUser)
      throw new ConflictException('User with this phone number already exists');

    // Hash password
    const hashedPassword = await argon2.hash(dto.password);

    // If not, create a new user in the database
    const newUser = await this.prisma.user.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        password: hashedPassword,
      },
    });

    this.logger.log(
      `User ${newUser.id} registered successfully`,
      AuthService.name,
    );
    // Return a success message and the created user data
    return {
      message: 'User registered successfully',
      data: {
        id: newUser.id,
        role: newUser.role,
      },
    };
  }

  async loginUser(dto: CreateLoginDto) {
    // Find the user by phone number
    const existingUser = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      select: {
        id: true,
        role: true,
        password: true,
      },
    });

    // If the user does not exist, return an error message
    if (!existingUser)
      throw new UnauthorizedException('Invalid phone or password');

    // If the user exists, verify the password
    const isMatch = await argon2.verify(existingUser.password, dto.password);

    // If the password is incorrect, return an error message
    if (!isMatch) throw new UnauthorizedException('Invalid phone or password');

    // If the password is correct then provide the user with a token and return a success message along with the user data
    // Provide access token
    const token = await this.generateToken(existingUser);

    this.logger.log(
      `User ${existingUser.id} logged in successfully.`,
      AuthService.name,
    );

    return {
      message: 'User logged in successfully',
      token,
      data: {
        id: existingUser.id,
        role: existingUser.role,
      },
    };
  }

  async generateToken(user: { id: string; role: UserRole }) {
    const payload = {
      sub: user.id,
      role: user.role,
    };
    const token = await this.jwtService.signAsync(payload);
    return token;
  }

  async verifyToken(token: string) {
    try {
      const decoded: User = await this.jwtService.verifyAsync(token);
      return decoded;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
