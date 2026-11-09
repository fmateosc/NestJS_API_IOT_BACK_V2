import { forwardRef, Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller.js';
import { AuthService } from './services/auth.service.js';
import { UsersModule } from '../users/users.module.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AclEntity } from './entities/acl.entity.js';

@Module({
  imports: [
    forwardRef(() => UsersModule), // ← cambia el import directo por forwardRef
    TypeOrmModule.forFeature([AclEntity]),
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
