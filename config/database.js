const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT),
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

let poolConnection;

const getConnection = async () => {
  try {
    if (poolConnection) {
      return poolConnection;
    }
    
    poolConnection = await sql.connect(dbConfig);
    return poolConnection;
  } catch (error) {
    throw error;
  }
};

const closeConnection = async () => {
  try {
    if (poolConnection) {
      await poolConnection.close();
      poolConnection = null;
    }
  } catch (error) {
  }
};

module.exports = {
  getConnection,
  closeConnection,
  sql
};
