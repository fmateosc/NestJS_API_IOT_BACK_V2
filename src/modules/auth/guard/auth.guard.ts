// src/modules/auth/guards/auth.guard.ts

import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../../users/services/users.service.js';
import { Reflector } from '@nestjs/core';
import { PUBLIC_KEY } from '../../../constants/index.js';
import { IUseToken } from '../intefaces/auth.interface.js';
import { useToken } from '../../../util/use.token.js';
import type { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly usersService: UsersService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.get<boolean>(
      PUBLIC_KEY,
      context.getHandler(),
    );

    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();

    const token = req.headers['token'];

    if (!token || Array.isArray(token)) {
      throw new HttpException('Token inválido', HttpStatus.UNAUTHORIZED);
    }

    const manageToken: IUseToken | string = useToken(token);

    if (typeof manageToken === 'string') {
      throw new UnauthorizedException(manageToken);
    }

    if (manageToken.isExpired) {
      // TODO:
      //await this.usersService.updateUserConnection(manageToken.userId, manageToken.role, false);
      throw new UnauthorizedException('El token ha expirado');
    }

    const { userId } = manageToken;
    const user = await this.usersService.findBy({ key: 'id', value: userId });

    if (!user) {
      throw new UnauthorizedException('Usuario inválido');
    }

    const authenticatedRequest = req as Request & {
      userId: typeof user.id;
      userAccess: typeof user.userAccess;
    };
    
    authenticatedRequest.userId = user.id;
    authenticatedRequest.userAccess = user.userAccess;

    return true;
  }
}
