export function toTime(n: number): string {
  let h = parseInt(Math.floor(n / 60).toFixed(0));
  let m = n - h * 60;
  return `${h < 10 ? "0" + h : h}:${m < 10 ? "0" + m : m}`;
}

export function fromTime(s: string): number {
  return parseInt(s.split(":")[0]) * 60 + parseInt(s.split(":")[1]);
}
