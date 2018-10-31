#!/usr/bin/env node

const fmt = require('util').format;
const https = require('https');
const qs = require('querystring');
const AWS = require('aws-sdk');

const email = process.env.CF_EMAIL;
const token = process.env.CF_TOKEN;
if (!email || !token) {
  console.error('CF_EMAIL and CF_TOKEN must be set');
  return process.exit(1);
}

const writeToAws = true;
var logBackup = console.log;
var logMessages = [];

// Cloudflare settings list to be backed up as JSON
const cloudflareJsItems = [
  'pagerules',
  'settings',
  // you can add more settings here
]

const CloudflareStatusCodes = {
  '200': 'OK.	Request successful',
  '304': 'Not Modified',
  '400': 'Bad Request.	Request was invalid',
  '401': 'Unauthorized.	User does not have permission',
  '403': 'Forbidden.	Request not authenticated',
  '429': 'Too many requests.	Client is rate limited',
  '405': 'Method Not Allowed.	Incorrect HTTP method provided',
  '415': 'Unsupported Media Type.	Response is not valid JSON  ',
}

// Write all stdout to logMessages
console.log = function () {
  logMessages.push.apply(logMessages, arguments);
  logBackup.apply(console, arguments);
};

const s3Bucket = new AWS.S3({ params: { Bucket: 'MY_BUCKET_NAME', timeout: 6000000 } });


module.exports = function doBackup() {
  return new Promise((resolve, reject) => {

    console.log('inside doBackup')

    return getZones(function (err, zones) {
      if (err) {
        return console.error(err);
      }

      let promiseArr = zones.map((zone) => dumpZoneDnss(zone))

      Promise.all(promiseArr)
        .then(function (resultsArray) {
          let promiseArr2 = []

          // Now write DNS data to S3
          promiseArr2.push(zonesFinished())

          if (writeToAws) {
            // Write other cloudflare settings to S3
            cloudflareJsItems.map((item) => {
              zones.map((zone) => {
                promiseArr2.push(dumpZoneJsItem(zone, item))
              })
            })
          }

          Promise.all(promiseArr2)
            .then((resultArray) => {
              console.log('%i itens written to S3: ', promiseArr.length)
              return resolve()
            })


        }).catch(function (err) {
          console.log('Error at dumpZone', err)
        })

    });
  })
}

function zonesFinished() {
  return new Promise((resolve, reject) => {
    if (writeToAws) {
      writeToAwsBucket(new Date().toISOString().slice(0, 10) + '.dns.txt', logMessages.join("\n"))
        .then(() => { return resolve() });
    }
  })
}

function dumpZoneDnss(zone) {
  return new Promise((resolve, reject) => {
    allPages('/zones/' + zone.id + '/dns_records', function (err, recs) {
      if (err) {
        console.error('Error getting zone records for %s:', zone.id, err);
        return resolve()
      }

      console.log(';; Domain: %s', zone.name);
      console.log(';; Exported: %s', new Date());
      console.log('$ORIGIN %s.', zone.name);

      recs.forEach(function (rec) {
        console.log(bindFormat(rec));
      });

      console.log('\n');

      return resolve();
    });
  })
}

function dumpZoneJsItem(zone, item) {
  return new Promise((resolve, reject) => {
    console.log('Backing up other zone settings', zone.id, item)
    allPages('/zones/' + zone.id + '/' + item, function (err, data) {
      if (err) {
        console.error('Error getting zone %s for %s:', item, zone.id, err);
        return resolve()
      }

      writeToAwsBucket(new Date().toISOString().slice(0, 10) + '.' + zone.name + '.' + item + '.js', JSON.stringify(data))
        .then(() => {
          return resolve();
        })
    });
  })
}

function bindFormat(rec) {
  var content = rec.content;
  switch (rec.type) {
    case 'SPF':
    case 'TXT':
      content = JSON.stringify(content);
      break;
    case 'CNAME':
      content += '.';
      break;
    case 'MX':
      content = fmt('%d\t%s.', rec.priority, content);
      break;
  }
  return fmt('%s.\t%d\tIN\t%s\t%s', rec.name, rec.ttl, rec.type, content);
}

/**
 * Gets a list of all zones at Cloudflare
 * @param {*} callback 
 */
function getZones(callback) {
  allPages('/zones', function (err, res) {
    callback(err, res);
  });
}

function allPages(path, callback) {
  var collection = [];
  return getPage(1);

  function getPage(page) {
    var params = {
      per_page: 50,
      page: page,
    };

    cfReq(path, params, function handlePage(err, res) {
      if (err) {
        console.log('cfReq ERR', err)
        return callback(err);
      } else if (res.result) {
        collection = collection.concat(res.result);
      } else {
        console.log('cfReq UNEXPECTED OUTPUT', res)
        return callback(false);
      }

      if (hasMorePages(res.result_info)) {
        return getPage(res.result_info.page + 1);
      } else {
        return callback(err, collection);
      }
    });
  }
}

function hasMorePages(info) {
  if (!info) {
    return false;
  }
  var seen = (info.page - 1) * info.per_page + info.count;
  return seen < info.total_count;
}

function cfReq(path, params, callback) {
  var opts = {
    host: 'api.cloudflare.com',
    port: 443,
    path: '/client/v4' + path + '?' + qs.stringify(params),
    headers: {
      'X-Auth-Email': email,
      'X-Auth-Key': token,
    },
    method: 'GET',
  };

  var req = https.request(opts, function (res) {
    return JSONResponse(res, callback);
  });

  req.on('error', function (err) {
    console.log('HTTP ERROR', err)
  });

  req.end();

  return req;
}

function JSONResponse(res, callback) {
  var body = '';

  res.on('data', accumulate)
    .on('end', parse)
    .on('error', callback);

  function accumulate(buf) {
    body += buf;
  }

  function error(err) {
    console.log('ERROR', err)
    callback(err)
  }

  function parse() {
    var err = null;
    try {
      body = JSON.parse(body);
    } catch (e) {
      err = e;
    }
    callback(err, body);
  }
}

function writeToAwsBucket(filename, content) {

  return new Promise((resolve, reject) => {

    let filepath = 'cloudflare/' + new Date().toISOString().slice(0, 10) + '/' + filename
    let bucket = process.env.CF_BACKUP_AWS_BUCKET

    let params = {
      ACL: 'public-read',
      Bucket: bucket,
      Key: filepath,
      Body: content,
      ContentType: 'binary'
    };

    // console.log('S3:', bucket + filename)
    // console.log('S3 params', params)

    s3Bucket.putObject(params, function (err, data) {
      if (err) {
        console.log('AWS putObject ERROR:', err);
        return resolve()
      } else {
        return resolve()
      }
    });
  })
}