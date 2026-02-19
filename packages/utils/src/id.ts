export function generateId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  const id = `${timestamp}-${random}`;
  return prefix ? `${prefix}_${id}` : id;
}

export function isValidId(id: string): boolean {
  return /^[a-z0-9_-]+$/i.test(id) && id.length > 0 && id.length <= 128;
}
