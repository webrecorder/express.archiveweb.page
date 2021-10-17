/*eslint-env node */

const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");


module.exports = {
  entry: {
    main: "./src/index.js",
    sw: "./src/sw/sw.js",
  },
  output: {
    filename: "[name].js",
    path: __dirname,
    libraryTarget: "self",
    globalObject: "self",
  },

  resolve: {
    fallback: {
      "stream": require.resolve("stream-browserify"),
    }
  },

  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      }),
    ],
  },

  plugins: [
    new webpack.BannerPlugin("[name].js is part of Webrecorder project. Copyright (C) 2020-2021, Webrecorder Software. Licensed under the Affero General Public License v3."),
    new webpack.DefinePlugin({
      __IPFS_CORE_URL__: JSON.stringify("https://cdn.jsdelivr.net/npm/ipfs-core@0.11.1/dist/index.min.js")
    }),
    new webpack.ProvidePlugin({
      process: "process/browser",
      Buffer: ["buffer", "Buffer"],
    }),
  ],


  module: {
    rules: [
      {
        test: /wombat.js|wombatWorkers.js|index.html$/i,
        use: ["raw-loader"],
      }
    ]
  },

  externals: {
    "bufferutil": "bufferutil",
    "utf-8-validate": "utf-8-validate",
  }



};
