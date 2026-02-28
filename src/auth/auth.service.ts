// auth.service.ts
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // ================= SIGNUP =================
  async signup(dto: SignupDto) {
    const existingUser = await this.userService.findByEmail(dto.email);
    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.userService.createUser({
      email: dto.email,
      password: hashedPassword,
    });
    const tokens = await this.generateTokens(user._id.toString());
    await this.storeRefreshToken(user._id.toString(), tokens.refresh_token);
    return tokens;
  }

  // ================= LOGIN =================
  async login(dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const tokens = await this.generateTokens(user._id.toString());
    await this.storeRefreshToken(user._id.toString(), tokens.refresh_token);
    return tokens;
  }

  // ================= REFRESH =================
  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.userService.findById(userId);
    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Access denied');
    }
    const isMatch = await bcrypt.compare(
      refreshToken,
      user.refreshToken,
    );
    if (!isMatch) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const tokens = await this.generateTokens(userId);
    await this.storeRefreshToken(userId, tokens.refresh_token);
    return tokens;
  }

  // ================= LOGOUT =================
  async logout(userId: string) {
    await this.userService.updateRefreshToken(userId, null);
    return { message: 'Logged out successfully' };
  }

  // ================= PRIVATE HELPERS =================

  private async generateTokens(userId: string) {
    const payload = { sub: userId };
    const access_token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '15m',
    });
    const refresh_token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    return { access_token, refresh_token };
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const hashed = await bcrypt.hash(refreshToken, 10);
    await this.userService.updateRefreshToken(userId, hashed);
  }
}