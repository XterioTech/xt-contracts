export enum Color {
  reset = "\x1b[0m",
  bright = "\x1b[1m",
  red = "\x1b[31m",
  green = "\x1b[32m",
  yellow = "\x1b[33m",
  blue = "\x1b[34m",
  magenta = "\x1b[35m",
  cyan = "\x1b[36m",
  white = "\x1b[37m",
}

export function colorize(color: Color, text: string) {
  return color + text + Color.reset;
}
