const webpack = require('webpack')
const path = require('path')
const { CleanWebpackPlugin } = require("clean-webpack-plugin")

module.exports = {
    mode: process.env.NODE_ENV,
    entry: './src/index.ts',
    context: __dirname,
    resolve: {
        extensions: ['.ts', '.js'],
        fallback: {
            fs: false,
            crypto: false,
            buffer: require.resolve('buffer'),
            path: require.resolve('path-browserify'),
            events: require.resolve('events')
        }
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                loader: 'ts-loader'
            }
        ],
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
                APP_ENV: JSON.stringify('browser')
            },
        }),
        new CleanWebpackPlugin(),
    ],
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'index.min.js',
        globalObject: 'this',
        library: {
            name: 'ParseToAnki',
            type: 'umd',
        },
    },
    target: 'web',
    devtool: process.env.NODE_ENV === 'development' ? 'source-map' : false,
}
