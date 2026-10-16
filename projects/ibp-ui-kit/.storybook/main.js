import path from 'path';

const config = {
  core: {
    disableTelemetry: true,
  },
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  typescript: {
    // Off: the project's runtime stub for `@sber-ibp/core` (vendor/sber-ibp-core)
    // is intentionally typed as `any` for everything. Storybook's TS checker
    // would emit ~135 noise warnings against the loose generics. Production
    // builds still type-check via Rollup + tsc.
    check: false,
    checkOptions: {},
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      skipPropsWithName: ['dataTestId', 'formId', 'onClick', 'onChange'],
      skipPropsWithoutDoc: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },

  addons: [
    '@storybook/addon-webpack5-compiler-swc',
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    'storycap',
  ],

  webpackFinal: async (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@/*': path.resolve(__dirname, '../src/*'),
    };
    config.module.rules = [
      ...config.module.rules.map((rule) => {
        if (/svg/.test(rule.test)) {
          // Silence the Storybook loaders for SVG files
          return {
            ...rule,
            exclude: /\.svg$/i,
          };
        }
        return rule;
      }),
      // Add your custom SVG loader
      {
        test: /\.svg$/i,
        use: ['@svgr/webpack'],
      },
    ];

    // sber-designer sandbox preview hardening.
    // A Webpack-HMR stale hot-update (`runtime_main.<hash>.hot-update.json` 404)
    // makes the HMR runtime call `location.reload()`, which blanks the embedded
    // canvas mid-render. Disable HMR for the sandbox build so the preview stays
    // rendered. Gated on SBER_DESIGNER_SANDBOX so a local `storybook dev` keeps
    // hot-reload for normal development. See sber-designer docs:
    // docs/how-it-works/project-requirements.md → "The HMR blank-canvas trap".
    if (process.env.SBER_DESIGNER_SANDBOX) {
      config.plugins = (config.plugins || []).filter(
        (p) => !p || p.constructor?.name !== 'HotModuleReplacementPlugin',
      );
      const stripHmrEntry = (entry) =>
        Array.isArray(entry)
          ? entry.filter((e) => !/webpack-hot-middleware|webpack\/hot|[\\/]hmr/i.test(String(e)))
          : entry;
      if (config.entry && typeof config.entry === 'object' && !Array.isArray(config.entry)) {
        for (const key of Object.keys(config.entry)) {
          config.entry[key] = stripHmrEntry(config.entry[key]);
        }
      } else if (Array.isArray(config.entry)) {
        config.entry = stripHmrEntry(config.entry);
      }
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/node_modules/**', '**/.sber-designer/**', '**/.git/**'],
      };
    }

    return config;
  },

  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
};
export default config;
