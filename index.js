var net = require('net');
var _ = require('lodash');
var Connection = require('ssh2');

function createConfig(userConfig) {
    var env = process.env;

    var config = _.defaults(userConfig || {}, {
        username: env.TUNNELSSH_USER || env.USER || env.USERNAME,
        sshPort: 22,
        srcPort: 0,
        srcHost: 'localhost',
        dstPort: null,
        dstHost: 'localhost',
        localHost: 'localhost'

    });
    if (!config.password && !config.privateKey) {
        config.agent = config.agent || process.env.SSH_AUTH_SOCK;
    }

    if (!config.dstPort || !config.dstHost || !config.host) {
        throw new Error('invalid configuration.')
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

function bindSSHConnection(config, server, netConnection) {

    var sshConnection = new Connection();
    server.emit('sshConnection', sshConnection, netConnection, server);
    sshConnection.on('ready', function() {

        sshConnection.forwardOut(
            config.srcHost,
            config.srcPort,
            config.dstHost,
            config.dstPort, function(err, sshStream) {
                if (err) {
                    throw err;
                }
                sshStream.once('close', function() {
                    if (!config.keepAlive) {
                        sshConnection.end();
                        netConnection.end();
                        server.close();
                    }
                });
                server.emit('sshStream', sshStream, sshConnection, netConnection, server);
                netConnection.pipe(sshStream).pipe(netConnection);
            });
    });
    return sshConnection;
}

function createListener(server) {
    server._conns = [];
    server.on('sshConnection', function(sshConnection, netConnection, server) {
        server._conns.push(sshConnection, netConnection);
    });
    server.on('close', function() {
        server._conns.forEach(function(connection) {
            connection.end();
        });
    });
    return server;
}

function tunnel(configArgs, callback) {
    var config = createConfig(configArgs);
    var server = net.createServer(function(netConnection) {
        server.emit('netConnection', netConnection, server);
        var sshConnection = bindSSHConnection(config, server, netConnection);
        if(config["keyboard-interactive"])
            sshConnection.on("keyboard-interactive", config["keyboard-interactive"]);
        sshConnection.connect(config);
    });
    server.on('error', function (e) {
        if (e.code == 'EADDRINUSE') {
            if (config.localPortFunc && _.isFunction(config.localPortFunc)){
                config.localPort = config.localPortFunc();
                server.listen(config.localPort, config.localHost, callback);
                return;
            }
        }
        callback(e)
    });
    
    var trySsh = new Connection();
    trySsh.on("error",function(err){
        callback(err);
    });
    trySsh.on('ready', function(){
        trySsh.end();
        createListener(server).listen(config.localPort, config.localHost);    
    });
    trySsh.connect(config);

    return server;
}

module.exports = tunnel;
