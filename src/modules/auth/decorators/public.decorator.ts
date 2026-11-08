// src/modules/auth/decorator/public.decorator.ts

import { SetMetadata } from "@nestjs/common";
import { PUBLIC_KEY } from "../../../constants/key-decorators.js";


export const PublicAccess = () => SetMetadata(PUBLIC_KEY, true);