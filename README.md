
## Instalaciones
```bash
$ npm install --save @nestjs/typeorm typeorm pg @nestjs/config
$ npm install class-validator class-transformer
$ npm add @nestjs/mapped-types
# Instalar el paquete de encriptación
$ npm add bcrypt 
$ npm add -D @types/bcrypt
# Instalar JWT
$ npm add jsonwebtoken
$ npm add -D @types/jsonwebtoken
# Servicios http axios
$ npm install --save @nestjs/axios axios
# Servicios de libreria MQTTjs
$ npm install mqtt
# schedules jobs nestjs
$ npm install --save @nestjs/schedule
# formateo de fecha y hora 
$ npm i moment-timezone
# Wensockets
$ npm install @nestjs/websockets@11 @nestjs/platform-socket.io@11
# Mail
$ npm install @nestjs-modules/mailer nodemailer
npm i nodemailer @types/nodemailer
## Nuevo en la API Update

```
## Users
```bash
$ nest g mo modules/users/users --flat --no-spec
$ nest g s modules/users/services/users --flat --no-spec
$ nest g co modules/users/controllers/users --flat --no-spec
```

## Authentication
```bash
$ nest g mo modules/auth/auth --flat --no-spec
$ nest g s modules/auth/services/auth --flat --no-spec
$ nest g co modules/auth/controllers/auth --flat --no-spec
```

## Guard
```bash
$ nest g gu modules/auth/guard/auth --flat --no-spec
$ nest g gu modules/auth/guard/access-level --flat --no-spec
```

## Devices
```bash
$ nest g mo modules/devices/devices --flat --no-spec
$ nest g s modules/devices/services/devices --flat --no-spec
$ nest g co modules/devices/controllers/devices --flat --no-spec
```

## Settings
```bash
$ nest g mo modules/settings/settings --flat --no-spec
$ nest g s modules/settings/services/settings --flat --no-spec
$ nest g co modules/settings/controllers/settings --flat --no-spec
```

## API Services providers HTTP API
```bash
$ nest g mo modules/providers/httpProvider --flat --no-spec
$ nest g s modules/providers/http/emqx-api --flat --no-spec
```

## Messages
```bash
$ nest g mo modules/messages/messages --flat --no-spec
$ nest g s modules/messages/services/messages --flat --no-spec
$ nest g co modules/messages/controllers/messages --flat --no-spec
```

## API Services providers MQTT
```bash
$ nest g mo modules/providers/mqttProvider --flat --no-spec
$ nest g s modules/providers/mqtt/mqtt --flat --no-spec
```
## Schedules (Task)
```bash
$ nest g mo modules/schedules/task/task --flat --no-spec
$ nest g s modules/schedules/task/services/task --flat --no-spec
$ nest g co modules/schedules/task/controllers/task --flat --no-spec
```
### Websockets Services provider
#### Instalaciones
* https://docs.nestjs.com/websockets/gateways
* https://socket.io/

```bash
$ nest g mo modules/providers/websocketsProvider --flat --no-spec
$ nest g s modules/providers/websockets/websockets --flat --no-spec
```
## Migrations
```bash
$ npm run migration:generate
$ npm run migration:run
```

## Docker
```bash
### Compilar la imagen en local sin cache
$ docker build --no-cache -t irrigation-api:0.0.1 .
### Ejecutar contenedor desde imagen local
$ docker container run --restart=always -d -e POSTGRES_PASSWORD=Passw0rd123* -e JWT_SECRET=eSTEesmisecretcode2025* -e DATABASE_HOST=192.168.0.9 -e DATABASE_PORT=5434 -p 9001:3000 -p 9443:3443 --name irrigation_api_local irrigation-api:0.0.1
### Compilar y subir a Docker hub
$ docker buildx build --platform=linux/amd64,linux/arm64 --build-arg NODE_VERSION=22.13.1-slim -t iothost/api-irrigation:1.0.0 --push .
### Ejecutar contenedor desde Docker hub
docker container run --restart=always -d -e POSTGRES_PASSWORD=Passw0rd123* -e JWT_SECRET=eSTEesmisecretcode2025* -e DATABASE_HOST=192.168.0.10 -e DATABASE_PORT=5434 -p 9001:3000 -p 9443:3443 --name irrigation_api_hub iothost/api-irrigation:1.0.0
### Ejecutar contenedor Docker Hub env file
docker container run --restart=always -d --env-file=.env.prod -p 9002:3000 -p 9444:3443 --name irrigation_api_hub_02 iothost/api-irrigation:latest
```