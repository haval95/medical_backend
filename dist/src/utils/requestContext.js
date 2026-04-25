import { AsyncLocalStorage } from 'node:async_hooks';
const requestContextStorage = new AsyncLocalStorage();
export const runWithRequestContext = (state, callback) => requestContextStorage.run(state, callback);
export const getRequestContext = () => requestContextStorage.getStore();
export const setRequestActor = (actor) => {
    const store = requestContextStorage.getStore();
    if (!store) {
        return;
    }
    store.actor = actor;
};
