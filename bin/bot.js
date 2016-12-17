'use strict';

const appRoot = __dirname;
GLOBAL.currentDunce = 'stephan';

var CrBot = require('../cr-bot.js');
var express = require('express');
var app = express();
var url = require('url');
var request = require('request');
var bodyParser = require('body-parser');
var path = require('path');

var token = process.env.BOT_API_KEY;
var dbPath = process.env.BOT_DB_PATH;
var name = process.env.BOT_NAME;

var crbot = new CrBot({
  token: token,
  dbPath: dbPath,
  name: name
});

crbot.run();

// require('./build-breaker')(app);

app.set('port', (process.env.PORT || 9001));
app.use('/', express.static(path.join(appRoot, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));



app.listen(app.get('port'), function() {
    console.log('Build-dunce server started: http://localhost:' + app.get('port') + '/');
});

// routes
app.get('/broken-develop', function (req, res) {
    // this route will send a message to the current build dunce that the build is broken.
    crbot.postMessage(currentDunce, "Tests are failing on develop! Go find out who broke everything!", {as_user: true})
    res.send("Tests are failing on develop sent!");
})

// run with BOT_API_KEY=my_key_is_here node bin/bot.js