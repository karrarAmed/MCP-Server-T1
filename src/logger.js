function ts() {
  return new Date().toISOString();
}

export const log = {
  info(scope, msg, meta) {
    if (meta !== undefined) console.log(`[${ts()}] [INFO] [${scope}]`, msg, meta);
    else console.log(`[${ts()}] [INFO] [${scope}]`, msg);
  },
  warn(scope, msg, meta) {
    if (meta !== undefined) console.warn(`[${ts()}] [WARN] [${scope}]`, msg, meta);
    else console.warn(`[${ts()}] [WARN] [${scope}]`, msg);
  },
  error(scope, msg, err) {
    console.error(`[${ts()}] [ERROR] [${scope}]`, msg, err?.stack || err);
  },
};
