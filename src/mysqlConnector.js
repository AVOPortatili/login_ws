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




/*

export const executeQuery = (query,callback) => {
    pool.getConnection(function(err,connection){
        if (err) {
            connection.release();
            throw err;
        }
        connection.query(query,function(err,rows){
            connection.release();
            if(!err) {
                callback(null, {rows: rows});
            }
        });
        connection.on('error', function(err) {
            throw err;
            return;
        });
    });
}*/
/*
export function executeQuery(query,callback){

}
*/