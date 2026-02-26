import type { Configuration } from 'webpack';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import path from 'path';

import { rendererRules } from './webpack.rules';
import { plugins } from './webpack.plugins';

const rules = [
  ...rendererRules,
  {
    test: /\.css$/,
    use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
  },
];

export const rendererConfig: Configuration = {
  module: {
    rules,
  },
  plugins: [
    ...plugins,
    new CopyWebpackPlugin({
      patterns: [{ from: path.resolve(__dirname, 'assets'), to: 'assets' }],
    }),
  ],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
    alias: {
      '@pixi/tilemap': path.resolve(__dirname, 'node_modules/@pixi/tilemap/lib/index.mjs'),
    },
  },
};
