import { Package, PackageDownloads, PackageDownloadsPerWeek, PackageCount } from './models';
import { RateLimiter } from 'limiter';
import { groupBy, sum } from 'lodash';
import { Op } from 'sequelize';
import Promise from 'bluebird';
import moment from 'moment';
import NpmAPI from 'npm-api';
import dependents from 'npm-api-dependents'

const npm = NpmAPI();
npm.use(dependents());

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
  return ranges.map((range) => {
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

export function consolidateDownloads(project) {
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

export function savePackage(obj, tag) {
  return Package.findOrCreate({ where: {name: obj.name, tag } }).spread((project, created) => {
    let promise;
    if (created || !project.created) {
      promise = packageCreated(project.name).then((time) => {
        project.created = time;
        return project.save();
      }).then(() => {
        return getDownloads(project);
      });
    } else {
      promise = getDownloads(project)
    }

    return promise;
  }).catch((err) => {
    console.log(err);
  });
}

export function installRanges(startDate) {
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


export function addDependents(basePackage) {
  const repo = npm.repo(basePackage);

  let i = 0;
  const reader = repo.dependents();
  reader.on('data', (repo) => {
    reader.pause();
    savePackage(repo, basePackage).then(() => {
      reader.resume();
    });
  });
}

export function loadDownloadsAbove(id) {
  return Package.findAll({where: {id: {[Op.gt]: id}}}).then((packages) => {
    Promise.map(packages, p => getDownloads(p));
  });
};

export function computePackageCounts(tag) {
  const starts = {};
  Package.findAll({where: {tag: tag}}).then((repos) => {
    repos.forEach((repo) => {
      const date = moment(repo.created).format('YYYY-MM-DD');
      starts[date] = starts[date] || 0;
      starts[date] += 1;
    });
  }).then(() => {
    const counts = {};
    let total = 0;
    let startDate = Object.keys(starts).sort((a, b) => {
      return moment(a).unix() - moment(b).unix();
    })[0];
    const dates = [];
    let date = moment(startDate);
    const now = moment();
    while (date < moment()) {
      dates.push(date.format('YYYY-MM-DD'));
      date.add(1, 'day');
    }
    dates.forEach((date) => {
      total = total + (starts[date] || 0);
      counts[date] = total;
    });
    Promise.map(Object.keys(counts), (date) => {
      return PackageCount.findOrCreate({where: {tag: tag, date: date}}).spread((model, created) => {
        model.count = counts[date];
        return model.save();
      });
    }, {concurrency: 10}).then(() => {
      process.exit(0);
    });
  });
}
