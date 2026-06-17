
const unhandledExceptionLogger = require('./src/logger')('UnhandledException');

try {
  const app = require('./app');
  const port = 3000;

  app.listen(port, () => console.log(`Arquivo.pt webapp started on port ${port}!`));
} catch (err) {
  unhandledExceptionLogger.error(err.stack);
}
