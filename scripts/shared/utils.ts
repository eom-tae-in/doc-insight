import * as fs from 'fs';

export function loadEnv(path: string = '.env'): Record<string, string> {
  const envFile = fs.readFileSync(path, 'utf-8');
  const env: Record<string, string> = {};

  envFile.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const [key, ...valueParts] = trimmed.split('=');
    let value = valueParts.join('=');
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  });

  return env;
}
