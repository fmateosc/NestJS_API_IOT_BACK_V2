import { forwardRef, Module } from '@nestjs/common';
import { MessagesService } from './services/messages.service.js';
import { MessagesController } from './controllers/messages.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevicesModule } from '../devices/devices.module.js';
import { MessageEntity } from './entities/message.entity.js';

@Module({
  imports: [
    forwardRef(() => DevicesModule),
    TypeOrmModule.forFeature([MessageEntity]), // ← aporta MessageEntityRepository
  ],
  providers: [MessagesService],
  controllers: [MessagesController],
  exports: [MessagesService],
})
export class MessagesModule {}
