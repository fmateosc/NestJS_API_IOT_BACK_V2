import { Module } from '@nestjs/common';
import { UsersService } from './services/users.service.js';
import { UsersController } from './controllers/users.controller.js';
import { UsersEntity } from './entities/users.entity.js';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    //forwardRef(() => AuthModule), // ← lo que falta
    TypeOrmModule.forFeature([UsersEntity]),
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
