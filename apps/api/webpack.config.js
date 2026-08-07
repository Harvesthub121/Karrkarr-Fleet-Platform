const path = require('path');

module.exports = (options) => {
  const sharedSrc = path.resolve(__dirname, '../../packages/shared/src');

  // Override ALL ts-loader rules to use transpileOnly mode
  const rules = ((options.module && options.module.rules) || []).map((rule) => {
    // Handle both direct loader and use array formats
    if (rule.loader && typeof rule.loader === 'string' && rule.loader.includes('ts-loader')) {
      return { ...rule, options: { ...(rule.options || {}), transpileOnly: true } };
    }
    if (Array.isArray(rule.use)) {
      return {
        ...rule,
        use: rule.use.map((u) => {
          if (typeof u === 'object' && u.loader && u.loader.includes('ts-loader')) {
            return { ...u, options: { ...(u.options || {}), transpileOnly: true } };
          }
          if (typeof u === 'string' && u.includes('ts-loader')) {
            return { loader: u, options: { transpileOnly: true } };
          }
          return u;
        }),
      };
    }
    return rule;
  });

  return {
    ...options,
    bail: false, // Don't stop on first error — emit output regardless
    module: {
      ...(options.module || {}),
      rules: rules.length > 0 ? rules : (options.module && options.module.rules) || [],
    },
    resolve: {
      ...(options.resolve || {}),
      alias: {
        ...((options.resolve && options.resolve.alias) || {}),
        '@karrkarr/shared': sharedSrc,
      },
    },
    externals: {
      '@prisma/client': 'commonjs @prisma/client',
      '.prisma/client': 'commonjs .prisma/client',
    },
  };
};
