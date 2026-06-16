import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateRegisterDto } from './dto/register.dto';
import { CreateLoginDto } from './dto/login.dto';
import { JwtGuard } from './guards/jwt/jwt.guard';
import type { AuthenticatedRequest } from 'src/common/interfaces/authenticated-user.interface';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: CreateRegisterDto) {
    return this.auth.registerUser(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  login(@Body() dto: CreateLoginDto) {
    return this.auth.loginUser(dto);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  getMe(@Req() req: AuthenticatedRequest) {
    return req.user;
  }
}
