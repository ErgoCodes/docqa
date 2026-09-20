export interface AppDependencies {
  close: () => Promise<void>;
}

export function createNoopDependencies(): AppDependencies {
  return { close: () => Promise.resolve() };
}
