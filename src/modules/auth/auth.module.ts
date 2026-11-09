import { forwardRef, Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller.js';
import { AuthService } from './services/auth.service.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [
    forwardRef(() => UsersModule), // aporta UsersService
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
