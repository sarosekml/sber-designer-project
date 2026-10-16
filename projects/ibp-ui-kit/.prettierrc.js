const prettierConfig = require('@sber-ibp/core/build/configs/.prettierrc.js');

module.exports = {
  ...prettierConfig,
  quoteProps: 'consistent',
  overrides: [
    {
      files: '*.json',
      options: {
        parser: 'json-stringify',
      },
    },
  ],
};
