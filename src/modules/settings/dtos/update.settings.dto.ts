// src/modules/settings/dtos/update.settings.dto.ts

import { PartialType } from "@nestjs/swagger";
import { GeneralSettinsDto } from "./settings.dto.js";

export class UpdaGeneralSettinsDto extends PartialType(GeneralSettinsDto) { }