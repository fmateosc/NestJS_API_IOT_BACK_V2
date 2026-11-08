//src/modules/users/services/users.service.ts

import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WrapperType } from '../../../common/types/wrapper.type.js';
import { UsersEntity } from '../entities/users.entity.js';
import { UserDto } from '../dtos/user.dto.js';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { ACCESS_LEVEL, USER_ORIGIN } from '../../../constants/index.js';
import { IUserInfo } from '../../auth/intefaces/auth.interface.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(UsersEntity)
    private readonly usersRepository: Repository<UsersEntity>,
  ) {}

  /**
   * @description Orquesta la creación de un nuevo usuario en la base de datos, encriptando su contraseña
   * y determinando automáticamente su nivel de acceso (Admin o Root) dependiente del Origen (Web o Backend).
   * También emite correos de verificación de cuenta y genera reglas ACL si el usuario es Admin.
   * @param {UserDto} newUserData - Payload validado que contiene los datos personales y credenciales base del usuario.
   * @param {string} origin - Identificador enumerado del procedencia de creación (Ej. Creado por Web App o Sistema Script).
   * @returns {Promise<{ status: boolean, message: string, user: UsersEntity }>} Mensaje de éxito o retroalimentación y la entidad salvada.
   */
  public async createNewUser(
    newUserData: UserDto,
    origin: string,
    baseUrl?: string,
  ): Promise<{
    status: boolean;
    message: string;
    user: UsersEntity;
  }> {
    // Step 1: Check if user already exists to avoid redundant processing and early exit
    const existingUserCheck = await this.usersRepository.findOne({
      where: [
        { username: newUserData.username },
        { userEmail: newUserData.userEmail },
      ],
    });

    if (existingUserCheck) {
      const conflictField =
        existingUserCheck.username === newUserData.username
          ? 'username'
          : 'email';
      throw new HttpException(
        `Error en el registro: ya existe un usuario con este ${conflictField}.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // hash the password and create token
    const saltRounds = Number(process.env.HASH_SALT) || 10;
    const verificationToken = randomBytes(32).toString('hex');

    const [hasehdPassword, userToken] = await Promise.all([
      bcrypt.hash(newUserData.password, saltRounds),
      randomBytes(20).toString('hex'),
    ]);

    // determine the access
    if (origin === USER_ORIGIN.WEB) {
      newUserData.isSuperuser = false;
      newUserData.userAccess = ACCESS_LEVEL.ADMIN;
    }

    // validate access and user type
    if (
      newUserData.isSuperuser === undefined &&
      newUserData.userAccess !== undefined
    ) {
      newUserData.isSuperuser = newUserData.userAccess === ACCESS_LEVEL.ROOT;
    } else if (
      newUserData.userAccess === undefined &&
      newUserData.isSuperuser !== undefined
    ) {
      newUserData.userAccess = newUserData.isSuperuser
        ? ACCESS_LEVEL.ROOT
        : ACCESS_LEVEL.ADMIN;
    } else if (
      newUserData.userAccess === undefined &&
      newUserData.isSuperuser === undefined
    ) {
      // default values
      newUserData.userAccess = ACCESS_LEVEL.ADMIN;
      newUserData.isSuperuser = false;
    }

    // Users generated directly by the root/admin system don't need email confirmation
    const isAutoVerified = origin === USER_ORIGIN.ROOT;

    // create the user entity
    const newUser = this.usersRepository.create({
      ...newUserData,
      password: hasehdPassword,
      userToken,
      userOrigin: origin,
      verificationToken,
      isVerified: isAutoVerified,
    });

    let savedUser: UsersEntity;

    try {
      // Step 2: Save to DB. If this fails, the flow stops here before sending emails or creating rules.
      savedUser = await this.usersRepository.save(newUser);
    } catch (error: any) {
      // Catch TypeORM/Postgres unique violations (code 23505) just in case a race condition occurred between check and insert
      if (error.code === '23505') {
        throw new HttpException(
          'Ya existe un usuario con estas credenciales en el sistema.',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.error(
        `Error inesperado en la base de datos durante el registro: ${error.message}`,
      );

      throw new HttpException(
        'El registro ha fallado debido a un error del sistema. Por favor, contacta con el soporte técnico.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // TODO: Crear ACL rule

    // TODO: Send verification email if not auto-verified

    const message = isAutoVerified
      ? `El usuario "${savedUser.username}" se ha creado satisfactoriamente.`
      : `El usuario "${savedUser.username}" se ha creado. Por favor, verifica tu correo electrónico (carpeta de entrada o SPAM) para confirmar la cuenta.`;

    return {
      status: true,
      message,
      user: savedUser,
    };
  }

  /**
   * @description Busca un usuario en la tabla validando los roles de acceso (Tenant).
   * Si el requerimiento proviene de un 'ADMIN', sobreescribe restrictivamente la Query forzándole a devolverse
   * solo a sí mismo (Evitando fuga de datos de otros usuarios o Superadministradores ROOT).
   * @param {string} userId - UUID del objetivo a ser localizado.
   * @param {IUserInfo} userInfo - Token decodificado limitando el alcance.
   * @returns {Promise<UsersEntity>} Entidad base del Usuario.
   * @throws {HttpException} Lanza error 404 (Not Found) si no halla al usuario o no posee acceso.
   */
  public async findUserById(
    userId: string,
    userInfo: IUserInfo,
  ): Promise<UsersEntity> {
    const queryBuilder = this.usersRepository
      .createQueryBuilder('users')
      .where({ id: userId });

    // validate user
    if (userInfo.userAccess === ACCESS_LEVEL.ADMIN) {
      queryBuilder.andWhere('users.id = :id', { id: userInfo.userId });
    }

    const user = await queryBuilder.getOne();

    if (!user) {
      throw new HttpException(
        `El usuario con el Id ${userId} no se encuentra en el sistema`,
        HttpStatus.NOT_FOUND,
      );
    }

    return user;
  }

  /**
   * @description Helper Bypass interno para extraer Entidades ignorando interceptores tradicionales,
   * requiriéndose típicamente para buscar por `userEmail` al resetear paswords, y arrastrando columnas ocultas como Password o 2FA.
   * @param {Object} params - Diccionario con `key` (Clave en UserDto) y `value` (valor a coincidir).
   * @returns {Promise<UsersEntity | null>} El resultado completo con campos ocultos expuestos en memoria volatil.
   */
  public async findBy({
    key,
    value,
  }: {
    key: keyof UserDto;
    value: any;
  }): Promise<UsersEntity | null> {
    return await this.usersRepository
      .createQueryBuilder('user')
      .addSelect([
        'user.password',
        'user.isTwoStepAuthEnabled',
        'user.twoStepCode',
        'user.twoStepExpires',
      ])
      .where(`user.${key} = :value`, { value })
      .andWhere('user.userStatus = :userStatus', { userStatus: true })
      .getOne();
  }
}
