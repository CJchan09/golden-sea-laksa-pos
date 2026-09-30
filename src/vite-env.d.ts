/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_DEMO?: string;
  readonly VITE_ANDROID_APP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
