'use strict';

var util = require('util');
var path = require('path');
var fs = require('fs');
var SQLite = require('sqlite3').verbose();
var Bot = require('slackbots');

var CrBot = function Constructor(settings) {
    this.settings = settings;
    this.settings.name = this.settings.name || 'cr-bot';
    this.dbPath = settings.dbPath || path.resolve(process.cwd(), 'data', 'crBot.sqlite3');

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
            console.log('Database path ' + '"' + this.dbPath + '" does not exist or it\'s not readable. Creating new DB...');
            this._createDb();
        }

        this.db = new SQLite.Database(this.dbPath);
    }

    CrBot.prototype._createDb = function() {
        this.db = new SQLite.Database(this.dbPath, createTables.bind(this));

        // Slack gives dates in the format datetime.uniqueIntaval ie. 12345.53245 therefore we use two columns to store these as integers to make use of looking them via date ranges in epoch time
        function createTables() {
            console.log('Creating Tables...');
            this.db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY ASC, uid TEXT, name TEXT, real_name TEXT UNIQUE)");
            this.db.run("CREATE TABLE IF NOT EXISTS commits (id INTEGER PRIMARY KEY ASC, hash TEXT UNIQUE, repository TEXT, datestamp INTEGER, intervalstamp INTEGER, user_id INTEGER, FOREIGN KEY(user_id) REFERENCES users(id))");
            this.db.run("CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY ASC, commit_hash TEXT, datestamp INTEGER, intervalstamp INTEGER, user_id INTEGER, commented INTEGER, FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(commit_hash) REFERENCES commits(hash))");
            console.log('Success');
        }
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
                self._welcomeMessage();
            //     return self.db.run('INSERT INTO info(name, val) VALUES("lastrun", ?', currentTime);
            // }

            // updates with new last running time
            // self.db.run('UPDATE info SET val = ? WHERE name = "lastrun"', currentTime);
        // });
    };

    CrBot.prototype._welcomeMessage = function() {
        // this.postMessageToChannel('XXXXXcode-reviews', 'cr-bot has connected!', {as_user: true})
    };

    CrBot.prototype._onMessage = function(message) {
        console.log(message);
        if (!this._isFromSelf(message)) {
            if (this._isChatMessage(message)) {
                this._handleCodeReviewPosting(message);
                this._handleGitHistoryPosting(message);
                this._handleNewBuildDunce(message);
            } else {
                this._handleReactionAdded(message);
                this._handleReactionRemoved(message);
            }
        }
    }

    CrBot.prototype._isFromSelf = function(message) {
        console.log('from self', message.user === this.user.id);
        return message.user === this.user.id;
    };

    CrBot.prototype._isChatMessage = function(message) {
        return message.type === 'message' && Boolean(message.text);
    };

    CrBot.prototype._handleReactionAdded = function(message) {
        return message.type === 'reaction_added';
    }

    CrBot.prototype._handleReactionRemoved = function(message) {
        return message.type === 'reaction_removed';
    }

    CrBot.prototype._handleGitHistoryPosting = function(message) {
        return;
    }

    CrBot.prototype._handleNewBuildDunce = function(message) {
        var pattern = new RegExp('kiwibot.+build.+dunce.+@(\\w+).+')
        var matches = pattern.exec(message.text);
        if (matches) {
            var user = this.getUserById(matches[1]);
            currentDunce = matches[1];
            this.postMessage(currentDunce, "Hey, you're the new Build Dunce! You broke the build, so now it's your job to find out what's wrong the next time a test fails. Fun!", {as_user: true});
            var dunceMessage = "The new Build Dunce is " + currentDunce + " (sorry I can't convert a user id to a name just yet)";
            this.postMessageToChannel('test-channel', dunceMessage, {as_user: true});
        }
    }

    CrBot.prototype._handleCodeReviewPosting = function(message) {
        var pattern = new RegExp('git.kiwicollection.net\/kiwicollection\/([\\w-]*)\/(?:commit|blob)\/(\\w{40})')
        var matches = pattern.exec(message.text);

        if (matches) {
            var repo = matches[1];
            var commit = matches[2];

            if (repo && commit) {
                var date = message.ts.split(".")
                var datestamp = date[0];
                var intervalstamp = date[1];

                var self = this;
                this._getUserByUId(message.user, function(user) {
                    self._saveCommit(commit, repo, user.id, datestamp, intervalstamp);

                    self._addBotReaction(message);
                })
            }
        }

    }
    CrBot.prototype._saveCommit = function(commitHash, repo, userId, datestamp, intervalstamp) {
        console.log(commitHash, repo, userId, datestamp, intervalstamp);
        this.db.run('INSERT INTO commits(hash, repository, user_id, datestamp, intervalstamp) VALUES($hash, $repo, $user, $date, $interval)', {
            $hash: commitHash,
            $repo: repo,
            $user: userId,
            $date: datestamp,
            $interval: intervalstamp,
        }, function(err, record) {
            if (err) {
                return console.error('DATABASE ERROR:', err);
            } 
        });
    }

    CrBot.prototype._getUserByUId = function(uid, callback) {
        var db = this.db;
        var self = this;

        this.db.get('SELECT * FROM users WHERE uid = ?', uid, function(err, user) {
            if (err) {
                return console.error('DATABASE ERROR:', err);
            }

            if (!user) {
                var user = self._getUserById(uid);

                // Move slack's id to uid property 
                user.uid = user.id;
                user.id = null;
                db.run('INSERT INTO users(uid, name, real_name) VALUES(?, ?, ?)', user.uid, user.name, user.real_name, function(err) {
                    if (err) {
                        return console.error('DATABASE ERROR:', err);
                    }
                    user.id = this.lastID;
                    callback(user);

                });
            } else {
                callback(user);
            }
        });
    }






    CrBot.prototype._isChannelConversation = function(message) {
        console.log('in channel', typeof message.channel === 'string' && message.channel[0] === 'C');
        return typeof message.channel === 'string' &&
            message.channel[0] === 'C'; // 'C' as the first char in channel id shows chat type channel
    };

    CrBot.prototype._replyWithInfo = function(message) {
        var self = this;
        var pattern = new RegExp('git.kiwicollection.net\/kiwicollection\/(.*)\/commit\/([a-zA-Z0-9]*)')
        var matches = pattern.exec(message.text);

        var repo = matches[1];
        var commit = matches[2];
        var user = self._getUserById(message.user);

        var response = 'New review by ' + user.real_name + ' added with commit *' + commit + '* in *' + repo + '* repo!';

        // self.db.get('SELECT id, commit FROM commits' function(err, record) {
            // if(err) {
            //     return console.error('DATABASE ERROR:', err);
            // }
            var group = self._getGroupById(message.channel);
            // self.postMessageToChannel(channel.name, record.commit, {as_user: true});
            self.postMessageToGroup(group.name, response, {as_user: true});
            // self.db.run('UPDATE commits SET ')
        // });
    };

    CrBot.prototype._getChannelById = function(channelId) {
        return this.channels.filter(function(item) {
            return item.id === channelId;
        })[0];
    };

    CrBot.prototype._getGroupById = function(groupId) {
        return this.groups.filter(function(item) {
            return item.id === groupId;
        })[0];
    };

    CrBot.prototype._getUserById = function(userId) {
        return this.users.filter(function(item) {
            return item.id === userId;
        })[0];
    };

    CrBot.prototype._addBotReaction = function(message) {
        var params = {
            name: 'robot_face',
            channel: message.channel,
            timestamp: message.ts
        };

        return this._api('reactions.add', params);
    }
};

util.inherits(CrBot, Bot);

module.exports = CrBot;






























