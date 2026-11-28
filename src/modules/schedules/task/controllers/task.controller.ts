// src/modules/schedules/task/controllers/task.controller.ts

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TaskService } from '../services/task.service.js';
import { AccessLevelGuard } from '../../../auth/guard/access-level.guard.js';
import { AuthGuard } from '../../../auth/guard/auth.guard.js';
import { Access } from '../../../auth/decorators/access.decorator.js';
import { GetUserInfo } from '../../../auth/decorators/user.info.decorator.js';
import * as authInterface from '../../../auth/intefaces/auth.interface.js';
import { TaskDto } from '../dtos/task.dto.js';
import { TaskEntity } from '../entities/task.entity.js';
import { UpdateTaskDto } from '../dtos/update.task.dto.js';
import { PaginationDto } from '../../../../common/dtos/pagination.dto.js';

@Controller('task')
@UseGuards(AuthGuard, AccessLevelGuard)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  /**
   * @description Endpoint POST. Crea un nuevo Scheduler/Cronjob asociándolo con un Broker Topic.
   * Se inyecta inmediatamente al Event-loop de NodeJS para su ejecución repetitiva según los días y cron-time estipulados.
   * @param {TaskDto} newTaskData - Payload JSON de la tarea.
   * @param {authInterface.IUserInfo} userInfo - Tenancy Auth (Solo Administradores).
   * @returns {Promise<{ status: boolean, message: string, task: TaskEntity }>}
   */
  @Access('ADMIN')
  @Post('create')
  async createNewTask(
    @Body() newTaskData: TaskDto,
    @GetUserInfo() userInfo: authInterface.IUserInfo,
  ): Promise<{ status: boolean; message: string; task: TaskEntity }> {
    return this.taskService.createNewTask(newTaskData, userInfo);
  }

  /**
   * @description Endpoint GET singular. Localiza la Tarea asegurando que pertenezca
   * exclusivamente al Usuario autenticado (Salvo permisos root, no implementados aquí).
   * @param {string} taskId - UUID params.
   * @param {IUserInfo} userInfo - Contexto activo.
   * @returns {Promise<TaskEntity>}
   */
  @Access('ADMIN')
  @Get('find/:taskId')
  public async findTaskById(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @GetUserInfo() userInfo: authInterface.IUserInfo,
  ): Promise<TaskEntity> {
    return await this.taskService.findTaskById(taskId, userInfo);
  }

  @Access('ADMIN')
  @Put('update/:taskId')
  public async updateTaskById(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() updateTaskData: UpdateTaskDto,
    @GetUserInfo() userInfo: authInterface.IUserInfo,
  ): Promise<{ status: boolean; message: string; task: TaskEntity }> {
    return await this.taskService.updateTaskById(
      taskId,
      updateTaskData,
      userInfo,
    );
  }

  @Access('ADMIN')
  @Get('all')
  public async findAllTasks(
    @Query() paginationDto: PaginationDto,
    @GetUserInfo() userInfo: authInterface.IUserInfo,
  ): Promise<{
    limit: number;
    offset: number;
    count: number;
    tasks: TaskEntity[];
  }> {
    return await this.taskService.findAllTasks(paginationDto, userInfo);
  }

  @Access('ADMIN')
  @Delete('delete/:taskId')
  public async deleteTaskById(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @GetUserInfo() userInfo: authInterface.IUserInfo,
  ): Promise<{ status: boolean; message: string; task: TaskEntity }> {
    return await this.taskService.deleteTaskById(taskId, userInfo);
  }
}
