const COLORS = {
  reset: "\x1b[0m",

  // Text colors
  red: "\x1b[1;31m",
  green: "\x1b[1;32m",
  yellow: "\x1b[1;33m",
  blue: "\x1b[1;34m",
  magenta: "\x1b[1;35m",
  cyan: "\x1b[1;36m",

  // Background colors
  bgRed: "\x1b[1;41m",
  bgGreen: "\x1b[1;42m",
  bgYellow: "\x1b[1;43m",
  bgBlue: "\x1b[1;44m",
  bgMagenta: "\x1b[1;45m",
  bgCyan: "\x1b[1;46m",
};

const Log = new Proxy({}, {
  get(_, color) {
    return (...args) => {
      const colorCode = COLORS[color] || "";
      const resetCode = COLORS.reset;
      console.log(`${colorCode}${args.join(" ")}${resetCode}`);
    };
  }
});

module.exports = Log;
