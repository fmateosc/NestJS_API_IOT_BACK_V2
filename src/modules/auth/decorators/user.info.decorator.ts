// src/modules/auth/decorators/user.info.decorator.ts

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { IUserInfo } from '../intefaces/auth.interface.js';

export const GetUserInfo = createParamDecorator(
  (data: string, ctx: ExecutionContext): IUserInfo => {
    const req = ctx.switchToHttp().getRequest();
    return {
      userId: req.userId,
      userAccess: req.userAccess,
    };
  },
);
