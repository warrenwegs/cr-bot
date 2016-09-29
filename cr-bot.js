'use strict';

var util = require('util');
var path = require('path');
var fs = require('fs');
var SQLite = require('sqlite3').verbose();
var Bot = require('slackbots');

var CrBot = function Constructor(settings) {
    this.settings = settings;
    this.settings.name = this.settings.name || 'cr-bot';
    this.dbPath = settings.dbPath || path.resolve(process.cwd(), 'data', 'crBot.db');

    this.user = null;
    this.db = null;

    CrBot.prototype.run = function() {
        CrBot.super_.call(this, this.settings);

        this.on('start', this._onStart);
        this.on('message', this._onMessage);
    }

    CrBot.prototype._onStart = function() {
        this._loadBotUser();
        this._connectDb();
        this._firstRunCheck();
    }

    CrBot.prototype._loadBotUser = function() {
        var self = this;
        this.user = this.users.filter(function(user) {
            return user.name === self.name;
        })[0];
    };

    CrBot.prototype._connectDb = function() {
        if (!fs.existsSync(this.dbPath)) {
            console.error('Database path ' + '"' + this.dbPath + '" does not exist or it\'s not readable.');
            process.exit(1);
        }

        this.db = new SQLite.Database(this.dbPath);
    }

    CrBot.prototype._firstRunCheck = function() {
        var self = this;
        // self.db.get('SELECT val FROM info WHERE name = "lastrun" LIMIT 1', function(err, record) {
            // if (err) {
            //     return console.error('DATABASE ERROR:', err);
            // }

            var currentTime = (new Date()).toJSON();

            // this is a first run
            // if (!record) {
                self._welcomMessage();
            //     return self.db.run('INSERT INTO info(name, val) VALUES("lastrun", ?', currentTime);
            // }

            // updates with new last running time
            // self.db.run('UPDATE info SET val = ? WHERE name = "lastrun"', currentTime);
        // });
    };

    CrBot.prototype._welcomMessage = function() {
        this.postMessageToChannel('fake-code-reviews', 'cr-bot has connected!', {as_user: true})
    };

    CrBot.prototype._onMessage = function(message) {
        if (this._isChatMessage(message) &&
            this._isChannelConversation(message) &&
            !this._isFromSelf(message) &&
            this._isCodePosting(message)
        ) {
            this.replyWithInfo(message);
        }
    }

    CrBot.prototype._isChatMessage = function(message) {
        return message.type === 'message' && Boolean(message.text);
    };

    CrBot.prototype._isChannelConversation = function(message) {
        return typeof message.channel === 'string' &&
            message.channel[0] === 'C'; // 'C' as the first char in channel id shows chat type channel
    };

    CrBot.prototype._isFromSelf = function(message) {
        return message.user === this.user.id;
    };

    CrBot.prototype._isCodePosting = function(message) {
        var stringCheck = 'git.kiwicollection';
        return message.text.toLowerCase().indexOf(stringCheck) > -1;
    }

    CrBot.prototype._replyWithInfo = function(message) {
        var self = this;
        // self.db.get('SELECT id, commit FROM commits' function(err, record) {
            // if(err) {
            //     return console.error('DATABASE ERROR:', err);
            // }

            var channel = self._getChannelById(originalMessage.channel);
            // self.postMessageToChannel(channel.name, record.commit, {as_user: true});
            self.postMessageToChannel(channel.name, 'record.commit', {as_user: true});
            // self.db.run('UPDATE commits SET ')
        // });
    };

    CrBot.prototype._getChannelById = function(channelId) {
        return this.channels.filter(function(item) {
            return item.id === channelId;
        })[0];
    };
};

util.inherits(CrBot, Bot);

module.exports = CrBot;






























