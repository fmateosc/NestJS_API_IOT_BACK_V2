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
import { UsersEntity } from '../entities/users.entity.js';
import { UserDto } from '../dtos/user.dto.js';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { ACCESS_LEVEL, USER_ORIGIN } from '../../../constants/index.js';
import { IUserInfo } from '../../auth/intefaces/auth.interface.js';
import { PaginationDto } from '../../../common/dtos/pagination.dto.js';
import { UpdateUserDto } from '../dtos/update.user.dto.js';
import { PasswordUserDto } from '../dtos/update.password.user.dto.js';
import { AuthService } from '../../auth/services/auth.service.js';
import type { WrapperType } from '../../../common/types/wrapper.type.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(UsersEntity)
    private readonly usersRepository: Repository<UsersEntity>,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: WrapperType<AuthService>,
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

    // Step 3: Secondary operations only for successfully saved users
    if (savedUser.userAccess === ACCESS_LEVEL.ADMIN) {
      await this.authService.createNewAclRule(savedUser);
    }

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

  // TODO: findOneSimple

  /**
   * @description Localiza todos los usuarios paginados y condicionados a una cadena de búsqueda
   * que explora nombres, apellidos o correos. Reservado para uso exclusivo del Superadministrador (ROOT).
   * @param {PaginationDto} paginationDto - Data Transfer Object albergando parámetros de cursor (limit, offset) y text search.
   * @returns {Promise<{ limit: number, offset: number, count: number, users: UsersEntity[] }>} Tupla estandarizada de grillas.
   * @throws {HttpException} 400 Bad Request si la tabla está totalmente vacía.
   */
  public async findAllUsers(paginationDto: PaginationDto): Promise<{
    limit: number;
    offset: number;
    count: number;
    users: UsersEntity[];
  }> {
    const limit = paginationDto.limit || Number(process.env.LIMIT) || 1000;
    const offset = paginationDto.offset || Number(process.env.OFFSET) || 0;

    const queryBuilder = this.usersRepository
      .createQueryBuilder('users')
      .take(limit)
      .skip(offset);

    if (paginationDto.search) {
      queryBuilder.andWhere(
        '(users.username LIKE :search OR users.firstName LIKE :search OR users.lastName LIKE :search OR users.email LIKE :search)',
        { search: `%${paginationDto.search}%` },
      );
    }

    const [users, count] = await queryBuilder.getManyAndCount();

    if (!count) {
      throw new HttpException(
        `No se han encontrado usuarios.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      limit,
      offset,
      count,
      users,
    };
  }

  /**
   * @description Genera un parche de actualización sobre campos específicos del usuario.
   * Incorpora subrutina de Hashing en caso de incluirse el campo `password`.
   * Impide que los `ADMIN` puedan sobreescribir su propio `userAccess` para auto-otorgarse `ROOT`.
   * @param {UpdateUserDto} updatedUserData - Objeto parcial tipo PartialType<UserDto>.
   * @param {string} userId - UUID del objetivo.
   * @param {IUserInfo} userInfo - Actor firmante en la transacción.
   * @returns {Promise<{ status: boolean, user: UsersEntity }>} Status OK y entidad pre-hidratada con sus updates.
   */
  public async updateUserById(
    updatedUserData: UpdateUserDto,
    userId: string,
    userInfo: IUserInfo,
  ): Promise<{ status: boolean; user: UsersEntity }> {
    const existingUser = await this.findUserById(userId, userInfo);

    if (updatedUserData.password) {
      const saltRounds = Number(process.env.HASH_SALT) || 10;
      updatedUserData.password = await bcrypt.hash(
        updatedUserData.password,
        saltRounds,
      );
    }

    if (existingUser.userAccess === ACCESS_LEVEL.ADMIN) {
      updatedUserData.isSuperuser = false;
      updatedUserData.userAccess = ACCESS_LEVEL.ADMIN;
    }

    await this.usersRepository.update(userId, updatedUserData);

    return {
      status: true,
      user: { ...existingUser, ...updatedUserData },
    };
  }

  /**
   * @description Elimina sistemática y físicamente un usuario y, en cascada (Macro), destruye todos
   * sus mensajes, y dispositivos IoT atados. Posee verificadores de Autoprotección para imposibilitar
   * la eliminación del usuario primario ROOT, garantizando la establidad de la plataforma.
   * @param {string} userId - UUID a remover temporal/definitivamente del sistema.
   * @param {IUserInfo} userInfo - Verificador anti-escalada. Previene a inquilinos ADMIN cruzarse.
   * @returns {Promise<{ status: boolean, user: UsersEntity }>} Feed log indicando su cesación en cascada.
   * @throws {HttpException} Errores de permiso 403 Forbidden.
   */
  public async deleteUserById(
    userId: string,
    userInfo: IUserInfo,
  ): Promise<{ status: boolean; user: UsersEntity }> {
    // Explicit security check: Non-ROOT users can only delete themselves
    if (
      userInfo.userAccess !== ACCESS_LEVEL.ROOT &&
      userInfo.userId !== userId
    ) {
      throw new HttpException(
        'No tienes permiso para eliminar a este usuario.',
        HttpStatus.FORBIDDEN,
      );
    }

    const existingUser = await this.findUserById(userId, userInfo);

    // Security check: ROOT users cannot be deleted to ensure system stability.
    if (existingUser.userAccess === ACCESS_LEVEL.ROOT) {
      throw new HttpException(
        'ROOT users cannot be deleted from the system',
        HttpStatus.FORBIDDEN,
      );
    }

    // TODO: 1. Cleanup all user messages (destructive action)

    // TODO: 2. Cleanup all user devices (Macro to Micro)

    // 3. Delete user (Cascades to devices, acl, tasks due to DB constraints)
    await this.usersRepository.delete(userId);

    return {
      status: true,
      user: existingUser,
    };
  }

  /**
   * @description Orquesta la rotación segura de contraseña exigiendo re-validación de Credencial Actual.
   * Incorpora salteo y Hashing (Bcrypt) y bloquea la utilización repetida del mismo String subyacente.
   * @param {PasswordUserDto} userPasswordData - DTO conteniendo old Password y new Password (repetido confimación).
   * @param {string} userId - ID extractado del JWT inyectado.
   * @returns {Promise<{ status: boolean, user: UsersEntity }>} Resolucion del cambio sobre la entidad purgada.
   * @throws {HttpException} 400 Si el password viejo es erróneo, o el nuevo es idéntico/inválido.
   */
  public async updateUserPasswordById(
    userPasswordData: PasswordUserDto,
    userId: string,
  ): Promise<{ status: boolean; user: UsersEntity }> {
    const user = await this.findBy({ key: 'id', value: userId });

    if (!user) {
      throw new HttpException(
        `Usuario con Id ${userId} no encontrado en el sistema.`,
        HttpStatus.NOT_FOUND,
      );
    }

    if (
      !userPasswordData.currentpwd ||
      !(await bcrypt.compare(userPasswordData.currentpwd, user.password))
    ) {
      throw new HttpException(
        'Previous password does not match',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      !userPasswordData.newpwd ||
      (await bcrypt.compare(userPasswordData.newpwd, user.password))
    ) {
      throw new HttpException(
        'The new password cannot be the same as the previous one',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (userPasswordData.newpwd !== userPasswordData.confirmpwd) {
      throw new HttpException(
        'The new password and confirmation do not match',
        HttpStatus.BAD_REQUEST,
      );
    }

    const saltRounds = Number(process.env.HASH_SALT) || 10;
    const hashedPassword = await bcrypt.hash(
      userPasswordData.newpwd,
      saltRounds,
    );

    await this.usersRepository.update(userId, { password: hashedPassword });

    return {
      status: true,
      user: { ...user },
    };
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

  /**
   * @description Modifica el Timestamp silente "lastSeen" o el toggle Login cuando el motor WS
   * capta actividad del usuario o un LogIn.
   * @param {string} userId - UUID.
   * @param {ACCESS_LEVEL | string} userAccess - Contexto extraído.
   * @param {boolean} login - true si se ha autenticado activamente recién.
   */
  public async updateUserConnection(
    userId: string,
    userAccess: ACCESS_LEVEL | string,
    login: boolean,
  ): Promise<void> {
    const userInfo: IUserInfo = {
      userId,
      userAccess,
    };

    const data: UpdateUserDto = {
      userLastseen: new Date(),
      userLogin: login,
    };

    await this.updateUserById(data, userId, userInfo);
  }

  /**
   * @description Activa o desactiva el segundo factor de autenticación.
   */
  async toggleTwoStepAuth(
    userId: string,
    isEnabled: boolean,
  ): Promise<boolean> {
    await this.usersRepository.update(userId, {
      isTwoStepAuthEnabled: isEnabled,
      twoStepCode: null as any,
      twoStepExpires: null as any,
    });
    
    return true;
  }
}
