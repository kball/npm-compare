import express from 'express';
import { Package, PackageDownloads } from './models';
const app = express()

app.get('/api/package/:packageName', (req, res) => {
  const { packageName } = req.params;
  Package.findOne({where: {name: packageName}}).then((pkg) => {
    PackageDownloads.findAll({where: {package_id: pkg.id}}).then((downloads) => {
      const output = downloads.map(d => {
        return {date: d.date, downloads: d.count};
      });
      res.json({package: pkg, downloads: output});
    });
  });
});

app.listen(3000, () => console.log('Example app listening on port 3000!'))
