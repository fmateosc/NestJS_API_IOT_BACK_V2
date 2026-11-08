// src/config/cors.ts

import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';

export const CORS: CorsOptions = {
  origin: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  credentials: true,
};
