import type { ModuleOptions } from 'webpack';

type Rules = Required<ModuleOptions>['rules'];

// TypeScript loader — shared by all targets
const tsRule = {
  test: /\.tsx?$/,
  exclude: /(node_modules|\.webpack)/,
  use: {
    loader: 'ts-loader',
    options: {
      transpileOnly: true,
    },
  },
};

// Native module support — only for main process (uses __dirname at runtime)
const nativeRules: Rules = [
  {
    test: /native_modules[/\\].+\.node$/,
    use: 'node-loader',
  },
  {
    test: /[/\\]node_modules[/\\].+\.(m?js|node)$/,
    parser: { amd: false },
    use: {
      loader: '@vercel/webpack-asset-relocator-loader',
      options: {
        outputAssetBase: 'native_modules',
      },
    },
  },
];

// Main process rules: native modules + TypeScript
export const mainRules: Rules = [...nativeRules, tsRule];

// Renderer rules: TypeScript only (no native modules, no __dirname)
export const rendererRules: Rules = [tsRule];

// Keep backward compat export (used by main config)
export const rules = mainRules;
