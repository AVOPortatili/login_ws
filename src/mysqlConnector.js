import mysql from 'mysql'
// Initialize pool
export const pool      =    mysql.createPool({
    connectionLimit : 10,
    host     : 'localhost',
    user     : 'root',//TODO: in futuro mettere in .env
    password : '',
    database : 'pc',
    debug    :  false
});
