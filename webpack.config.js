
const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
    target: 'node',
    context: path.join(__dirname, './src'),
    entry: './cli.ts',
    output: {
        filename: 'bundle.js',
        path: path.join(__dirname, 'dist')
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
        alias: {
            '@': path.join(__dirname, 'src'),
            'root': path.join(__dirname, './')
        }
    },
    externals: [nodeExternals()]
}