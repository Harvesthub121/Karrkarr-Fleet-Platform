const path = require('path');

module.exports = (options) => {
  return {
    ...options,
    resolve: {
      ...options.resolve,
      alias: {
        '@karrkarr/shared': path.resolve(__dirname, '../../packages/shared/src'),
      },
    },
    externals: {
      // Externalize Prisma to prevent bundling native binaries
      '@prisma/client': 'commonjs @prisma/client',
      '.prisma/client': 'commonjs .prisma/client',
    },
  };
};
