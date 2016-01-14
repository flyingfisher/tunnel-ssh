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

function bindSSHConnection(connObj, config, server, netConnection) {
    connObj.sshStream.once('close', function() {
        if (!config.keepAlive) {
            connObj.sshConnection.end();
            netConnection.end();
            server.close();
        }
    });
    server.emit('sshStream', connObj.sshStream, connObj.sshConnection, netConnection, server);
    netConnection.pipe(connObj.sshStream).pipe(netConnection);
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

var sshConnectionPool = [];
function buildSSHConnectionPool(config, size, callback){
    if (!size){
        if (callback)
            callback();
        return;
    }
    
    _.times(size, function(n){
        createSSHConnection(config, function(connObj){
            if (n === (size - 1)){
                if(callback)
                    callback();
            }
            
            sshConnectionPool.push(connObj);
        })
    })
}

function createSSHConnection(config, callback){
    var sshConnection = new Connection();
        sshConnection.on("error", function(err){
            throw err;
        });
        sshConnection.on('ready', function(){
            sshConnection.forwardOut(
                config.srcHost,
                config.srcPort,
                config.dstHost,
                config.dstPort, function(err, sshStream) {
                    if(err){
                        throw err;
                    }
                    
                    callback({
                        sshConnection:sshConnection,
                        sshStream:sshStream
                    })
                })
        });

        if(config["keyboard-interactive"])
            sshConnection.on("keyboard-interactive", config["keyboard-interactive"]);

        sshConnection.connect(config);
}

function tunnel(configArgs, options, callback) {
    var config = createConfig(configArgs);
    var server = net.createServer(function(netConnection) {
        server.emit('netConnection', netConnection, server);
        var connObj = sshConnectionPool.pop();
        if (!connObj) {
            createSSHConnection(config, function(connObj){
                bindSSHConnection(connObj, config, server, netConnection);
            });
        } else {
            bindSSHConnection(connObj, config, server, netConnection);
        }
    });
    
    function handleAddressError(err){
        if (err.code == 'EADDRINUSE') {
            if (config.localPortFunc && _.isFunction(config.localPortFunc)){
                config.localPort = config.localPortFunc();
                return true;
            }
        }
        
        return false;
    }
    
    server.on("error", function(err){
        if (err && handleAddressError(err)){
            server.listen(config.localPort, config.localHost, callback);
        } else {
            callback(err);
        }
    });
    
    if(options.try){
        var trySsh = new Connection();
        trySsh.on("error",function(err){
            callback(err);
        });
        trySsh.on('ready', function(){
            trySsh.forwardOut(
                config.srcHost,
                config.srcPort,
                config.dstHost,
                config.dstPort, function(err, sshStream) {
                    if(err){
                        callback(err);
                    }
                    
                    buildSSHConnectionPool(config, options.size, function(){
                        createListener(server).listen(config.localPort, config.localHost, callback);    
                    });
                
                    trySsh.end();
                })
        });
        trySsh.connect(config);
    } else {
        buildSSHConnectionPool(config, options.size, function(){
            createListener(server).listen(config.localPort, config.localHost, callback);
        });
    }
    
    return server;
}

module.exports = tunnel;
