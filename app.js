var _ = require('underscore');
var express = require('express');
var fs = require('fs');
var request = require('request');
var templates = require('./lib/templates');
var app = express();

// var settings = JSON.parse(fs.readFileSync('stravaSettings.json', 'utf-8'));
// console.log("param1", process.env.PARAM1);
// console.log("param2", process.env.PARAM2);
// console.log("param3", process.env.PARAM3);

app.use(express.static('assets'));
app.use(express.cookieParser());
app.use(express.session({ secret: 'camper' }));

// Prompt user to authenticate with Strava.
app.get('/', function(req, res) {
    res.send(templates['Home']({ url: process.env.PARAM3 }));
});

// Do Strava token exchange, and return a page of activities
app.get('/activities', function(req, res) {
    request.post({
        url: 'https://www.strava.com/oauth/token',
        form: {
            client_id: process.env.PARAM2,
            client_secret: process.env.PARAM1,
            code: req.query.code
        }
    }, function(err, resp) {
        if (err) res.send(500);

        try {
            var tok = JSON.parse(resp.body);
            req.session.token = tok.access_token;
        } catch (err) {
            res.send(500);
        }
        getActivities({ token: req.session.token }, function(err, acts) {
            if (err) {
                res.send(500)
            } else {
                res.send(templates['Activities']({ activities: acts }));
            }
        });
    });
});

// Send an activity to geojson.io
app.get('/activity/:id', function(req, res) {
    getActivityStream({ id: req.params.id, token: req.session.token }, function(err, act) {
        if (err) {
            res.send(500);
        } else {
            res.redirect("http://geojson.io/#data=data:application/json," + encodeURIComponent(JSON.stringify(act)));
        }
    });
});

// Get some activities
function getActivities(opts, callback) {
    var page = opts.page || 1;
    request.get({
        url: 'https://www.strava.com/api/v3/athlete/activities?per_page=100&page=' + page,
        headers: {
           'Authorization': 'access_token ' + opts.token
        }
    }, function(err, resp) {
        if (err) return callback(err);

        try {
            var activities = JSON.parse(resp.body);
        } catch (err) {
            return callback(err);
        }
        callback(null, activities);
    });
}

// Get an activity "stream"
// This forces geojson structure on data from Strava.
// Ask if they're open to returning geojson. It'd be nice.
function getActivityStream(opts, callback) {
    request.get({
        url: 'https://www.strava.com/api/v3/activities/' + opts.id + '/streams/latlng',
        headers: {
            'Authorization': 'access_token ' + opts.token
        }
    }, function(err, resp) {
        if (err) return callback(err);

        // parse the activity
        try {
            var stream = JSON.parse(resp.body);
        } catch (err) {
            return callback(err);
        }

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

        // add arrays of points
        for (var i = 0; i < stream[0].data.length; i++) {
            //Strava points are reversed
            feat.geometry.coordinates[0].push(stream[0].data[i].reverse());
        }

        // Shove in the feature
        geojson.features.push(feat);

        callback(null, geojson);
    });
}

app.listen(process.env.PORT || 3000);
console.log('Listening on port 3000');
