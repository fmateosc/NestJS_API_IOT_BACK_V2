// src/modules/users/interfaces/user.interface.ts

export interface IUser {
  id?: string;
  username: string;
  userEmail: string;
  userFullName?: string;
  password?: string;
  userAccess: string;
  userStatus: boolean;
}
