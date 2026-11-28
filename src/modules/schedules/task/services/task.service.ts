// src/modules/schedules/task/services/task.service.ts

import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { WrapperType } from '../../../../common/types/wrapper.type.js';
import { MqttService } from '../../../providers/mqtt/mqtt.service.js';
import { UsersService } from '../../../users/services/users.service.js';
import { TaskEntity } from '../entities/task.entity.js';
import moment from 'moment-timezone';
import { CronJob } from 'cron';
import { IUserInfo } from '../../../auth/intefaces/auth.interface.js';
import { TaskDto } from '../dtos/task.dto.js';
import { QueryBuilderUtil } from '../../../../util/query-builder.util.js';
import { UpdateTaskDto } from '../dtos/update.task.dto.js';
import { PaginationDto } from '../../../../common/dtos/pagination.dto.js';

@Injectable()
export class TaskService implements OnModuleInit {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @Inject(forwardRef(() => MqttService))
    private readonly mqttService: WrapperType<MqttService>,
    @Inject(forwardRef(() => UsersService))
    private readonly userService: WrapperType<UsersService>,
    //@Inject(forwardRef(() => WebsocketsGateway))
    //private readonly websocketsGateway: WrapperType<WebsocketsGateway>,
  ) {}

  /**
   * @description Hook de Ciclo de Vida de NestJS. Se ejecuta automáticamente cuando el Módulo está listo.
   * Carga y orquesta todas las tareas agendadas (Cron Jobs) guardadas en la Base de Datos para que
   * sobrevivan a reinicios del servidor.
   */
  async onModuleInit() {
    const tasks = await this.getAllTasks();
    tasks.forEach((task) => this.addScheduleTask(task));
  }

  /**
   * @description Fetcher nativo de Base de Datos para hidratación sin paginar de los Cron Jobs
   * durante el reinicio del Servidor Back-End.
   * @returns {Promise<TaskEntity[]>} Arreglo completo de tareas atadas a sus usuarios.
   */
  async getAllTasks(): Promise<TaskEntity[]> {
    const tasks = await this.taskRepository.find({
      relations: { createUserId: true },
    });

    return tasks;
  }

  /**
   * @description Constructor y Registrador en Memoria Dinámica de nuevas Instancias de CronJob.
   * Asocia la expresión string, el TimeZone, y el Callback que disparará el Payload por MQTT a los dispositivos.
   * @param {TaskEntity} task - Entidad base conteniendo Días, Hora Cruda y Payload.
   * @returns {Promise<void>} Operación síncrona/Silente en Node.js Event Loop.
   */
  async addScheduleTask(task: TaskEntity): Promise<void> {
    const cronExpression = this.getCronExpression(task.days, task.time);
    const formattedDate = moment()
      .tz(task.timeZone || 'UTC')
      .format('YYYY-MM-DD HH:mm:ss');
    const job = new CronJob(
      cronExpression,
      () => {
        this.logger.log(
          `Task ${task.id} executed at ${formattedDate} TimeZone: (${task.timeZone})`,
        );

        // funcion para publicar por MQTT
        this.publishMessageMQTT(task);
      },
      null,
      true,
      task.timeZone,
    );

    this.schedulerRegistry.addCronJob(`task_${task.id}`, job);

    job.start();

    this.logger.log(
      `Cron job "task_${task.id}" added with expression "${cronExpression}" : "${formattedDate}"`,
    );
  }

  /**
   * @description Parser utilitario interno. Transforma Arrays de días (Human Readable ['monday'])
   * y strings de horas limitadas ('12:30') al estándar Crontab nativo comprensible por la librería de UNIX.
   * @param {string[]} days - Lista de palabras reservadas (sunday, monday...) o 'all'.
   * @param {string} time - String format HH:MM (ej. 13:45).
   * @returns {string} String compilado (Ej. "45 13 * * 1,2,3")
   */
  private getCronExpression(days: string[], time: string): string {
    const daysMap: Record<string, string> = {
      monday: '1',
      tuesday: '2',
      wednesday: '3',
      thursday: '4',
      friday: '5',
      saturday: '6',
      sunday: '0',
      all: '*',
    };

    const dayExpression = days.includes('all')
      ? '*'
      : days.map((day) => daysMap[day.toLocaleLowerCase()]).join(',');

    const [hour, minute] = time.split(':'); // HH:MM

    return `${minute} ${hour} * * ${dayExpression}`;

    /*   * * * * * *
             | | | | | |
             | | | | | day of week
             | | | | months
             | | | day of month
             | | hours
             | minutes
             seconds (optional) */
  }

  /**
   * @description Puente de Salida de la Tarea Programada.
   * Cuando el Cron se gatilla, esta función inyecta un JSON Stringificado hacia EMQX
   * y, al mismo tiempo, lo Broadcastea en Tiempo Real al Frontend a través de WebSockets para feedback visual.
   * @param {TaskEntity} task - Tarea activa conteniendo los parámetros y tópicos.
   * @returns {Promise<void>}
   */
  public async publishMessageMQTT(task: TaskEntity): Promise<void> {
    const mqttClient = this.mqttService.getMqttClientById('emqx');
    if (mqttClient && task.status) {
      const topic = task.topic;
      const qos = 0;
      const payloadString = JSON.stringify(task.command);

      if (payloadString !== undefined) {
        // TODO Publicar por websockets
        //await this.websocketsGateway.sendMessageWs(payloadString);

        // Mqtt
        this.mqttService.doPublish(mqttClient, topic, qos, payloadString);
      } else {
        this.logger.error(
          'Payload string is undefined. Cannot publish empty payload',
        );
      }
    } else {
      this.logger.error(
        `MQTT client not found for the provided broker or task is not active`,
      );
    }
  }

  /**
   * @description Inicializador y Almacenador de Nuevas Tareas (Cron Jobs) asociándolas al Nodo Creador
   * Mapea un sub-tópico de forma Segura aislándolo bajo `/Username/Topic`.
   * Levanta automáticamente el temporizador al confirmarse el INSERT SQL.
   * @param {TaskDto} createTaskData - Validador JSON con Días, Hora, Topic y Comando.
   * @param {IUserInfo} userInfo - ID y Nivel de Acceso autorizante.
   * @returns {Promise<{ status: boolean, message: string, task: TaskEntity }>} Formato estandarizado de UI.
   */
  async createNewTask(
    createTaskData: TaskDto,
    userInfo: IUserInfo,
  ): Promise<{ status: boolean; message: string; task: TaskEntity }> {
    const user = await this.userService.findUserById(userInfo.userId, userInfo);

    const prefix = `/${user.username}/`;
    const cleanTopic = createTaskData.topic.startsWith(prefix)
      ? createTaskData.topic
      : prefix + createTaskData.topic.replace(/^\//, '');

    const task = this.taskRepository.create({
      ...createTaskData,
      topic: cleanTopic,
      createUserId: user ? user : undefined,
    });

    await this.taskRepository.save(task);

    // llamar a la creacion de la tarea en sistema
    this.addScheduleTask(task);

    return {
      status: true,
      message: `La tarea "${task?.name}" fue creada exitosamente`,
      task,
    };
  }

  /**
   * @description Localizador de Tarea mediante ID validado fuertemente por Multi-Tenant.
   * Administradores solo pueden extraer Tareas de las que sean dueños (`createUserId`)
   * mediante la utilidad centralizada QueryBuilderUtil.
   * @param {string} taskId - UUID relacional de la tarea.
   * @param {IUserInfo} userInfo - Actor firmante de la petición.
   * @returns {Promise<TaskEntity>} Objeto conteniendo el Task hidratado con su creador.
   * @throws {HttpException} 404 No autorizado o Extraviado.
   */
  public async findTaskById(
    taskId: string,
    userInfo: IUserInfo,
  ): Promise<TaskEntity> {
    const queryBuilder = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.createUserId', 'createUserId')
      .where('task.id = :taskId', { taskId });

    // Aplicar Scope de Seguridad (RBAC)
    QueryBuilderUtil.applyUserScope(queryBuilder, 'task', userInfo);

    const taskResult = await queryBuilder.getOne();

    if (!taskResult) {
      throw new HttpException(
        `Tarea con ID: "${taskId}" no encontrada`,
        HttpStatus.NOT_FOUND,
      );
    }

    return taskResult;
  }

  /**
   * @description Destruye el Cron Job actual, Actualiza la Entidad DB relacional y relanza el Job de
   * NodeJS bajo el mismo nombre. Aísla topics manipulados con Sandbox `/Username/<wildcard>`.
   * @param {string} taskId - Objetivo
   * @param {UpdateTaskDto} updateTaskData - Modificadores Parciales JSON.
   * @param {IUserInfo} userInfo - Identificador para el find validante.
   * @returns {Promise<{ status: boolean, task: TaskEntity }>} Fila actualizada hidratada.
   */
  async updateTaskById(
    taskId: string,
    updateTaskData: UpdateTaskDto,
    userInfo: IUserInfo,
  ): Promise<{ status: boolean; message: string; task: TaskEntity }> {
    const task = await this.findTaskById(taskId, userInfo);

    if (updateTaskData.topic) {
      const prefix = `/${task.createUserId.username}/`;

      if (!updateTaskData.topic.startsWith(prefix)) {
        updateTaskData.topic = prefix + updateTaskData.topic.replace(/^\//, '');
      }
    }

    await this.taskRepository.update(task.id, updateTaskData);

    this.deleteCronJob(`task_${task.id}`);
    this.addScheduleTask({ ...task, ...updateTaskData });

    return {
      status: true,
      message: `La tarea "${task?.name || updateTaskData.name}" se actualizó exitosamente`,
      task: { ...task, ...updateTaskData },
    };
  }

  /**
   * @description Grilla paginada para la Tabla de Tareas (Frontend) con soporte Multitenancy.
   * Utiliza QueryBuilderUtil para garantizar aislamiento de datos entre administradores.
   * Soporta búsquedas full-text en Nombre y Tópico.
   * @param {PaginationDto} paginationDto - Parámetros de paginación y búsqueda.
   * @param {IUserInfo} userInfo - Contexto del actor para el filtrado por RBAC.
   * @returns {Promise<{ limit: number, offset: number, count: number, tasks: TaskEntity[] }>} Matriz paginada.
   */
  public async findAllTasks(
    paginationDto: PaginationDto,
    userInfo: IUserInfo,
  ): Promise<{
    limit: number;
    offset: number;
    count: number;
    tasks: TaskEntity[];
  }> {
    const limit = paginationDto.limit || Number(process.env.LIMIT) || 1000;
    const offset = paginationDto.offset || Number(process.env.OFFSET) || 0;

    const queryBuilder = this.taskRepository
      .createQueryBuilder('tasks')
      .leftJoinAndSelect('tasks.createUserId', 'createUserId')
      .take(limit)
      .skip(offset);

    // Aplicar Scope de Seguridad (RBAC)
    QueryBuilderUtil.applyUserScope(queryBuilder, 'tasks', userInfo);

    if (paginationDto.search) {
      queryBuilder.andWhere(
        '(tasks.name LIKE :search OR tasks.topic LIKE :search)',
        { search: `%${paginationDto.search}%` },
      );
    }

    const [tasks, count] = await queryBuilder.getManyAndCount();

    return {
      limit,
      offset,
      count,
      tasks,
    };
  }

  /**
   * @description Remueve la tarea de Base de Datos y destrona su worker residente en EventLoop (`cronJob`).
   * Posee mecanismo Rollback: si el borrado lógico del proceso falla, la reinserta instanciada.
   * @param {string} taskId - UUID relacional.
   * @param {IUserInfo} userInfo - ID actor.
   * @returns {Promise<{ status: boolean, task: TaskEntity }>} Callback object.
   */
  public async deleteTaskById(
    taskId: string,
    userInfo: IUserInfo,
  ): Promise<{ status: boolean; message: string; task: TaskEntity }> {
    const existingTask = await this.findTaskById(taskId, userInfo); // filtro de usuario autorizado
    try {
      await this.taskRepository.delete(taskId);

      this.deleteCronJob(`task_${existingTask.id}`);

      return {
        status: true,
        message: `La tarea "${existingTask.name}" se eliminó exitosamente`,
        task: existingTask,
      };
    } catch (error) {
      await this.taskRepository.save(existingTask);

      this.addScheduleTask(existingTask);

      throw new HttpException(
        'Fallo al borrar la tarea programada. La tarea se ha restaurado.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * @description Elimina y detiene en Memoria RAM una tarea CRON de la librería de EventLoop.
   * @param {string} name - String ID interno ('task_' + UUID) guardado en SchedulerRegistry.
   */
  private deleteCronJob(name: string) {
    this.schedulerRegistry.deleteCronJob(name);
    this.logger.debug(`Cron job "${name}" deleted`);
  }
}
