module.exports = {
  target: 'node',
  externals: ['pg', 'sqlite3', 'tedious', 'pg-hstore'], // we dont' actually use these
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
  entry: {
    index: './src/index.js',
    load: './src/load.js'
  }
};
