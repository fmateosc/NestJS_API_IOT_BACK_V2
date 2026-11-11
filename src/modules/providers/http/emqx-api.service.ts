import { HttpService } from '@nestjs/axios';
import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { GeneralSettingsEntity } from '../../settings/entities/settings.entity.js';
import { SettingsService } from '../../settings/services/settings.service.js';
import { AxiosError, AxiosRequestConfig } from 'axios';
import { firstValueFrom, catchError } from 'rxjs';

@Injectable()
export class EmqxApiService {
  private readonly logger = new Logger(EmqxApiService.name);
  private dataSettings?: GeneralSettingsEntity | null;

  constructor(
    private readonly emqxHttpService: HttpService,
    @Inject(forwardRef(() => SettingsService))
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * @description Hook del ciclo de vida de NestJS. Se ejecuta automáticamente en arranques.
   * Encargado de cargar en memoria RAM (Caché) la configuración global de credenciales y host de EMQX,
   * mitigando múltiples llamadas a DB.
   */
  async onModuleInit() {
    await this.refreshSettings();
  }

  /**
   * @description Hidrata la variable privada `dataSettings` consultando a la BDD el panel de Ajustes Generales.
   * @returns {Promise<void>}
   */
  public async refreshSettings(): Promise<void> {
    this.dataSettings = await this.settingsService.findGeneralSettings();
  }

  /**
   * @description Transmisor genérico envolvente (`Wrapper`) para peticiones HTTP vía Axios hacia EMQX.
   * Inyecta intrínsecamente Authorization Headers (Basic Auth) y maneja Excepciones estándar RxJS.
   * Mapea errores de red o del Broker a HttpExceptions nativas de NestJS para flujo uniforme.
   * @template T Tipo de respuesta esperada.
   * @param {'get' | 'post' | 'delete' | 'put'} method - Verbo REST.
   * @param {string} url - Target URL final.
   * @param {any} [data] - (Opcional) Payload (Cuerpo).
   * @param {AxiosRequestConfig} [config] - Opciones extra de Axios.
   * @returns {Promise<T>} Promesa resuelta en el Data Payload tipo T.
   */
  private async requestWithConfig<T>(
    method: 'get' | 'post' | 'delete' | 'put',
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const settingsStatus = await this.ensureSettingsInitialized();
    if (!settingsStatus) {
      throw new HttpException(
        'EMQX API Configuration missing in General Settings',
        HttpStatus.FAILED_DEPENDENCY,
      );
    }

    try {
      const response = await firstValueFrom(
        this.emqxHttpService
          .request<T>({
            method,
            url,
            data,
            ...config,
            headers: {
              ...config?.headers,
              'User-Agent': 'gamma-automations-iot-app/1.0.0',
              Authorization: `Basic ${this.encodeCredentials()}`,
            },
          })
          .pipe(
            catchError((error: AxiosError) => {
              const status =
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
              const remoteData = error.response?.data as any;
              const detail =
                remoteData?.message || remoteData?.reason || error.message;

              throw new HttpException(
                {
                  message: `EMQX Broker Error: ${detail}`,
                  remoteError: remoteData,
                  statusCode: status,
                  error: 'EMQX_API_FAILURE',
                },
                status,
              );
            }),
          ),
      );
      return response.data;
    } catch (error) {
      // Si ya es una HttpException, la dejamos pasar para el filtro global
      if (error instanceof HttpException) throw error;

      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`Unexpected EMQX Request Error: ${message}`);
      
      throw new HttpException(
        {
          message: `Internal error during EMQX communication: ${message}`,
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'EMQX_INTEGRATION_ERROR',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async ensureSettingsInitialized(): Promise<boolean> {
    if (!this.dataSettings) {
      await this.refreshSettings();

      if (!this.dataSettings) {
        this.logger.error('No general settings available');

        return false;
      }
    }

    return true;
  }

  private encodeCredentials(): string {
    if (!this.dataSettings) {
      throw new Error(
        'No general settings available for encrypting credentials',
      );
    }

    const credentials = `${this.dataSettings.emqxApiKey}:${this.dataSettings.emqxApiSecretKey}`;

    return Buffer.from(credentials).toString('base64');
  }

  /**
   * @description [DEMO] Recupera una lista completa interactiva de tópicos activos en el clúster.
   * @returns {Promise<any>}
   */
  public emqxApiGetTopicList(): Promise<any> {
    const url = `http://${this.dataSettings?.emqxAppHost}:${this.dataSettings?.emqxAppPort}/api/v5/topics`;

    return this.requestWithConfig('get', url);
  }
}
