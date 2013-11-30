var _ = require('underscore');
var express = require('express');
var fs = require('fs');
var request = require('request');
var templates = require('./lib/templates');
var app = express();

var settings = JSON.parse(fs.readFileSync('stravaSettings.json', 'utf-8'));

app.use(express.static('assets'));
app.use(express.cookieParser());
app.use(express.session({ secret: 'joanie' }));

var token;

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

        token = JSON.parse(resp.body).access_token;
        req.session.token = token;

        // For now, just spit back activities.
        request.get({
            url: 'https://www.strava.com/api/v3/athlete/activities',
            headers: {
                'Authorization': 'access_token ' + token
            }
        }, function(err, resp) {
            if (err) res.send(500);

            var activities = JSON.parse(resp.body);

            // Just grab whatever the first activity is for now
            getActivityStream(_(activities).first().id, function(err, act) {
                if (err) res.send(500);
                // Send it over to geojson.io
                res.redirect("http://geojson.io/#data=data:application/json," + encodeURIComponent(JSON.stringify(act)));
            });
        });
    });
});

// Get an activity "stream"
function getActivityStream(id, callback) {
    request.get({
        url: 'https://www.strava.com/api/v3/activities/' + id + '/streams/latlng',
        headers: {
            'Authorization': 'access_token ' + token
        }
    }, function(err, resp) {
        if (err) return callback(err);

        // parse the activity
        // @TODO error check!
        var stream = JSON.parse(resp.body);

        // Force geojson structure.
        var geojson = {};
        geojson.type = "FeatureCollection";
        geojson.features = [];

        var feat = {};
        feat.type = "Feature";
        feat.properties = {};
        feat.geometry = {};
        feat.geometry.type = "MultiLineString";
        feat.geometry.coordinates = [];
        feat.geometry.coordinates[0] = [];

        // add arays of points
        for (var pt in stream[0].data) {
            feat.geometry.coordinates[0].push(stream[0].data[pt].reverse());    //Strava points are in reverse order
        }

        // Shove in the feature
        geojson.features.push(feat);

        callback(null, geojson);
    });
}

app.listen(3000);
console.log('Listening on port 3000');