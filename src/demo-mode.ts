export function resolvePublicDemoMode(
  configuredValue: string | undefined,
  isDevelopment: boolean,
): boolean {
  const normalizedValue = configuredValue?.trim().toLowerCase();

  if (!normalizedValue) {
    return isDevelopment;
  }

  return normalizedValue === 'true';
}

export const IS_PUBLIC_DEMO = resolvePublicDemoMode(
  import.meta.env.VITE_PUBLIC_DEMO,
  import.meta.env.DEV,
);
