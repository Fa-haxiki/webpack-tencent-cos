'use strict';

const fs = require('fs');
const COS = require('cos-nodejs-sdk-v5');
const path = require('path');
const ora = require('ora');

/**
 * @type {RegExp}
 */
const REGEXP_HASH = /\[hash(?::(\d+))?\]/gi;

/**
 * @description Uploading progress tip
 * @param uploaded {number}
 * @param total {number}
 * @returns {string}
 */
const tip = (uploaded, total) => {
    let percentage = total === 0 ? 0 : Math.round((uploaded / total) * 100);
    return `Uploading to Tencent COS: ${percentage === 0 ? '' : percentage + '% '}${uploaded}/${total} files uploaded`;
};

/**
 * @description Replace path variable by hash with length
 * @param replacer {function}
 * @returns {function}
 */
const withHashLength = (replacer) => {
    return function(_, hashLength) {
        const length = hashLength && parseInt(hashLength, 10);
        const hash = replacer.apply(this, arguments);
        return length ? hash.slice(0, length) : hash;
    };
};

/**
 * @description Perform hash replacement
 * @param value {string|undefined|null}
 * @param allowEmpty {boolean|undefined}
 * @returns {function(string): (string|string)}
 */
const getReplacer = (value, allowEmpty) => {
    return function(match) {
        // last argument in replacer is the entire input string
        const input = arguments[arguments.length - 1];
        if (value === null || value === undefined) {
            if (!allowEmpty)
                throw new Error(`Path variable ${match} not implemented in this context of qn-webpack plugin: ${input}`);
            return '';
        } else {
            return `${value}`;
        }
    };
};

/**
 * @description exports CosPlugin
 * @type {CosPlugin}
 */
module.exports = class CosPlugin {
    /**
     * @param options {{
     *     path: string,
     *     batch: number,
     *     secretId: string,
     *     secretKey: string,
     *     bucket: string,
     *     region: string,
     *     setCosPath: (filePath: string) => string,
     * }}
     */
    constructor(options) {
        this.options = Object.assign({}, options);
    }

    apply(compiler) {
        /**
         * @inheritDoc https://webpack.docschina.org/api/compiler-hooks/#afteremit
         */
        compiler.hooks.afterEmit.tap('CosPlugin', (compilation) => {
            let basePath = path.basename(compiler.outputPath);
            let assets = compilation.assets;
            let hash = compilation.hash;
            let uploadPath = this.options.path || '[hash]';
            let batch = this.options.batch || 20;
            let cos = new COS({
                SecretId: this.options.secretId,
                SecretKey: this.options.secretKey,
                FileParallelLimit: batch,
                ChunkParallelLimit: batch
            });
            let bucket = this.options.bucket;
            let region = this.options.region;
            uploadPath = uploadPath.replace(REGEXP_HASH, withHashLength(getReplacer(hash)));

            let filesNames = Object.keys(assets);
            let totalFiles = 0;
            let uploadedFiles = 0;
            let setCosPath = this.options.setCosPath;

            /**
             * @description Mark finished
             * @param err {string}
             * @private
             */
            let _finish = err => {
                spinner.stop();
                if (err) {
                    // eslint-disable-next-line no-console
                    console.log('\n upload fail', err);
                    process.exit(1);
                    return;
                }
                // eslint-disable-next-line no-console
                console.log('\n all files upload success');
            };

            totalFiles = filesNames.length;

            // eslint-disable-next-line no-console
            console.log('\n');
            let spinner = ora({
                text: tip(0, totalFiles),
                color: 'green'
            }).start();

            /**
             * @description Perform upload to cos
             * @param fileName {string}
             * @returns {Promise<unknown>}
             */
            const performUpload = function(fileName) {
                let file = assets[fileName] || {};
                fileName = basePath + '/' + fileName.replace(/\\/g, '/');
                let key = path.posix.join(uploadPath, fileName);

                return new Promise((resolve, reject) => {
                    let begin = Date.now();
                    const finalKey = setCosPath ? setCosPath(key) : key;
                    // eslint-disable-next-line no-console
                    console.log('uploadPath=', finalKey);
                    cos.putObject(
                        {
                            Bucket: bucket,
                            Region: region,
                            Key: finalKey,
                            Body: fs.createReadStream(fileName),
                            ContentLength: file._size,
                        },
                        function(err, body) {
                            uploadedFiles++;
                            spinner.text = tip(uploadedFiles, totalFiles);

                            if (err) return reject(err);
                            body.duration = Date.now() - begin;
                            resolve(body);
                        }
                    );
                });
            };

            /**
             * @description Execute stack according to `batch` option
             * @param err
             * @returns {Promise<never>|Promise<unknown>|Promise<void>}
             */
            const execStack = function(err) {
                if (err) {
                    // eslint-disable-next-line no-console
                    console.log('\n');
                    return Promise.reject(err);
                }

                /**
                 * @description Get 20|{batch} files
                 */
                let _files = filesNames.splice(0, batch);

                if (_files.length) {
                    return Promise.all(_files.map(performUpload)).then(() => execStack(), execStack);
                } else {
                    return Promise.resolve();
                }
            };

            execStack().then(() => _finish(), _finish);
        });
    }
};
