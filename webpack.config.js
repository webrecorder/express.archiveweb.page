/*eslint-env node */
//const path = require("path");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");

const PACKAGE = require("./package.json");
const AWP_PACKAGE = require("./node_modules/@webrecorder/archivewebpage/package.json");
const WARCIO_PACKAGE = require("./node_modules/warcio/package.json");

const DEFAULT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6ZXRocjoweDREMEMxYjlCNzdDOTYxMTA4NkU2NDMzOTI0NDM3Rjc1MGRBNjVlNTciLCJpc3MiOiJ3ZWIzLXN0b3JhZ2UiLCJpYXQiOjE2NDYyOTExMjU3MzAsIm5hbWUiOiJhd3BleHByZXNzIn0.oxSNKwda3IhOxfyjaq8Jva7RblPilsPMa9vV8bkzWVI";

const TOKEN = process.env.TOKEN || DEFAULT_TOKEN;

const RWP_PREFIX = "https://cdn.jsdelivr.net/npm/replaywebpage@1.7.2/";

module.exports = {
  target: "web",
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
      __TOKEN__: JSON.stringify(TOKEN),
      __AWP_EXPRESS_VERSION__: JSON.stringify(PACKAGE.version),
      __AWP_VERSION__: JSON.stringify(AWP_PACKAGE.version),
      __WARCIO_VERSION__: JSON.stringify(WARCIO_PACKAGE.version),
      __RWP_PREFIX__ : JSON.stringify(RWP_PREFIX),
    }),
    new webpack.ProvidePlugin({
      process: "process/browser.js",
      Buffer: ["buffer", "Buffer"],
    }),

    new CopyPlugin({
      patterns: [
        // Copy Shoelace assets to dist/shoelace
        {
          from: "node_modules/@shoelace-style/shoelace/dist/assets",
          to: "shoelace/assets"
        },
        {
          from: "node_modules/browsertrix-behaviors/dist/behaviors.js",
          to: "assets/behaviors.js"
        }
      ]
    })
  ],


  module: {
    rules: [
      {
        test: /wombat.js|wombatWorkers.js|index.html$/i,
        use: ["raw-loader"],
      },
      {
        test: /\.css$/,
        use: [
          "style-loader",
          { loader: "css-loader", options: { importLoaders: 1 } },
          "postcss-loader",
        ],
      }
    ]
  },

  externals: {
    "bufferutil": "bufferutil",
    "utf-8-validate": "utf-8-validate",
  }



};
