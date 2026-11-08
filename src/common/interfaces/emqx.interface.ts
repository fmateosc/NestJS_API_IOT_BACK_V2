// src/common/interfaces/emqx.interface.ts

/**
 * @description Interfaz TIPADA para las Respuestas Paginadas del API Listar Baneados (Blacklist) en EMQX Broker Rest API.
 */
export interface IEmqxBannedResponseData {
  data: IEmqxBannedParams[];
  meta: {
    count: number;
    limit: number;
    page: number;
    hasnext: boolean;
  };
}

/**
 * @description Configuración de Parámetros CRUD de Baneos Banned hacia el broker EMQx.
 * Permite especificar si el castigo es por UUID (`clientid`) o por `username`,
 * junto con razones logueables y caducidad temporal UNIX.
 */
export interface IEmqxBannedParams {
  as:
    | 'clientid'
    | 'username'
    | 'peerhost'
    | 'clientid_re'
    | 'username_re'
    | 'peerhost_net';
  who: string;
  by?: string;
  reason?: string;
  at?: number | string;
  until?: number | string;
}
