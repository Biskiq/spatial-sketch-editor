interface ImportMetaEnv {
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __nativeFormLab?: { snapshot: () => unknown };
}
