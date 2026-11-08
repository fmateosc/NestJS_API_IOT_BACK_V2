// src/modules/auth/interfaces/auth.interface.ts

import { ACCESS_LEVEL } from '../../../constants/index.js';
import { IUser } from '../../users/interfaces/user.interface.js';

export interface AuthBody {
  username: string;
  password: string;
}

export interface AuthResponse {
  accessToken?: string;
  user?: IUser;
  requires2FA?: boolean;
  userId?: string;
  message?: string;
}

export interface PayloadToken {
  userId: string;
  access: ACCESS_LEVEL;
}

export interface IUseToken {
  role: string;
  userId: string;
  isExpired: boolean;
}

export interface IAuthTokenResult {
  role: string;
  userId: string;
  iat: number;
  exp: number;
}

export interface IUserInfo {
  userId: string;
  userAccess: string;
}
