const path = require('path');

module.exports = {
  target: 'node',
  externals: ['pg', 'sqlite3', 'tedious', 'pg-hstore', 'base-plugins'], // we dont' actually use these
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader"
        }
      }
    ]
  },
  resolve: {
    alias: {
      'base-plugins': path.resolve(__dirname, 'node_modules/base-plugins/index.js'),
    },
    extensions: [ '.js', '.json' ],
    modules: [ './src', path.join(__dirname, 'node_modules') ],
  },
  entry: {
    load: './src/load.js'
  },
  output: {
    path: `${__dirname}/dist`,
    filename: 'load.js'
  },
};
