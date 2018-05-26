import { Package, PackageDownloads } from './models';
import { RateLimiter } from 'limiter';
const RegClient = require('npm-registry-client');

const client = new RegClient();
const uri = `https://registry.npmjs.org/`;
const params = {timeout: 1000};
const limiter = new RateLimiter(1, 1000);

function getLimited(uri, params, cb) {
  limiter.removeTokens(1, () => {
    client.get(uri, params, cb);
  });
}

function packageCreated(pkgName, cb) {
  getLimited(`${uri}${pkgName}`, {}, (err, data) => {
    if(err) {
      console.log('err', err);
    }
    if(data && data.time) {
      cb(data.time.created)
    }
  });
}

function savePackage(obj, tag) {
  Package.findOrCreate({ where: {name: obj.name, tag } }).then(([project, created]) => {
    if (created) {
      packageCreated(project.name, (created) => {
        project.created = created;
        project.save();
      });
    }
  });
}

function addVuePackages(offset = 0) {
  const url = `${uri}-/v1/search?text=vue&from=${offset}`;
  getLimited(url, {}, (err, data, raw, res) => {
    data.objects.forEach((obj) => {
      savePackage(obj.package, 'vue');
    });
    if (data.total > offset + data.objects.length) {
      addVuePackages(offset + 20);
    } else {
      process.exit();
    }
  });
}

addVuePackages();
