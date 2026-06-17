import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function parseCorsOrigin(): string | string[] | boolean {
  const value = process.env.CORS_ORIGIN?.trim();
  if (!value || value === '*') return true;
  if (value.includes(',')) {
    return value.split(',').map((origin) => origin.trim()).filter(Boolean);
  }
  return value;
}

export const env = {
  HOST: process.env.HOST ?? '0.0.0.0',
  PORT: parseInt(process.env.PORT ?? '4000', 10),
  DATABASE_URL: required('DATABASE_URL'),
  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '12h',
  CORS_ORIGIN: parseCorsOrigin(),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
};
