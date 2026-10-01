export default async function globalTeardown(): Promise<void> {
  const child = globalThis.__EMBEDDED_DB__;
  if (!child) return;
  await new Promise<void>((res) => {
    child.once('exit', () => res());
    child.kill('SIGTERM');
    setTimeout(() => {
      child.kill('SIGKILL');
      res();
    }, 5000).unref();
  });
}
