// src/modules/settings/encryption.transformer.ts

import { ValueTransformer } from "typeorm";
import { EncryptionUtil } from "../../../util/encryption.util.js";

/**
 * @description Transformador de Cifrado para Columnas sensibles de la base de datos.
 * Automatiza el cifrado al guardar (to) y el descifrado al leer (from)
 * sin que el resto del negocio NestJS sufra cambios de firma.
 */
export class EncryptionTransformer implements ValueTransformer {
    /**
     * @description Se invoca al Guardar/Actualizar en la DB.
     * Convierte el texto plano de la aplicación en un datagrama `iv:data`.
     * @param {any} value - Texto plano de la entidad.
     * @returns {string} Texto cifrado.
     */
    to(value: string | null): string | null {
        if (!value) return value;
        return EncryptionUtil.encrypt(value);
    }

    /**
     * @description Se invoca al Leer de la DB.
     * Devuelve el valor original descifrado o el texto plano si no detecta formato de cifrado.
     * @param {any} value - Valor leído de la DB.
     * @returns {string} Texto plano legible.
     */
    from(value: string | null): string | null {
        if (!value) return value;
        return EncryptionUtil.decrypt(value);
    }
}