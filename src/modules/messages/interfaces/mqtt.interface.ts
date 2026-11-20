// src/modules/messages/interfaces/mqtt.interface.ts

export interface IMqttMessage {
  publish_received_at: number;
  pub_props: {
    'User-Property': Record<string, unknown>;
  };
  qos: number;
  topic: string;
  clientid: string;
  client_attrs: Record<string, unknown>;
  peerhost: string;
  payload: string;
  username: string;
  event: string;
  peername: string;
  timestamp: number;
  node: string;
  id: string;
  flags: {
    retain: boolean;
    dup: boolean;
  };
}
