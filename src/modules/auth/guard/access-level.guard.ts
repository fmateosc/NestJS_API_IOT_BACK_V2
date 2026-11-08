// src/modules/auth/guards/access-level.guard.ts

import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import {
  ACCESS_LEVEL,
  ACCESS_LEVEL_KEY,
  PUBLIC_KEY,
  ROOT_KEY,
} from '../../../constants/index.js';


@Injectable()
export class AccessLevelGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.get<boolean>(
      PUBLIC_KEY,
      context.getHandler(),
    );
    if (isPublic) {
      return true;
    }

    const access = this.reflector.get<Array<keyof typeof ACCESS_LEVEL>>(
      ACCESS_LEVEL_KEY,
      context.getHandler(),
    );

    const root = this.reflector.get<string>(ROOT_KEY, context.getHandler());

    const req = context
      .switchToHttp()
      .getRequest<Request & { userAccess?: string }>();
    const { userAccess } = req;

    if (access === undefined) {
      if (!root) {
        return true;
      } else if (root && userAccess === root) {
        return true;
      } else {
        throw new HttpException(
          `No tiene permisos para esta operación`,
          HttpStatus.UNAUTHORIZED,
        );
      }
    }

    if (userAccess === ACCESS_LEVEL.ROOT) {
      return true;
    }

    const isAuth = access.some((access) => access === userAccess);

    if (!isAuth) {
      throw new HttpException(
        `No tiene permisos para esta operación`,
        HttpStatus.UNAUTHORIZED,
      );
    }

    return true;
  }
}
