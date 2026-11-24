// src/modules/providers/mqtt/mqtt.service.ts

import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as mqtt from 'mqtt';
import { GeneralSettingsEntity } from '../../settings/entities/settings.entity.js';
import { DeviceSettingsService } from '../../devices/services/device-settings.service.js';
import { ModuleRef } from '@nestjs/core';
import { SettingsService } from '../../settings/services/settings.service.js';
import { Observable, Subject } from 'rxjs';

/**
 * @description Proveedor Global de conectividad nativa MQTT (Protocolo IoT).
 * Mantiene un pool de conexiones estables en memoria viva (Map) hacia EMQX.
 * Resulve re-conexiones y maneja las suscripciones dinámicas.
 */
@Injectable()
export class MqttService implements OnModuleDestroy, OnModuleInit {
  private logger = new Logger(MqttService.name);

  private dataSettings?: GeneralSettingsEntity | null;
  private mqttClients: Map<string, mqtt.MqttClient> = new Map();
  private hostname: string;
  private brokerUrl: string;
  private settingsRetryInterval: NodeJS.Timeout | undefined;
  private isInitialized: boolean = false;
  private deviceSettingsService: DeviceSettingsService | null = null;

  constructor(
    @Inject(forwardRef(() => SettingsService))
    private readonly settingsService: SettingsService,
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * @description Lifecycle hook. Inicializa la conexión primaria tan pronto NestJS arranca.
   */
  async onModuleInit() {
    await this.tryInitializeSettingsWithRetry();
    // Resolución lazy de DeviceSettingsService para evitar dependencia circular
    // Se intenta resolver después de que todos los módulos estén inicializados
    try {
      this.deviceSettingsService = this.moduleRef.get(DeviceSettingsService, {
        strict: false,
      });
    } catch {
      this.logger.warn(
        'El servicio DeviceSettingsService aún no está disponible. La sincronización de ajustes se reintentará cuando se reciba el primer mensaje.',
      );
    }
  }

  /**
   * @description Bucle persistente de auto-recuperación (Resilience Pattern).
   * Intenta leer `GeneralSettings` desde la BD. Si la DB no está lista o falla,
   * se enjabona cada 60s hasta asegurar que se recupere la URL del Broker MQTT.
   * Inicializa al Super-User `emqx` para monitoreo general una vez conseguido.
   * @returns {Promise<void>}
   */
  public async tryInitializeSettingsWithRetry(): Promise<void> {
    // Si ya hay un intervalo en progreso, lo limpiamos para no acumular timers.
    if (this.settingsRetryInterval) {
      clearInterval(this.settingsRetryInterval);
    }

    const attemptInitialization = async () => {
      try {
        this.dataSettings = await this.settingsService.findGeneralSettings();
        if (!this.dataSettings) {
          this.logger.warn(
            'General settings not found. Retrying in 60 seconds...',
          );
          return;
        }

        this.hostname = this.dataSettings?.emqxAppHost || 'localhost';
        this.brokerUrl = `mqtt://${this.hostname}:${this.dataSettings?.mqttApiPort}`;

        this.logger.log(
          `General settings loaded successfully. Initializing MQTT broker on ${this.brokerUrl}...`,
        );

        // conectar el usuario por defecto (este método internamente reiniciará si "emqx" ya estaba mapeado)
        this.doConnectUser(
          'emqx',
          this.dataSettings?.mqttApiUser,
          this.dataSettings?.mqttApiPassword,
        );

        this.isInitialized = true;
        // Si fue exitoso y había un intervalo activo, lo frenamos definitivamente.
        if (this.settingsRetryInterval) {
          clearInterval(this.settingsRetryInterval);
          this.settingsRetryInterval = undefined;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        this.logger.error(
          `Failed to load general settings: ${message}. Retrying in 60 seconds...`,
        );
      }
    };

    // Lanzar el intento maestro.
    await attemptInitialization();

    // Si falló en la inicialización (generalmente por DB off), entrar al bucle.
    if (!this.isInitialized) {
      this.settingsRetryInterval = setInterval(async () => {
        this.logger.log('Retrying to load general settings...');
        await attemptInitialization();
      }, 60000); // 1 min (60,000ms)
    }
  }

  /**
   * @description Conecta y registra un nuevo Cliente MQTT al pool en Memoria RAM (`Map`).
   * Configurado con KeepAlive agresivo y limpieza de Sesión (`clean: true`).
   * Devuelve un Observador RxJS Streameable para capturar paquetes en tiempo real.
   * @param {string} userId - UUID del Usuario Dueño.
   * @param {string | undefined} username - Nombre ACL (ej. 'JohnDoe').
   * @param {string | undefined} password - Hash Auth.
   * @returns {Observable<mqtt.Packet>} Flujo persistente RxJS de Eventos.
   */
  doConnectUser(
    userId: string,
    username: string | undefined,
    password: string | undefined,
  ): Observable<mqtt.Packet> {
    // Si el usuario ya está conectado, se desconecta antes de continuar
    if (this.mqttClients.has(userId)) {
      this.logger.log(`User ${userId} is already connected to MQTT.`);
      this.doDisconnectUser(userId);
    }

    const mqttOptions: mqtt.IClientOptions = {
      clientId: `CoreApi_${userId}`,
      username,
      password,
      clean: true,
      keepalive: 60,
      reconnectPeriod: 1000,
      connectTimeout: 30000,
    };

    const mqttClient = mqtt.connect(this.brokerUrl, mqttOptions);

    this.mqttClients.set(userId, mqttClient);

    // Cuando se establece la conexión al Broker
    this.logger.log(
      `MQTT Connection Attempt: user="${userId}" user_mqtt="${username}" broker="${this.brokerUrl}"`,
    );

    // Suscribirse a un tópico para la escucha
    mqttClient.on('connect', () => {
      // Si el userId es 'emqx', es la conexión del sistema que requiere ver todo (Wildcard)
      // Independientemente de cual sea su username actual en settings.
      userId === 'emqx'
        ? this.doSubscribe(mqttClient, `/+/#`, 0)
        : this.doSubscribe(mqttClient, `/${username}/#`, 0);

      this.logger.log(
        `MQTT Client Connected: userId="${userId}" (Subscribed to: ${userId === 'emqx' ? '/+ /#' : `/${username}/#`})`,
      );
    });

    mqttClient.on('error', (err) => {
      this.logger.error(
        `MQTT Client Error: userId="${userId}", error="${err.message}"`,
      );
    });

    mqttClient.on('offline', () => {
      this.logger.warn(`MQTT Client Offline: userId="${userId}"`);
    });

    const subject = new Subject<mqtt.Packet>();

    mqttClient.on('message', (topic, message) => {
      // Router por payload.type para el cliente emqx (wildcard)
      if (userId === 'emqx') {
        this.routeMessage(topic, message);
      }

      subject.next({
        cmd: 'publish', // Comando del paquete
        topic,
        payload: message,
        qos: 0,
        retain: false,
        dup: false,
      } as mqtt.IPublishPacket);
    });

    mqttClient.on('error', (err) => {
      subject.error(err);
    });

    mqttClient.on('close', () => {
      this.logger.log(`MQTT connection closed for userId "${userId}"`);
      // Race condition fix: Only delete if the client being closed is the one currently in the map
      if (this.mqttClients.get(userId) === mqttClient) {
        this.mqttClients.delete(userId);
      }
      subject.complete();
    });

    return subject.asObservable();
  }

  /**
   * @description Forzador de desconexión. Destruye el Socket subyacente de forma graciosa
   * y remueve el puntero del Map local previniendo fugas de Memoria (Memory Leaks).
   * @param {string} userId - Puntero.
   */
  doDisconnectUser(userId: string) {
    const client = this.mqttClients.get(userId);

    client?.end();

    this.mqttClients.delete(userId);
    this.logger.log(`User "${userId}" disconnected from MQTT.`);
  }

  /**
   * @description Subscribe internamente el Cliente Instanciado hacia un Tópico con QoS declarado.
   * @param {InstanceType<typeof mqtt.MqttClient>} mqttClient - Puntero de Librería.
   * @param {string} topic - Wildcard `/username/#` o literal.
   * @param {0 | 1 | 2} [qos=0] - Quality of Service.
   * @returns {Promise<void>}
   */
  public doSubscribe = async (
    mqttClient: InstanceType<typeof mqtt.MqttClient>,
    topic: string,
    qos: 0 | 1 | 2 = 0,
  ): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      mqttClient.subscribe(
        topic,
        { qos } as mqtt.IClientSubscribeOptions,
        (error, granted) => {
          if (error) {
            this.logger.error(
              `MQTT subscribe error for topic "${topic}": ${error}`,
            );
            //reject(error);
            return;
          }
          this.logger.log(
            `MQTT subscribe successfully for topic "${topic}": ${JSON.stringify(granted)}`,
          );
          resolve();
        },
      );
    });
  };

  /**
   * @description Acción asincrónica de Actuador. Transmite un Payload raw a la tubería MQTT.
   * @param {InstanceType<typeof mqtt.MqttClient>} mqttClient - Emisor (Debe ser el Root Worker).
   * @param {string} topic - Tópico exacto objetivo.
   * @param {0 | 1 | 2} [qos=0] - Quality of Service.
   * @param {string} payload - JSON stringified data.
   * @returns {Promise<void>}
   */
  public doPublish = async (
    mqttClient: InstanceType<typeof mqtt.MqttClient>,
    topic: string,
    qos: 0 | 1 | 2 = 0,
    payload: string,
  ): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      mqttClient.publish(
        topic,
        payload,
        { qos } as mqtt.IClientPublishOptions,
        (error) => {
          if (error) {
            this.logger.error(
              `MQTT publish error for topic ${topic}: ${error}`,
            );
            reject(error);
            return;
          } else {
            this.logger.log(
              `MQTT published successfully to topic ${topic}: ${payload}`,
            );
            resolve();
          }
        },
      );
    });
  };

  /**
   * @description Getter directo en el Pool local (Map array) para recuperar el Driver Cliente original activo.
   * @param {string} brokerId - Key identifier (userId).
   * @returns {InstanceType<typeof mqtt.MqttClient> | undefined}
   */
  public getMqttClientById(
    brokerId: string,
  ): InstanceType<typeof mqtt.MqttClient> | undefined {
    return this.mqttClients.get(brokerId);
  }

  /**
   * @description Hook Teardown (`onModuleDestroy`). Invoca el cierre iterativo de la totalidad de sockets vivos.
   * Vital para apagados correctos (SigTerm) evitando conexiones zombis persistentes en EMQX.
   */
  onModuleDestroy() {
    this.mqttClients.forEach((client, userId) => {
      client.end();
      this.logger.log(
        `User "${userId}" disconnected from MQTT during module destruction`,
      );
    });
    this.mqttClients.clear();
  }

  // ─────────────────────────────────────────────────
  //  ROUTER DE MENSAJES POR PAYLOAD TYPE
  // ─────────────────────────────────────────────────

  /**
   * @description Router inteligente basado en el campo `type` del payload JSON.
   * Identifica mensajes de tipo `settings_report` y los enruta al DeviceSettingsService.
   * Los mensajes sin `type` o con `type: "telemetry"` siguen el flujo normal (WebSocket broadcast).
   * Esta estrategia es transparente a cambios de tópicos: no importa cómo el usuario renombre
   * los tópicos MQTT, el backend identifica el propósito del mensaje por su contenido.
   * @param {string} topic - Tópico MQTT de donde llegó el mensaje.
   * @param {Buffer} message - Buffer raw del payload.
   */
  private routeMessage(topic: string, message: Buffer): void {
    try {
      const payload = JSON.parse(message.toString());

      // 1. settings_report (Device -> Cloud update)
      if (payload?.type === 'settings_report' && payload?.device_serial) {
        // Lazy resolve si aún no está disponible
        if (!this.deviceSettingsService) {
          try {
            this.deviceSettingsService = this.moduleRef.get(
              DeviceSettingsService,
              { strict: false },
            );
          } catch {
            this.logger.warn(
              '[Settings Router] DeviceSettingsService not available yet.',
            );
            return;
          }
        }

        this.logger.log(
          `[Settings Router] Received settings_report from device "${payload.device_serial}"`,
        );
        // Procesar asíncronamente sin bloquear el handler MQTT
        this.deviceSettingsService!.upsertDeviceData(
          payload.device_serial,
          payload.settings || {},
        ).catch((err) => {
          this.logger.error(
            `[Settings Router] Error processing settings_report: ${err.message}`,
          );
        });
      }

      // 2. request: get_settings (Device -> Cloud request for data)
      if (
        payload?.type === 'request' &&
        payload?.action === 'get_settings' &&
        payload?.device_serial
      ) {
        if (!this.deviceSettingsService) {
          try {
            this.deviceSettingsService = this.moduleRef.get(
              DeviceSettingsService,
              { strict: false },
            );
          } catch {
            this.logger.warn(
              '[Settings Router] DeviceSettingsService not available yet for request.',
            );
            return;
          }
        }

        this.logger.log(
          `[Settings Router] Received get_settings request from device "${payload.device_serial}"`,
        );

        this.deviceSettingsService!.handleDeviceSyncRequest(
          payload.device_serial,
        ).catch((err) => {
          this.logger.error(
            `[Settings Router] Error status responding to get_settings: ${err.message}`,
          );
        });
      }

      // 3. request: get_certificate (Device -> Cloud request for MQTT CA Cert)
      if (
        payload?.type === 'request' &&
        payload?.action === 'get_certificate' &&
        payload?.device_serial
      ) {
        if (!this.deviceSettingsService) {
          try {
            this.deviceSettingsService = this.moduleRef.get(
              DeviceSettingsService,
              { strict: false },
            );
          } catch {
            this.logger.warn(
              '[Settings Router] DeviceSettingsService not available yet for cert request.',
            );
            return;
          }
        }

        this.logger.log(
          `[Settings Router] Received get_certificate request from device "${payload.device_serial}"`,
        );

        this.deviceSettingsService!.handleCertificateRequest(
          payload.device_serial,
        ).catch((err) => {
          this.logger.error(
            `[Settings Router] Error responding to get_certificate: ${err.message}`,
          );
        });
      }
      // type: "telemetry" o sin type → flujo normal (ya se emite por el subject.next)
    } catch {
      // Si el payload no es JSON válido, ignorar silenciosamente
    }
  }
}
