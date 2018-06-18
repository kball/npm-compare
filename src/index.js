import express from 'express';
import { sequelize, Package, PackageDownloads, PackageDownloadsPerWeek } from './models';
const app = express()

app.get('/api/package/:packageName', (req, res) => {
  const { packageName } = req.params;
  Package.findOne({where: {name: packageName}}).then((pkg) => {
    PackageDownloadsPerWeek.findAll({where: {package_id: pkg.id}, order: sequelize.literal('date')}).then((downloads) => {
      const output = downloads.map(d => {
        return {date: d.date, downloads: d.count};
      });
      res.json({package: pkg, downloads: output});
    });
  });
});
app.get('/api/tag/:tagName', (req, res) => {
  const { tagName } = req.params;
  sequelize.query('select count(*) from packages where tag = :tagName', {
    replacements: { tagName },
    type: sequelize.QueryTypes.SELECT }).then((count) => {
    sequelize.query(`
      SELECT package_downloads_per_weeks.date,
        count(distinct package_downloads_per_weeks.package_id) as packages,
        sum(package_downloads_per_weeks.count) as downloads
      FROM package_downloads_per_weeks, packages
      WHERE package_downloads_per_weeks.package_id=packages.id
      AND packages.tag = :tagName
      GROUP BY package_downloads_per_weeks.date
      ORDER BY package_downloads_per_weeks.date`, { replacements: { tagName } }
    ).then((downloads) => {
      res.json({tag: tagName, count, downloads});
    });
  });
});

app.listen(3000, () => console.log('Example app listening on port 3000!'))
