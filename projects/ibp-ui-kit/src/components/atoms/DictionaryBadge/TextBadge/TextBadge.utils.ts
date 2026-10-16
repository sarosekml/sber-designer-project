/**
 * Converts a full name to initials for an Text Badge.
 * @param fullName - the full name
 * @returns the initials derived from first letters of the last and first name
 * @example
 * // Return "II"
 * convertTextToInitials("Ivanov Ivan")
 */

export function convertTextToInitials(fullName: string): string {
  return fullName
    .split(' ')
    .filter((stringPart) => stringPart)
    .slice(0, 2)
    .map((namePart) => namePart[0].toUpperCase())
    .join('');
}
