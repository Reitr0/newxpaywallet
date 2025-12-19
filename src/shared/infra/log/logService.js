// Ultra-simple centralized logger (pure JS, RN/web safe)

const LEVELS = ['silent', 'error', 'warn', 'info', 'debug'];

let cfg = {
  level: 'silent',       // default log level
  json: false,         // print JSON or plain text
  ts: () => new Date().toISOString(),
};

function shouldLog(level) {
  return LEVELS.indexOf(level) <= LEVELS.indexOf(cfg.level);
}

function emit(level, msg, data) {
  if (!shouldLog(level)) return;

  const record = {
    t: cfg.ts(),
    level,
    msg: String(msg ?? ''),
    data: data === undefined ? null : data,
  };

  const prefix = `[${level.toUpperCase()}]`;
  const print = console[level] || console.log;

  if (cfg.json) {
    print(prefix, JSON.stringify(record));
  } else if (record.data != null) {
    const s = typeof record.data === 'string' ? record.data : JSON.stringify(record.data);
    print(prefix, record.msg, s);
  } else {
    print(prefix, record.msg);
  }
}

const logService = {
  error: (msg, data) => emit('error', msg, data),
  warn:  (msg, data) => emit('warn',  msg, data),
  info:  (msg, data) => emit('info',  msg, data),
  debug: (msg, data) => emit('debug', msg, data),

  // global config
  setLevel(level) { if (LEVELS.includes(level)) cfg.level = level; },
  getLevel() { return cfg.level; },
  configure(partial = {}) { cfg = { ...cfg, ...partial }; },
};

export default logService;
