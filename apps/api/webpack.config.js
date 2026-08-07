const path = require('path');

module.exports = (options) => {
  // Set transpileOnly: true on ts-loader to skip type checking entirely
  const rules = ((options.module && options.module.rules) || []).map((rule) => {
    if (rule.loader && rule.loader.includes('ts-loader')) {
      return {
        ...rule,
        options: {
          ...(rule.options || {}),
          transpileOnly: true,
        },
      };
    }
    return rule;
  });

  return {
    ...options,
    module: {
      ...(options.module || {}),
      rules: rules.length > 0 ? rules : options.module && options.module.rules,
    },
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
