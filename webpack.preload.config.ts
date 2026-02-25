import type { Configuration } from 'webpack';

import { rendererRules } from './webpack.rules';

export const preloadConfig: Configuration = {
  module: {
    rules: rendererRules,
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.json'],
  },
};
