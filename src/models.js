const Sequelize = require('sequelize');
const sequelize = new Sequelize('npmdocs', 'npmdocs', 'npmdocs', {
  host: 'localhost',
  dialect: 'mysql',

  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
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


export const PackageDownloads = sequelize.define('package', {
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
    type: Sequelize.DATE
  },
  count: {
    type: Sequelize.INTEGER
  }
});

Package.sync();
PackageDownloads.sync();
