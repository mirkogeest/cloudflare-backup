backupModule = require('./bin/cf-backup')

exports.handler = function (event, context) {
    backupModule()
        .then(() => {
            context.succeed('Backup finished!')
        }
        )
};

//backupModule()