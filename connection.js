const {
    MongoClient
} = require('mongodb');
require("dotenv").config();
const uri = "mongodb+srv://batbox-cluster-user:" + process.env.DBPASS + "@cluster0.p4k66.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";
var _db;

module.exports = {
    connectToServer: function (callback) {
        MongoClient.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        }, function (err, client) {
            _db = client.db('sample_analytics');
            return callback(err);
        });
    },

    getDb: function () {
        return _db;
    }
};