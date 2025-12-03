const isDev = process.env.NODE_ENV !== "production";

module.exports = {
  info: (...args) => console.log("[INFO]", ...args),
  error: (...args) => console.error("[ERROR]", ...args),
  debug: (...args) => {
    if (isDev) console.debug("[DEBUG]", ...args);
  },
};
