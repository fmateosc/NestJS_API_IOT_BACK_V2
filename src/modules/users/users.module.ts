import { Module } from '@nestjs/common';
import { UsersService } from './services/users.service.js';
import { UsersController } from './controllers/users.controller.js';

@Module({
  providers: [UsersService],
  controllers: [UsersController]
})
export class UsersModule {}
