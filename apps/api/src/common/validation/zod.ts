import { applyDecorators, type PipeTransform } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { toValidationIssues } from '@musicverse/validation';
import { z } from 'zod';
import { AppError } from '../errors/app-error';

/** Validates and transforms a value with a Zod schema; failures become `400 VALIDATION_FAILED`. */
export class ZodValidationPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      throw AppError.badRequest('VALIDATION_FAILED', 'Some fields are invalid.', toValidationIssues(result.error));
    }
    return result.data;
  }
}

export const zodPipe = <S extends z.ZodType>(schema: S) => new ZodValidationPipe(schema);

type JsonSchema = Record<string, unknown>;

/** OpenAPI JSON schema for a Zod schema's *input* shape. */
export function toOpenApiSchema(schema: z.ZodType): JsonSchema {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any', target: 'openapi-3.0' }) as JsonSchema;
  delete json.$schema;
  return json;
}

/** Documents a Zod-validated request body in OpenAPI. */
export const ApiZodBody = (schema: z.ZodType) => ApiBody({ schema: toOpenApiSchema(schema) as never });

/** Documents the properties of a Zod-validated query object in OpenAPI. */
export function ApiZodQuery(schema: z.ZodType) {
  const json = toOpenApiSchema(schema) as { properties?: Record<string, JsonSchema>; required?: string[] };
  const decorators = Object.entries(json.properties ?? {}).map(([name, propSchema]) =>
    ApiQuery({ name, required: json.required?.includes(name) ?? false, schema: propSchema as never }),
  );
  return applyDecorators(...decorators);
}
