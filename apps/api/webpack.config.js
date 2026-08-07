const path = require('path');

module.exports = (options) => {
  return {
    ...options,
    bail: false, // Emit output even when there are TypeScript errors
    resolve: {
      ...(options.resolve || {}),
      alias: {
        ...((options.resolve && options.resolve.alias) || {}),
        '@karrkarr/shared': path.resolve(__dirname, '../../packages/shared/src'),
      },
    },
    externals: {
      '@prisma/client': 'commonjs @prisma/client',
      '.prisma/client': 'commonjs .prisma/client',
    },
  };
};
