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
    this.iReviewedReaction = ['eyes'];
    this.iCommentedReaction = ['beer', 'beers'];

    this.months = {
        'jan': 0,
        'feb': 1,
        'mar': 2,
        'apr': 3,
        'may': 4,
        'jun': 5,
        'jul': 6,
        'aug': 7,
        'sep': 8,
        'oct': 9,
        'nov': 10,
        'dec': 11
    }

    CrBot.prototype.run = function() {
        CrBot.super_.call(this, this.settings);

        this.on('start', this._onStart);
        this.on('message', this._onMessage);
    }

    CrBot.prototype._onStart = function() {
        this._loadBotUser();
        this._connectDb();
        this._firstRunCheck();
        // this._welcomeMessage();
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
            this.db.run("CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY ASC, commit_hash TEXT, datestamp INTEGER, intervalstamp INTEGER, user_id INTEGER, commented INTEGER, type TEXT, FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(commit_hash) REFERENCES commits(hash))");
            console.log('Success');
        }
    }

    CrBot.prototype._firstRunCheck = function() {
    };

    CrBot.prototype._welcomeMessage = function() {
        this.postMessageToGroup('fake-code-reviews', 'cr-bot has connected!', {as_user: true});
        this.postMessageToChannel('code-reviews', 'cr-bot has connected!', {as_user: true});
    };

    CrBot.prototype._onMessage = function(message) {
        console.log(message);
        if (!this._isFromSelf(message)) {
            if ('message' === message.type && Boolean(message.text)) {
                // this._handleNewBuildDunce(message);
                if ('C0QVCGV6W' === message.channel || 'G2EFS8NP8' === message.channel) {
                    this._handleCodeReviewPosting(message);
                } else if ('C04LDVBBS' === message.channel) {
                    this._handleGitHistoryPosting(message);
                }
            } else if ('reaction_added'  === message.type) {
                this._handleReactionAdded(message);
            } else if ('reaction_removed' === message.type) {
                this._handleReactionRemoved(message);
            }
        }
    }

    CrBot.prototype._isFromSelf = function(message) {
        console.log('from self', message.user === this.user.id);
        return message.user === this.user.id;
    };

    CrBot.prototype._handleReactionAdded = function(message) {
        var self = this;
        if (self.iCommentedReaction.includes(message.reaction) || self.iReviewedReaction.includes(message.reaction)) {
            var stamps = self._getDateStamps(message.item.ts);
            self._getCommitByStamps(stamps, function(commit) {
                if (commit) {
                    self._getUserByUId(message.user, function(user) {
                        self._saveReviewed(message, commit, user.id);
                    });
                }
            })
        }
    }

    CrBot.prototype._saveReviewed = function(message, commit, userId) {
        var commented = this.iCommentedReaction.includes(message.reaction);
        var stamps = this._getDateStamps(message.item.ts);
        var type = message.reaction;

        this.db.run('INSERT INTO reviews(commit_hash, user_id, datestamp, intervalstamp, commented, type) VALUES($commit_hash, $user, $date, $interval, $commented, $type)', {
            $commit_hash: commit.hash,
            $user: userId,
            $date: stamps.date,
            $interval: stamps.interval,
            $commented: commented,
            $type: type
        }, function(err, record) {
            if (err) {
                return console.error('DATABASE ERROR:', err);
            }
        });
    }

    CrBot.prototype._handleReactionRemoved = function(message) {
        var stamps = this._getDateStamps(message.item.ts);
        var commented = this.iCommentedReaction.includes(message.reaction);
        var type = message.reaction;

        this.db.run('DELETE FROM reviews WHERE datestamp = ? AND intervalstamp = ? AND type = ?', stamps.date, stamps.interval, type, function(err) {
            if (err) {
                return console.error('DATABASE ERROR:', err);
            }
        })
    }

    CrBot.prototype._handleGitHistoryPosting = function(message) {
        var commits = this._parseGitHistoryMessage(message);
    }

    CrBot.prototype._parseGitHistoryMessage = function(message) {
        var commits = [];
        var pattern = new RegExp('git.kiwicollection.net\/kiwicollection\/([\\w-]*)\/(?:commit|blob)\/(\\w{40})');

        message.attachements.forEach(function(attachement) {
            var commit = {};

            // attachement.fallback; // I think this was a fallback url?
        });
    }

    CrBot.prototype._handleCodeReviewPosting = function(message) {
        var self = this;
        var commits = this._parseCodeReviewCommits(message);
        var command = this._parseCodeReviewCommand(message);

        if (0 != commits.length) {
            self._getUserByUId(message.user, function(user) {
                self._saveCommits(commits, user.id);
            });
            self._addBotReaction(message);
        }

        switch(command.name) {
            case 'help':
                this._helpMessage(message.channel);
                break;
            case 'stats':
                this._statsMessage(message.channel, command.arg);
                break;
            default:
                break;
        }
    }

    CrBot.prototype._helpMessage = function(channel) {
        var helpText = "cr-bot commands: \r\
        help - returns this help text \r\
        stats - returns the current months code reviews leaderboard \r\
        stats overall - returns the total code reviews leaderboard \r\
        stats month -  eg jan; returns the code reviews leaderboard for that month";
        this.postMessage(channel, helpText)
    }

    CrBot.prototype._statsMessage = function(channel, arg) {
        switch(arg) {
            case 'overall':
                var stats = this._getOverallStats();
                break;
            case Object.keys(this.months).includes(arg):
                var stats = $this._getMonthStats(arg);
                break;
            default:
                var stats = this._getOverallStats();
                break;
        }
    }

    CrBot.prototype._getOverallStats = function() {
        var self = this;
        self.db.all('SELECT users.id, users.real_name, COUNT(*) AS count FROM commits JOIN users ON commits.user_id=users.id GROUP BY users.id', function(err, commits) {
            if (err) {
                return console.error('DATABASE ERROR:', err);
            } 
            self.db.all('SELECT users.id, users.real_name, reviews.commented, COUNT(*) AS count FROM reviews JOIN users ON reviews.user_id=users.id GROUP BY users.id, commented', function(err, reviews) {
                self._buildStatsTable(commits, reviews);
            })
        });
    }

    CrBot.prototype._buildStatsTable = function(commits, reviews) {
        var table = {};

        commits.forEach(function(commit) {
            var row = {};
            row.id = commit.id;
            row.name = commit.real_name;
            row.commits = commit.count;
            row.commented = 0;
            row.looked = 0;
            row.total = commit.count;
            table[commit.id] = row;
        });

        reviews.forEach(function(review) {
            if (!table[review.id]) {
                var row = {};
                row.id = review.id;
                row.name = review.real_name;
                row.commits = 0;
                row.commented = 0;
                row.looked = 0;
                row.total = 0;
                table[review.id] = row;
            }
            if (1 === review.commented) {
                table[review.id].commented = review.count;
                table[review.id].total = table[review.id].total + review.count;
            } else {
                table[review.id].looked = review.count;
                table[review.id].total = table[review.id].total + review.count;
            }
        });

        var leaderboard = []
        for (var row in table) {
            leaderboard.push(table[row]);
        }

        leaderboard.sort(function(a,b) {
            return (a.total > b.total) ? -1 : ((b.total > a.total) ? 1 :0);
        })

        console.log(leaderboard);
    }


    CrBot.prototype._getDateStamps = function(date) {
        var items = date.split(".");
        var stamps = {};
        stamps.date = items[0];
        stamps.interval = items[1];

        return stamps;
    }

    CrBot.prototype._parseCodeReviewCommand = function(message) {
        var pattern = new RegExp('cr-bot:(\\w*)\\s*(.*)')

        var command = {name: null};
        var lines = message.text.split("\n");

        lines.forEach(function(line) {
            var matches = pattern.exec(line);

            if (matches) {
                command.name = matches[1].toLowerCase();
                command.arg = matches[2];
            } 
        });

        return command;
    }

    CrBot.prototype._parseCodeReviewCommits = function(message) {
        var pattern = new RegExp('git.kiwicollection.net\/kiwicollection\/([\\w-]*)\/(?:commit|blob)\/(\\w{40})');

        var commits = [];

        var lines = message.text.split("\n");
        var stamps = this._getDateStamps(message.ts);

        lines.forEach(function(line) {
            var matches = pattern.exec(line);

            if (matches) {
                var commit = {};
                commit.repo = matches[1];
                commit.hash = matches[2];
                commit.datestamp = stamps.date;
                commit.intervalstamp = stamps.interval;
                commits.push(commit);
            } 
        });

        return commits;
    }

    CrBot.prototype._saveCommits = function(commits, userId) {
        var self = this;
        commits.forEach(function(commit) {
            self.db.run('na', {
                $hash: commit.hash,
                $repo: commit.repo,
                $user: userId,
                $date: commit.datestamp,
                $interval: commit.intervalstamp,
            }, function(err, record) {
                if (err) {
                    return console.error('DATABASE ERROR:', err);
                } 
            });
        });
    }

    CrBot.prototype._getUserByUId = function(uid, callback) {
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
                self.db.run('INSERT INTO users(uid, name, real_name) VALUES(?, ?, ?)', user.uid, user.name, user.real_name, function(err) {
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

    CrBot.prototype._getCommitByStamps = function(stamps, callback) {
        var self = this;

        this.db.get('SELECT * FROM commits WHERE datestamp = ? AND intervalstamp = ?', stamps.date, stamps.interval, function(err, commit) {
            if (err) {
                return console.error('DATABASE ERROR:', err);
            }

            if (commit) {
                callback(commit);
            } else {
                callback(false);
            }
        });
    }


    CrBot.prototype._handleNewBuildDunce = function(message) {
        var pattern = new RegExp('kiwibot.+new.+build.+watcher.+@(\\w+).+')
        var matches = pattern.exec(message.text);
        if (matches) {
            var user = this.getUserById(matches[1]);
            currentDunce = user.name;
            this.postMessage(currentDunce, "Hey, you're the new build watcher! You broke the build, so now it's your job to find out what's wrong the next time a test fails.", {as_user: true});
            var dunceMessage = "The new Build Watcher is " + currentDunce;
            this.postMessageToChannel('test-channel', dunceMessage, {as_user: true});
        }
    }


    CrBot.prototype._isChannelConversation = function(message) {
        console.log('in channel', typeof message.channel === 'string' && message.channel[0] === 'C');
        return typeof message.channel === 'string' &&
            message.channel[0] === 'C'; // 'C' as the first char in channel id shows chat type channel
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






























