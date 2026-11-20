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
import {
  IEmqxBannedParams,
  IEmqxBannedResponseData,
} from '../../../common/interfaces/emqx.interface.js';

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

  /**
   * @description Crea un Event-WebHook (`Data Bridge`) dinámico en EMQX.
   * Enruta automáticamente los flujos asíncronos MQTT propios de los Dispositivos del Usuario
   * como POST HTTP Request JSON hacia nuestra API (`/api/v1/messages/register`).
   * @param {Object} args - `{ name: nombreIdentiicador, user: usernameDeFiltrado }`
   * @returns {Promise<any>} Response de EMQX API V5.
   */
  public emqxApiPostBridge({
    name,
    user,
  }: {
    name: string;
    user: string;
  }): Promise<any> {
    const url = `http://${this.dataSettings?.emqxAppHost}:${this.dataSettings?.emqxAppPort}/api/v5/bridges`;

    const data = {
      name: `http_${this.formatText(name)}`,
      type: 'webhook',
      ssl: { enable: false },
      connect_timeout: '15s',
      pool_size: 4,
      enable: true,
      method: 'post',
      url: `http://${this.dataSettings?.apiCoreHost}:${this.dataSettings?.apiCorePort}/api/v1/messages/register`,
      max_retries: 3,
      request_timeout: '15s',
      pool_type: 'random',
      resource_opts: {
        worker_pool_size: 1,
        inflight_window: 100,
        health_check_interval: 15000,
        query_mode: 'async',
        max_buffer_bytes: 104857600,
      },
      enable_pipelining: 100,
      local_topic: `/${user}/#`, // /emqx1/# [Modificado para que capture todo del usuario]
    };

    return this.requestWithConfig('post', url, data);
  }

  // These are formatted names.
  private formatText(text: string): string {
    return text.split(' ').join('_');
  }

  /**
   * @description Regresa la lista matriz de clientes (devices / usuarios) BANEADOS permanentemente en todo el clúster EMQX.
   * @returns {Promise<Exclude<IEmqxBannedResponseData, never>>} Interface de Tipado Estricto de los Ban-Logs.
   */
  public emqxApiGetBannedList(): Promise<IEmqxBannedResponseData> {
    const url = `http://${this.dataSettings?.emqxAppHost}:${this.dataSettings?.emqxAppPort}/api/v5/banned`;
    return this.requestWithConfig('get', url);
  }

  /**
   * @description Remueve un Dispositivo/Cliente específico de la Lista Negra (Blacklist/Ban).
   * @param {IEmqxBannedParams} params `{ as: 'clientid' | 'username' | 'peerhost', who: stringID }`
   * @returns {Promise<number>} Status 204 No Content.
   */
  public emqxApiDeleteBanned(params: IEmqxBannedParams): Promise<number> {
    const url = `http://${this.dataSettings?.emqxAppHost}:${this.dataSettings?.emqxAppPort}/api/v5/banned/${params.as}/${params.who}`;

    return this.requestWithConfig('delete', url);
  }

  /**
   * @description Inserta a un infractor (Device Bloqueado o Robo) a la Lista Nera forzando la expulsión de todo Node MQTT.
   * @param {IEmqxBannedParams} params - Detalles de causa y duración de pena (`until`, `reason`, `by`, `as`, `who`).
   * @returns {Promise<any>}
   */
  public emqxApiPostAddBanned(params: IEmqxBannedParams): Promise<any> {
    const url = `http://${this.dataSettings?.emqxAppHost}:${this.dataSettings?.emqxAppPort}/api/v5/banned`;
    const data = {
      as: params.as,
      who: params.who,
      by: params.by || 'irrigation_app_api', // Valor por defecto
      reason: params.reason,
      at: params.at,
      until: params.until,
    };

    return this.requestWithConfig('post', url, data);
  }

  /**
   * @description Inicia o Suspende temporalmente el Webhook/Puente pre-existente.
   * @param {string} id - Bridge action ID (`http_my_action`).
   * @param {boolean} enable - Target status (true = running, false = stopped).
   * @returns {Promise<any>}
   */
  public emqxApiPutEnableDisableBridge(
    id: string,
    enable: boolean,
  ): Promise<any> {
    const url = `http://${this.dataSettings?.emqxAppHost}:${this.dataSettings?.emqxAppPort}/api/v5/bridges/${id}/enable/${enable}`;
    return this.requestWithConfig('put', url);
  }

  /**
   * @description Elimina por completo un Webhook/Puente Bridge enlazado.
   * @param {string} id - Id del Action de puente `http_NAME`.
   * @returns {Promise<number>} HTTP Status Code 204.
   */
  public emqxApiDeleteBridge(id: string): Promise<number> {
    const url = `http://${this.dataSettings?.emqxAppHost}:${this.dataSettings?.emqxAppPort}/api/v5/bridges/${id}`;
    return this.requestWithConfig('delete', url);
  }
}
