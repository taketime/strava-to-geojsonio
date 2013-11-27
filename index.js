var express = require('express');
var fs = require('fs');
var request = require('request');
var templates = require('./lib/templates');
var app = express();

var settings = JSON.parse(fs.readFileSync('stravaSettings.json', 'utf-8'));

app.use(express.static('assets'));

// Prompt user to authenticate with Strava.
app.get('/', function(req, res) {
    res.send(templates['Home']({ url: settings.url }));
});

// Handle Strava token exchange.
app.get('/token-exchange', function(req, res) {
    request.post({
        url: 'https://www.strava.com/oauth/token',
        form: {
            client_id: settings.clientId,
            client_secret: settings.secret,
            code: req.query.code
        }
    }, function(err, resp) {
        if (err) res.send(500);

        var token = JSON.parse(resp.body).access_token;

        // For now, just spit back activities.
        request.get({
            url: 'https://www.strava.com/api/v3/athlete/activities',
            headers: {
                'Authorization': 'access_token ' + token
            }
        }, function(err, resp) {
            if (err) res.send(500);
            var activities = JSON.parse(resp.body);
            res.json(activities);
        });
    });
});

app.listen(3000);
console.log('Listening on port 3000');