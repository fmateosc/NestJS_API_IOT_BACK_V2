import { SelectQueryBuilder } from 'typeorm';
import { IUserInfo } from '../modules/auth/intefaces/auth.interface.js';
import { ACCESS_LEVEL } from '../constants/index.js';
;

/**
 * @description Utilidad global para la inyección de scopes de seguridad (RBAC) en QueryBuilders de TypeORM.
 * Permite centralizar la lógica de "Multi-tenancy" asegurando que los Administradores solo vean 
 * recursos de los cuales son dueños (propiedad directa o indirecta), mientras que los usuarios 
 * ROOT conservan visibilidad global.
 */
export class QueryBuilderUtil {
    
    /**
     * @description Aplica un filtro de propiedad directa (Owner Filter).
     * Ideal para tablas que tienen una relación directa ManyToOne con UsersEntity.
     * @param {SelectQueryBuilder<any>} qb - Instancia del QueryBuilder.
     * @param {string} alias - Alias de la tabla objetivo en el query.
     * @param {IUserInfo} userInfo - Actor firmante de la petición.
     * @param {string} userRelationProperty - Propiedad que mapea al Usuario (Ej: 'createUserId').
     * @returns {SelectQueryBuilder<any>} QueryBuilder mutado.
     */
    static applyUserScope(
        qb: SelectQueryBuilder<any>,
        alias: string,
        userInfo: IUserInfo,
        userRelationProperty: string = 'createUserId'
    ): SelectQueryBuilder<any> {
        const { userAccess, userId } = userInfo;

        if (userAccess === ACCESS_LEVEL.ADMIN) {
            qb.andWhere(`${alias}.${userRelationProperty} = :scopedUserId`, { scopedUserId: userId });
        }

        return qb;
    }

    /**
     * @description Aplica un filtro de propiedad indirecta mediante el Serial del Dispositivo.
     * Específico para el módulo de Mensajería donde los registros pertenecen a un ClientID (Serial)
     * que a su vez pertenece a un Usuario.
     * @param {SelectQueryBuilder<any>} qb - Instancia del QueryBuilder.
     * @param {any} DevicesEntityClass - Referencia a la clase DevicesEntity para el JOIN.
     * @param {string} messageAlias - Alias de la tabla de mensajes.
     * @param {IUserInfo} userInfo - Actor de la petición.
     * @returns {SelectQueryBuilder<any>} QueryBuilder con JOIN de seguridad inyectado.
     */
    static applyTelemetryScope(
        qb: SelectQueryBuilder<any>,
        DevicesEntityClass: any,
        messageAlias: string,
        userInfo: IUserInfo
    ): SelectQueryBuilder<any> {
        const { userAccess, userId } = userInfo;

        if (userAccess === ACCESS_LEVEL.ADMIN) {
            qb.innerJoin(
                DevicesEntityClass,
                'scopedDevice',
                `scopedDevice.deviceSerial = ${messageAlias}.clientid`
            ).andWhere('scopedDevice.device_user_id = :scopedUserId', { scopedUserId: userId });
        }

        return qb;
    }
}
