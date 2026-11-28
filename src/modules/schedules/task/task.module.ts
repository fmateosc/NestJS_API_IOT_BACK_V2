import { forwardRef, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../../users/users.module.js';
import { MqttProviderModule } from '../../providers/mqtt-provider.module.js';
import { TaskService } from './services/task.service.js';
import { TaskEntity } from './entities/task.entity.js';
import { TaskController } from './controllers/task.controller.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([TaskEntity]),
    forwardRef(() => UsersModule),
    forwardRef(() => MqttProviderModule),       // ← aporta MqttService
    //forwardRef(() => WebsocketsProviderModule), // ← aporta WebsocketsGateway
  ],
  providers: [TaskService],
  controllers: [TaskController],
  exports: [TaskService],
})
export class TaskModule {}

