// src/modules/auth/services/auth.service.ts

import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { UsersEntity } from '../../users/entities/users.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import * as bcrypt from 'bcrypt';
import { IUser } from '../../users/interfaces/user.interface.js';
import { AuthResponse, PayloadToken } from '../intefaces/auth.interface.js';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  /**
   * @description Compara la existencia de un nombre de usuario en la base de datos y,
   * de existir, ejecuta comprobación de hashes BCrypt sobre el Password Crudo.
   * Si resulta exitoso, actualiza el timestamp transitorio `userLastseen` del Usuario a online.
   * @param {string} username - Credencial String ingresada en Login form.
   * @param {string} password - Contraseña cruda sin salar ingresada en Login.
   * @returns {Promise<UsersEntity | null>} El objeto del usuario validado o Nulo si falló el Auth.
   */
  public async validateUser(
    username: string,
    password: string,
  ): Promise<UsersEntity | null> {
    const userByUsername = await this.usersService.findBy({
      key: 'username',
      value: username,
    });

    if (
      userByUsername &&
      (await bcrypt.compare(password, userByUsername.password))
    ) {
      await this.usersService.updateUserConnection(
        userByUsername.id,
        userByUsername.userAccess,
        true,
      );

      return userByUsername;
    }

    return null;
  }

  /**
   * @description Empaqueta un JSON Web Token (JWT) tras un inicio de sesión exitoso.
   * Hidrata el Payload con la ID única y los Privilegios (ACCESS_LEVEL).
   * @param {IUser} user - Info mínima extraída tras validateUser.
   * @returns {Promise<AuthResponse>} Tupla combinando el accessToken crudo y el obj del User.
   * @throws {HttpException} 404 En el raro borde de que el usuario haya desaparecido de la tabla en pleno Sign.
   */
  public async generateJWT(user: IUser): Promise<AuthResponse> {
    const getUser = await this.usersService.findBy({
      key: 'id',
      value: user.id,
    });
    if (!getUser) {
      throw new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);
    }
    const payload: PayloadToken = {
      access: getUser.userAccess,
      userId: getUser.id,
    };
    return {
      accessToken: this.singJWT({
        payload,
        secret: process.env.JWT_SECRET || 'eSTEesmisecertcode2025*',
        expires: '24h',
      }),
      user,
    };
  }

  /**
   * @description Firmador subyacente sincrónico del Token JWT configurando
   * la expiración general por defecto de la sesión backend (Ej: 24 Horas).
   * @param {Object} args - Diccionario con `payload`, firma `secret` y ms de `expires`.
   * @returns {string} Token alfanumérico hasheado firmado.
   */
  private singJWT({
    payload,
    secret,
    expires,
  }: {
    payload: jwt.JwtPayload;
    secret: string;
    expires: number | string;
  }): string {
    return jwt.sign(payload, secret, {
      expiresIn: expires as jwt.SignOptions['expiresIn'],
    });
  }
}
