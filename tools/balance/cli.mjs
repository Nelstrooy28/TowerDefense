import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const mod = await server.ssrLoadModule('/tools/balance/run.ts');
  const code = mod.runBalanceSuite();
  await server.close();
  process.exit(code);
} catch (err) {
  console.error('Balance suite error:', err);
  await server.close();
  process.exit(1);
}
