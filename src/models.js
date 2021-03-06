const Sequelize = require('sequelize');
export const sequelize = new Sequelize('npmdocs', 'npmdocs', 'npmdocs', {
  host: 'localhost',
  dialect: 'mysql',

  pool: {
    max: 5,
    min: 0,
    acquire: 50000,
    idle: 10000
  },
  retry: {
    max: 10,
  },
  // http://docs.sequelizejs.com/manual/tutorial/querying.html#operators
  operatorsAliases: false
});

export const Package = sequelize.define('package', {

  name: {
    type: Sequelize.STRING
  },
  created: {
    type: Sequelize.DATE
  },
  tag: {
    type: Sequelize.STRING
  }
}, {
  indexes: [
    {
      unique: true,
      fields: ['name']
    },
    {
      fields: ['tag']
    },
  ],
});

Package.sync();

export const PackageDownloads = sequelize.define('package_downloads', {
  package_id: {
    type: Sequelize.INTEGER,

    references: {
      // This is a reference to another model
      model: Package,
      // This is the column name of the referenced model
      key: 'id',
    }
  },
  date: {
    type: Sequelize.DATEONLY
  },
  count: {
    type: Sequelize.INTEGER
  }
}, {
  indexes: [
    {
      fields: ['package_id']
    },
  ],
});

PackageDownloads.sync();

export const PackageDownloadsPerWeek = sequelize.define('package_downloads_per_week', {
  package_id: {
    type: Sequelize.INTEGER,

    references: {
      // This is a reference to another model
      model: Package,
      // This is the column name of the referenced model
      key: 'id',
    }
  },
  date: {
    type: Sequelize.DATEONLY
  },
  count: {
    type: Sequelize.INTEGER
  }
}, {
  indexes: [
    {
      fields: ['package_id']
    },
  ],
});
PackageDownloadsPerWeek.sync();

export const PackageCount = sequelize.define('package_counts', {
  date: {
    type: Sequelize.DATEONLY
  },
  count: {
    type: Sequelize.INTEGER
  },
  tag: {
    type: Sequelize.STRING
  },
}, {
  indexes: [
    {
      fields: ['date']
    },
  ],
});

PackageCount.sync();
