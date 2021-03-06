var util = require('util');
var _ = require('lodash');

var ConfigError = function ConfigError(message, extra) {
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.message = message;
    this.extra = extra;
};

util.inherits(ConfigError, Error);

function createConfig(config) {
    var env = process.env;

    _.defaults(config || {}, {
        username: env.TUNNELSSH_USER || env.USER || env.USERNAME || 'root',
        port: 22,
        host: null,
        srcPort: 0,
        srcHost: '127.0.0.1',
        dstPort: null,
        dstHost: '127.0.0.1',
        localHost: '127.0.0.1',
        localPort: config.dstPort,
        agent: process.env.SSH_AUTH_SOCK
    });

    if (!config.host) {
        throw new ConfigError('host not set');
    }

    if (!config.dstPort) {
        throw new ConfigError('dstPort not set');
    }

    if (!config.password && !config.privateKey) {
        config.agent = config.agent || process.env.SSH_AUTH_SOCK;
    }

    if (config.localPort === undefined) {
        config.localPort = config.dstPort;
    }
    
    // use to generate random port
    if (config.localPortFunc && _.isFunction(config.localPortFunc)){
        config.localPort = config.localPortFunc();
    }


    return config;
}

module.exports = createConfig;
