import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'mobile1',
  password: 'hani2003',
  port: 5432,
});

pool.on('connect', () => {
  console.log('Connected to the database');
});

export default pool;