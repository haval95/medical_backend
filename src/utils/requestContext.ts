import { AsyncLocalStorage } from 'node:async_hooks';
import type { Role } from '@prisma/client';

interface RequestActor {
  userId: string;
  role: Role;
}

interface RequestContextState {
  actor?: RequestActor;
  ipAddress?: string;
  userAgent?: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContextState>();

export const runWithRequestContext = <T>(
  state: RequestContextState,
  callback: () => T
) => requestContextStorage.run(state, callback);

export const getRequestContext = () => requestContextStorage.getStore();

export const setRequestActor = (actor: RequestActor) => {
  const store = requestContextStorage.getStore();

  if (!store) {
    return;
  }

  store.actor = actor;
};
