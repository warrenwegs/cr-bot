'use strict';

var CrBot = require('../cr-bot.js');

var token = process.env.BOT_API_KEY;
var dbPath = process.env.BOT_DB_PATH;
var name = process.env.BOT_NAME;

var crbot = new CrBot({
  token: token,
  dbPath: dbPath,
  name: name
});

crbot.run();