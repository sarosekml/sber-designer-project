import url from '@rollup/plugin-url';
import createRollupConfig from '@sber-ibp/core/build/configs/rollup.config.mjs';

const rollupConfig = createRollupConfig();

const plugins = [
    ...rollupConfig.plugins,
    /** To load any assets files - fonts, images or other no code files */
    url({
        include: ['**/*.woff2'],
        emitFile: true,
        limit: Infinity,
    }),
];
rollupConfig.plugins = plugins;

export default rollupConfig;
