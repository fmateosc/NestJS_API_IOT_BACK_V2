
import * as jwt from 'jsonwebtoken';
import { IAuthTokenResult, IUseToken } from '../modules/auth/intefaces/auth.interface.js';

/**
 * @description Utilidad global interceptora de JWT. Desencripta el token bearer 
 * sin necesidad de contactar al auth-guard, devolviendo las métricas vitales (ID, Rol, Vida).
 * @param {string} token - Raw JWT String.
 * @returns {IUseToken | string} Objeto de claims o string 'Invalid token'.
 */
export const useToken = (token: string): IUseToken | string => {
    try {
        const decode = jwt.decode(token) as IAuthTokenResult;
        const currentDate = new Date();
        const expiredDate = new Date(decode.exp);

        return {
            userId: decode.userId,
            role: decode.role,
            isExpired: +expiredDate <= +currentDate / 1000,
        }
    } catch (error) {
        return 'Invalid token'
    }
}