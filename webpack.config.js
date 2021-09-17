const path = require('path')
module.exports = {
  entry: {
    catalog: path.join(__dirname, '/src/public_src/catalog.js'),
    catalog_edit: path.join(__dirname, '/src/public_src/catalog_edit.js'),
    track_all: path.join(__dirname, '/src/public_src/track_all.js')
  },
  output: {
    filename: '[name].js',
    path: path.join(__dirname, '/src/public')
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      }
    ]
  }
}
