import { Package, PackageDownloads, PackageDownloadsPerWeek } from './models';
import { RateLimiter } from 'limiter';
import { groupBy, sum } from 'lodash';
import Promise from 'bluebird';
import moment from 'moment';
const RegClient = require('npm-registry-client');

const client = new RegClient();
const baseURI = `https://registry.npmjs.org/`;
const limiter = new RateLimiter(1, 500);
const alternateLimiter = new RateLimiter(1, 500);

function getLimited(uri, params, cb) {
  limiter.removeTokens(1, () => {
    client.get(uri, params, cb);
  });
}

function getAlternateLimited(uri, params) {
  return new Promise(function(resolve, reject) {
    alternateLimiter.removeTokens(1, () => {
      client.get(uri, params, (err, ...args) => {
        if(err) {
          reject(err);
        } else {
          resolve(...args);
        }
      });
    });
  });
}

function packageCreated(pkgName) {
  return new Promise(function(resolve, reject) {
    getLimited(`${baseURI}${encodeURIComponent(pkgName)}`, {}, (err, data) => {
      if(err) {
        console.log(err);
      }
      if(data && data.time) {
        resolve(data.time.created)
      }
    });
  })
}

function getDownloads(project) {
  const ranges = installRanges(project.created);
  ranges.forEach((range) => {
    const url = `https://api.npmjs.org/downloads/range/${range}/${encodeURIComponent(project.name)}`;
    return getAlternateLimited(url, {}).then((data) => {
      return Promise.map(data.downloads, (downloadStats) => {
        const identifiers = { package_id: project.id, date: downloadStats.day };
        return PackageDownloads.findOrCreate({where: identifiers}).then(([stats, created]) => {
          if (created) {
            stats.count = downloadStats.downloads;
            stats.save();
          }
        });
      }, { concurrency: 10 });
    }).catch((err) => {
      console.log(err);
    });
  });
}

function consolidateDownloads(project) {
  return PackageDownloads.findAll({where: {package_id: project.id}}).then((downloads) => {
    const groups = groupBy(downloads, (packageDownload) => {
      return moment(packageDownload.date).startOf('week');
    });
    return Promise.map(Object.entries(groups), ([key, group]) => {
      const date = key;
      const count = sum(group.map(d => d.count));
      return PackageDownloadsPerWeek.findOrCreate({ where: { package_id: project.id, date: date }}).
      then(([dl, created]) => {
        dl.count = count;
        dl.save();
      });
    }, { concurrency: 10 });
  });
}

export function consolidateAllDownloads() {
  return Package.findAll().then((packages) => {
    return Promise.mapSeries(packages, consolidateDownloads, { concurrency: 10 });
  });
}

function savePackage(obj, tag) {
  return Package.findOrCreate({ where: {name: obj.name, tag } }).spread((project, created) => {
    let p1;
    if (created || !project.created) {
      p1 = packageCreated(project.name).then((time) => {
        project.created = time;
        project.save();
      });
    }
    getDownloads(project);
    return p1 || Promise.resolve();
  }).catch((err) => {
    console.log(err);
  });
}

function installRanges(startDate) {
  const ranges = [];
  let date = moment(startDate);
  const today = moment();
  while(date <= today) {
    let finish = date.clone().add('365', 'days');
    if (finish > today) {
      finish = today.clone();
    }
    const range = `${date.format('YYYY-MM-DD')}:${finish.format('YYYY-MM-DD')}`;
    ranges.push(range);
    date = finish.clone().add('1', 'day');
  }
  return ranges;
}


export function addPackages(tag, offset = 0) {
  const url = `${baseURI}-/v1/search?text=${tag}&from=${offset}&size=200`;
  getLimited(url, {}, (err, data, raw, res) => {
    Promise.all(data.objects.map((obj) => {
      return savePackage(obj.package, tag);
    })).then(() => {
      if (data.total > offset + data.objects.length) {
        addPackages(tag, offset + 200);
      } else {
        process.exit();
      }
    });
  });
}

