export const emit = (name, detail) => document.dispatchEvent(new CustomEvent(`gx:${name}`, { detail }));

export const on = (name, fn) => {
    const handler = (e) => fn(e.detail ?? {});
    document.addEventListener(`gx:${name}`, handler);
    return () => document.removeEventListener(`gx:${name}`, handler);
};
