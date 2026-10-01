import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '../../config';
import { Customer } from '../customers/entities/customer.entity';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { JwtStrategy } from './jwt.strategy';
import { PasswordService } from './password.service';
import { ProfileController } from './profile.controller';
import { TokenCleanupTask } from './token-cleanup.task';
import { JWT_AUDIENCE, JWT_ISSUER, TokenService } from './token.service';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    TypeOrmModule.forFeature([RefreshToken, Customer]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const auth = config.get('auth', { infer: true });
        return {
          secret: auth.accessSecret,
          signOptions: {
            algorithm: 'HS256' as const,
            expiresIn: auth.accessTtlSeconds,
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
          },
        };
      },
    }),
  ],
  controllers: [AuthController, ProfileController],
  providers: [AuthService, PasswordService, TokenService, JwtStrategy, TokenCleanupTask],
  exports: [AuthService, PasswordService, TokenService],
})
export class AuthModule {}
