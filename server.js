'use strict';

const composer = require('./index');

const main = async () => {
  const server = await composer();

  await server.start();
  server.log('info', `Server running at: ${server.info.uri}`);

  process.on('SIGTERM', async () => {
    server.log('info', 'Received SIGTERM. Attempting to stop server');
    await server.stop({ timeout: 10000 });
    server.log('info', 'Server stopped. Exiting');
    process.exit(0);
  });
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
