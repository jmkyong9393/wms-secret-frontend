export function isRequiredFieldFilled(value: string): boolean {
  return value.trim().length > 0;
}

export function doPasswordsMatch(a: string, b: string): boolean {
  return a.length > 0 && a === b;
}
