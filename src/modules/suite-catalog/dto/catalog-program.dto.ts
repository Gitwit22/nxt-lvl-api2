import { PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const CATALOG_STATUSES = ['live', 'beta', 'coming-soon', 'internal', 'archived'] as const;
export const CATALOG_TYPES = ['internal', 'external'] as const;
export const CATALOG_ORIGINS = ['suite-native', 'external-partner'] as const;

export type CatalogStatus = (typeof CATALOG_STATUSES)[number];

// Empty string clears the field; anything else must be an absolute http(s) URL (blocks javascript: links).
const OPTIONAL_HTTP_URL = /^(https?:\/\/[^\s]+)?$/i;
const OPTIONAL_INTERNAL_ROUTE = /^(\/[^\s]*)?$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateCatalogProgramDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(SLUG, { message: 'slug must be lowercase letters, numbers and dashes.' })
  slug?: string;

  /** Accepted for compatibility with the hub's payload; the catalog owner is fixed server-side. */
  @IsOptional()
  @IsString()
  organizationId?: string;

  /** Accepted for compatibility with the hub's payload; ids are assigned server-side. */
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional() @IsString() @MaxLength(500) shortDescription?: string;
  @IsOptional() @IsString() @MaxLength(10_000) longDescription?: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsString() @MaxLength(80) secondaryCategory?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @IsOptional() @IsIn(CATALOG_STATUSES) status?: CatalogStatus;
  @IsOptional() @IsIn(CATALOG_TYPES) type?: (typeof CATALOG_TYPES)[number];
  @IsOptional() @IsIn(CATALOG_ORIGINS) origin?: (typeof CATALOG_ORIGINS)[number];

  @IsOptional() @IsString() @MaxLength(300) @Matches(OPTIONAL_INTERNAL_ROUTE, { message: 'internalRoute must start with /.' }) internalRoute?: string;
  @IsOptional() @IsString() @MaxLength(2048) @Matches(OPTIONAL_HTTP_URL, { message: 'externalUrl must be an http(s) URL.' }) externalUrl?: string;
  @IsOptional() @IsString() @MaxLength(2048) @Matches(OPTIONAL_HTTP_URL, { message: 'logoUrl must be an http(s) URL.' }) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(2048) @Matches(OPTIONAL_HTTP_URL, { message: 'screenshotUrl must be an http(s) URL.' }) screenshotUrl?: string;

  @IsOptional() @IsBoolean() openInNewTab?: boolean;

  @IsOptional() @IsString() @MaxLength(64) accentColor?: string;
  @IsOptional() @IsString() @MaxLength(64) cardBackgroundColor?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) cardBackgroundOpacity?: number;
  @IsOptional() @IsString() @MaxLength(64) cardGlowColor?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) cardGlowOpacity?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) cardHoverTintOpacity?: number;

  @IsOptional() @IsBoolean() adminOnly?: boolean;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsBoolean() requiresLogin?: boolean;
  @IsOptional() @IsBoolean() requiresApproval?: boolean;

  @IsOptional() @IsString() @MaxLength(60) launchLabel?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100_000) displayOrder?: number;
  @IsOptional() @IsString() @MaxLength(5_000) notes?: string;
}

export class UpdateCatalogProgramDto extends PartialType(CreateCatalogProgramDto) {}
