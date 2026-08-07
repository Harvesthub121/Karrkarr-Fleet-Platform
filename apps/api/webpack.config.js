const path = require('path');

module.exports = (options) => {
  const sharedSrc = path.resolve(__dirname, '../../packages/shared/src');

  return {
    ...options,
    resolve: {
      ...options.resolve,
      alias: {
        ...((options.resolve && options.resolve.alias) || {}),
        '@karrkarr/shared': sharedSrc,
      },
      extensions: ['.ts', '.js'],
    },
    externals: [
      function ({ request }, callback) {
        // Bundle @karrkarr/shared inline (resolve via alias above)
        if (request === '@karrkarr/shared' || (request && request.startsWith('@karrkarr/shared/'))) {
          return callback();
        }
        // Externalize everything else in node_modules
        if (request && !request.startsWith('.') && !path.isAbsolute(request)) {
          return callback(null, 'commonjs ' + request);
        }
        callback();
      },
    ],
  };
};
