export function routeParam(value: string | string[] | undefined, name: string): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  if (!value) {
    throw new Error(`Missing route parameter: ${name}`);
  }

  return value;
}
